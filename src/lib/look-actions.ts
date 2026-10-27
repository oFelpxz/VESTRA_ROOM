"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { garmentKind } from "@/lib/fit-regions";
import { ACCESSORY_CATEGORY, lookRoles, MAX_LOOKS, parseLookName, parseLookPhoto } from "@/lib/looks";
import { lookCartIds } from "@/lib/look-cart";
import { putLookInCart } from "@/lib/look-cart-db";

export type LookFormState = {
  error?: string;
  success?: boolean;
  /** Look salvo agora (para o link "ver look"). */
  lookId?: string;
};

const variantForLook = {
  id: true,
  status: true,
  product: { select: { status: true, category: { select: { slug: true } } } },
} as const;

/**
 * Salva um look (item 15): a peça do provador + a que completa o look.
 * Com `lookId`, atualiza um look do próprio cliente.
 *
 * formData: name, ownVariantId, companionVariantId, accessoryVariantId
 * (touca), lookId e previewImage (foto do avatar vestido); os três últimos
 * são opcionais.
 */
export async function saveLookAction(
  _prev: LookFormState,
  formData: FormData,
): Promise<LookFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Faça login para salvar o look." };
  const userId = session.user.id;

  const parsed = parseLookName(formData.get("name"));
  if ("error" in parsed) return { error: parsed.error };

  const ownId = String(formData.get("ownVariantId") ?? "");
  const companionId = String(formData.get("companionVariantId") ?? "");
  if (!ownId || !companionId) return { error: "Escolha cor e tamanho das duas peças." };

  const [own, companion] = await Promise.all([
    prisma.productVariant.findUnique({ where: { id: ownId }, select: variantForLook }),
    prisma.productVariant.findUnique({ where: { id: companionId }, select: variantForLook }),
  ]);
  const usable = (v: typeof own) =>
    v && v.status === "ACTIVE" && v.product.status === "ACTIVE";
  if (!usable(own) || !usable(companion)) return { error: "Uma das peças não está mais à venda." };

  const roles = lookRoles(
    { kind: garmentKind(own!.product.category.slug), value: own!.id },
    { kind: garmentKind(companion!.product.category.slug), value: companion!.id },
  );
  if (!roles) return { error: "O look junta uma peça de cima e uma de baixo (ou um vestido)." };

  // Acessório: opcional; vazio tira o que o look tinha.
  const accessoryId = String(formData.get("accessoryVariantId") ?? "");
  if (accessoryId) {
    const accessory = await prisma.productVariant.findUnique({
      where: { id: accessoryId },
      select: variantForLook,
    });
    if (!usable(accessory)) return { error: "O acessório não está mais à venda." };
    if (accessory!.product.category.slug !== ACCESSORY_CATEGORY) {
      return { error: "O terceiro item do look precisa ser um acessório." };
    }
  }

  const photo = parseLookPhoto(formData.get("previewImage"));
  // Sem foto nova (provador sem 3D), a da última vez fica.
  const data = {
    name: parsed.name,
    topVariantId: roles.top,
    bottomVariantId: roles.bottom,
    accessoryVariantId: accessoryId || null,
    ...(photo ? { previewImage: photo } : {}),
  };
  const lookId = String(formData.get("lookId") ?? "");

  if (lookId) {
    const updated = await prisma.savedLook.updateMany({ where: { id: lookId, userId }, data });
    if (updated.count === 0) return { error: "Look não encontrado." };
    revalidatePath("/perfil/looks");
    return { success: true, lookId };
  }

  const count = await prisma.savedLook.count({ where: { userId } });
  if (count >= MAX_LOOKS) {
    return { error: `Você já tem ${MAX_LOOKS} looks. Exclua algum para salvar outro.` };
  }
  const look = await prisma.savedLook.create({ data: { ...data, userId } });
  revalidatePath("/perfil/looks");
  revalidatePath("/perfil");
  return { success: true, lookId: look.id };
}

/** Exclui um look do próprio cliente. formData: id. */
export async function deleteLookAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.savedLook.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/perfil/looks");
  revalidatePath("/perfil");
}

/**
 * Põe as peças do look na sacola (uma de cada, com o acessório se tiver). Se uma delas não
 * puder entrar (fora de venda ou sem estoque), nenhuma entra, e a mensagem
 * diz qual.
 *
 * formData: id.
 */
export async function addLookToCartAction(
  _prev: LookFormState,
  formData: FormData,
): Promise<LookFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Faça login para adicionar à sacola." };
  const userId = session.user.id;

  const id = String(formData.get("id") ?? "");
  const look = await prisma.savedLook.findFirst({
    where: { id, userId },
    select: { topVariantId: true, bottomVariantId: true, accessoryVariantId: true },
  });
  if (!look) return { error: "Look não encontrado." };
  // Peça que saiu da loja deixa o lugar vazio no look salvo.
  if (!look.topVariantId || !look.bottomVariantId) {
    return { error: "Uma das peças do look saiu da loja. Monte o look de novo no provador." };
  }
  // Vestido: a mesma peça nos dois lugares entra uma vez só (lookCartIds).
  const ids = lookCartIds([look.topVariantId, look.bottomVariantId, look.accessoryVariantId]);
  // O vestido sem acessório é uma peça só, e é o look inteiro.
  const error = await putLookInCart(userId, ids, 1);
  if (error) return { error };

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * "Comprar o look todo" no provador (lista 10, item 8): as peças vestidas no
 * avatar, com a cor e o tamanho escolhidos, todas ou nenhuma.
 *
 * formData: productVariantId (repetido, uma por peça).
 */
export async function addLookPiecesToCartAction(
  _prev: LookFormState,
  formData: FormData,
): Promise<LookFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Faça login para adicionar à sacola." };

  const error = await putLookInCart(session.user.id, lookCartIds(formData.getAll("productVariantId")));
  if (error) return { error };

  revalidatePath("/", "layout");
  return { success: true };
}
