"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Marca ou desmarca um produto como favorito (item 11).
 *
 * formData: productId, favorite ("true" | "false") — estado desejado explícito,
 * para dois cliques rápidos não se anularem como num "inverter".
 */
export async function setFavoriteAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;
  const favorite = formData.get("favorite") === "true";

  if (favorite) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    });
    if (product?.status !== "ACTIVE") return;

    try {
      await prisma.favorite.create({ data: { userId, productId } });
    } catch (e) {
      // Já era favorito (ex.: clique duplo): o índice único barra, e está tudo certo.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  } else {
    await prisma.favorite.deleteMany({ where: { userId, productId } });
  }

  revalidatePath("/", "layout");
}
