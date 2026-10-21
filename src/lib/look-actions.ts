"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { garmentKind } from "@/lib/fit-regions";
import { ACCESSORY_CATEGORY, lookRoles, MAX_LOOKS, parseLookName, parseLookPhoto } from "@/lib/looks";

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
    include: {
      topVariant: { include: { product: true } },
      bottomVariant: { include: { product: true } },
      accessoryVariant: { include: { product: true } },
    },
  });
  if (!look) return { error: "Look não encontrado." };

  // Vestido: a mesma peça nos dois lugares entra uma vez só.
  const pieces =
    look.topVariantId === look.bottomVariantId
      ? [look.topVariant]
      : [look.topVariant, look.bottomVariant];
  if (pieces.some((v) => v == null)) {
    return { error: "Uma das peças do look saiu da loja. Monte o look de novo no provador." };
  }
  if (look.accessoryVariant) pieces.push(look.accessoryVariant);

  const cart =
    (await prisma.cart.findFirst({ where: { userId, status: "ACTIVE" } })) ??
    (await prisma.cart.create({ data: { userId } }));

  try {
    await prisma.$transaction(async (tx) => {
      for (const v of pieces) {
        const variant = v!;
        const label = `${variant.product.name} (${variant.color}, ${variant.size})`;
        if (variant.status !== "ACTIVE" || variant.product.status !== "ACTIVE") {
          throw new LookCartError(`${label} não está mais à venda.`);
        }
        const existing = await tx.cartItem.findUnique({
          where: { cartId_productVariantId: { cartId: cart.id, productVariantId: variant.id } },
        });
        const quantity = (existing?.quantity ?? 0) + 1;
        if (quantity > variant.stockQuantity) {
          throw new LookCartError(
            variant.stockQuantity === 0
              ? `${label} está sem estoque.`
              : `${label}: a sacola já tem o máximo do estoque.`,
          );
        }
        // Mesmo preço da página do produto (ver addToCartAction).
        const unitPrice =
          variant.product.promotionalPrice ?? variant.price ?? variant.product.basePrice;
        await tx.cartItem.upsert({
          where: { cartId_productVariantId: { cartId: cart.id, productVariantId: variant.id } },
          update: { quantity, unitPrice },
          create: { cartId: cart.id, productVariantId: variant.id, quantity, unitPrice },
        });
      }
    });
  } catch (e) {
    if (e instanceof LookCartError) return { error: e.message };
    throw e;
  }

  revalidatePath("/", "layout");
  return { success: true };
}

class LookCartError extends Error {}
