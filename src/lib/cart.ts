import { prisma } from "@/lib/prisma";

/**
 * Carrinho ativo do usuário com itens e dados do produto/variação.
 * Retorna null se o usuário ainda não tem carrinho.
 */
export async function getActiveCartWithItems(userId: string) {
  return prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          productVariant: {
            include: {
              product: {
                include: {
                  images: { orderBy: { position: "asc" }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Total de itens no carrinho ativo (soma das quantidades).
 * Usado no contador da sacola no header.
 */
export async function getCartItemCount(userId: string) {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { items: { select: { quantity: true } } },
  });
  return cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
}
