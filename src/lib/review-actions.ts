"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ReviewFormState = { error?: string; success?: boolean };

// Status de pedido que contam como "efetivou a compra" (item 09).
const PURCHASED_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  const count = await prisma.orderItem.count({
    where: {
      order: { userId, status: { in: [...PURCHASED_STATUSES] } },
      productVariant: { productId },
    },
  });
  return count > 0;
}

/** Usado pela página de produto para decidir se mostra o formulário. */
export async function getReviewEligibility(productId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { canReview: false, reason: "login" as const };
  }
  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId: session.user.id } },
  });
  if (existing) {
    return { canReview: false, reason: "already-reviewed" as const, existing };
  }
  const purchased = await hasPurchased(session.user.id, productId);
  if (!purchased) {
    return { canReview: false, reason: "not-purchased" as const };
  }
  return { canReview: true as const };
}

export async function createReviewAction(
  _prev: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Entre na sua conta para avaliar." };
  }

  const productId = String(formData.get("productId") ?? "").trim();
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!productId) return { error: "Produto inválido." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Escolha uma nota de 1 a 5." };
  }

  const purchased = await hasPurchased(session.user.id, productId);
  if (!purchased) {
    return { error: "Só quem comprou o produto pode avaliar." };
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId: session.user.id } },
  });
  if (existing) {
    return { error: "Você já avaliou este produto." };
  }

  await prisma.review.create({
    data: {
      productId,
      userId: session.user.id,
      rating,
      comment: comment || null,
      status: "PENDING",
    },
  });

  if (productSlug) revalidatePath(`/produto/${productSlug}`);
  revalidatePath("/admin/avaliacoes");
  return { success: true };
}

// --- Moderação (Administrador) ---

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

export async function approveReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const review = await prisma.review.update({
    where: { id },
    data: { status: "APPROVED" },
    include: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
}

export async function rejectReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const review = await prisma.review.update({
    where: { id },
    data: { status: "REJECTED" },
    include: { product: { select: { slug: true } } },
  });
  revalidatePath("/admin/avaliacoes");
  revalidatePath(`/produto/${review.product.slug}`);
}
