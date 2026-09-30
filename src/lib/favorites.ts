import { prisma } from "@/lib/prisma";
import { compareVariants } from "@/lib/sizes";

// Consultas de favoritos (item 11). Ficam fora de um arquivo "use server" de
// propósito: lá, toda função exportada vira endpoint público, e estas recebem o
// userId como parâmetro.

/** IDs dos produtos favoritados — para marcar o coração no catálogo. */
export async function getFavoriteProductIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

export async function isProductFavorite(userId: string, productId: string) {
  const row = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  });
  return row !== null;
}

/** Lista de desejos com o necessário para o atalho de "adicionar à sacola". */
export async function getFavoritesWithProducts(userId: string) {
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          basePrice: true,
          promotionalPrice: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          variants: {
            where: { status: "ACTIVE" },
            select: { id: true, color: true, size: true, stockQuantity: true },
          },
        },
      },
    },
  });
  for (const f of favorites) f.product.variants.sort(compareVariants);
  return favorites;
}
