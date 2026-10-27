import { prisma } from "@/lib/prisma";
import { checkLookCart } from "@/lib/look-cart";

/**
 * Põe as peças de um look na sacola do cliente, uma de cada, todas ou
 * nenhuma (`checkLookCart`). Usado pelo "Comprar o look todo" do provador e
 * pelo "Adicionar o look à sacola" de Meus looks. Cada peça pelo próprio
 * preço, o mesmo da página do produto (ver `addToCartAction`).
 *
 * Não é uma server action (recebe o `userId`): só chamar de uma que já
 * conferiu o login. Devolve a mensagem de erro, ou null quando entrou.
 */
export async function putLookInCart(
  userId: string,
  ids: string[],
  minPieces = 2,
): Promise<string | null> {
  const cart =
    (await prisma.cart.findFirst({ where: { userId, status: "ACTIVE" } })) ??
    (await prisma.cart.create({ data: { userId } }));

  return prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: ids } },
      include: { product: true },
    });
    const items = await tx.cartItem.findMany({
      where: { cartId: cart.id, productVariantId: { in: ids } },
    });
    const inCart = new Map(items.map((i) => [i.productVariantId, i.quantity]));
    const error = checkLookCart(
      ids,
      variants.map((v) => ({
        id: v.id,
        active: v.status === "ACTIVE" && v.product.status === "ACTIVE",
        stockQuantity: v.stockQuantity,
        label: `${v.product.name} (${v.color}, ${v.size})`,
      })),
      inCart,
      minPieces,
    );
    if (error) return error;
    for (const v of variants) {
      const quantity = (inCart.get(v.id) ?? 0) + 1;
      const unitPrice = v.product.promotionalPrice ?? v.price ?? v.product.basePrice;
      await tx.cartItem.upsert({
        where: { cartId_productVariantId: { cartId: cart.id, productVariantId: v.id } },
        update: { quantity, unitPrice },
        create: { cartId: cart.id, productVariantId: v.id, quantity, unitPrice },
      });
    }
    return null;
  });
}
