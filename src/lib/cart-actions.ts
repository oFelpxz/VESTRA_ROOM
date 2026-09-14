"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CartActionState = { error?: string; success?: boolean };

async function getOrCreateActiveCart(userId: string) {
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
  });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

/**
 * Adiciona uma variante (cor + tamanho) ao carrinho ativo do usuário.
 * Valida estoque considerando o que já está no carrinho.
 *
 * formData: productVariantId, quantity (default 1).
 */
export async function addToCartAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Faça login para adicionar à sacola." };
  }
  const userId = session.user.id;

  const productVariantId = String(formData.get("productVariantId") ?? "");
  const rawQty = Number(formData.get("quantity") ?? 1);
  const quantity = Math.max(1, Number.isFinite(rawQty) ? rawQty : 1);

  if (!productVariantId) {
    return { error: "Selecione cor e tamanho." };
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: productVariantId },
    include: { product: true },
  });
  if (!variant || variant.status !== "ACTIVE") {
    return { error: "Variação indisponível." };
  }

  const cart = await getOrCreateActiveCart(userId);

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productVariantId: {
        cartId: cart.id,
        productVariantId,
      },
    },
  });
  const newQuantity = (existingItem?.quantity ?? 0) + quantity;

  if (newQuantity > variant.stockQuantity) {
    return {
      error: `Estoque insuficiente. Máximo: ${variant.stockQuantity}.`,
    };
  }

  const unitPrice = variant.price ?? variant.product.basePrice;

  await prisma.cartItem.upsert({
    where: {
      cartId_productVariantId: {
        cartId: cart.id,
        productVariantId,
      },
    },
    update: { quantity: newQuantity, unitPrice },
    create: {
      cartId: cart.id,
      productVariantId,
      quantity: newQuantity,
      unitPrice,
    },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Atualiza a quantidade de um item do carrinho. Quantidade <= 0 remove.
 *
 * formData: cartItemId, quantity.
 */
export async function updateCartItemQuantityAction(
  _prev: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sessão expirada." };
  }
  const userId = session.user.id;

  const cartItemId = String(formData.get("cartItemId") ?? "");
  const rawQty = Number(formData.get("quantity") ?? 0);
  const quantity = Math.max(0, Number.isFinite(rawQty) ? Math.floor(rawQty) : 0);

  if (!cartItemId) {
    return { error: "Item inválido." };
  }

  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: { select: { userId: true, status: true } },
      productVariant: { select: { stockQuantity: true } },
    },
  });

  if (
    !item ||
    item.cart.userId !== userId ||
    item.cart.status !== "ACTIVE"
  ) {
    return { error: "Item não encontrado." };
  }

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } });
    revalidatePath("/", "layout");
    return { success: true };
  }

  if (quantity > item.productVariant.stockQuantity) {
    return {
      error: `Estoque insuficiente. Máximo: ${item.productVariant.stockQuantity}.`,
    };
  }

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Wrapper "form-only" do update de quantidade — para uso direto em
 * `<form action={updateCartItemQuantityForm}>` (sem useActionState).
 * Erros e sucesso são ignorados; o revalidatePath dentro da action
 * principal já força o re-render da página.
 */
export async function updateCartItemQuantityForm(formData: FormData) {
  await updateCartItemQuantityAction({}, formData);
}

/**
 * Remove um item específico do carrinho.
 *
 * formData: cartItemId.
 */
export async function removeFromCartAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const cartItemId = String(formData.get("cartItemId") ?? "");
  if (!cartItemId) return;

  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    select: { cart: { select: { userId: true } } },
  });
  if (!item || item.cart.userId !== session.user.id) return;

  await prisma.cartItem.delete({ where: { id: cartItemId } });
  revalidatePath("/", "layout");
}

/**
 * Esvazia o carrinho ativo do usuário (remove todos os itens).
 */
export async function clearCartAction() {
  const session = await auth();
  if (!session?.user?.id) return;

  const cart = await prisma.cart.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!cart) return;

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  revalidatePath("/", "layout");
}
