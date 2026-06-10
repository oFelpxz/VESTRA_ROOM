"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LogisticsState = { error?: string; success?: boolean };

type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

// Transições permitidas (não pula etapas)
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["PREPARING", "CANCELED"],
  PREPARING: ["SHIPPED", "CANCELED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
  REFUNDED: [],
};

async function requireOperator() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "STOCK_OPERATOR") {
    throw new Error("Acesso negado.");
  }
  return session!.user!;
}

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

function int(v: FormDataEntryValue | null) {
  const n = Number(str(v));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Avança o status do pedido seguindo as transições permitidas.
 * SHIPPED exige tracking code prévio.
 */
export async function advanceOrderStatusAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  await requireOperator();

  const orderId = str(formData.get("orderId"));
  const newStatusRaw = str(formData.get("newStatus")).toUpperCase();
  const trackingCode = str(formData.get("trackingCode")) || null;

  if (!orderId) return { error: "Pedido inválido." };
  if (!newStatusRaw) return { error: "Status inválido." };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, trackingCode: true, items: true, payment: true },
  });
  if (!order) return { error: "Pedido não encontrado." };

  const current = order.status as OrderStatus;
  const next = newStatusRaw as OrderStatus;

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    return {
      error: `Transição inválida: ${current} → ${next}.`,
    };
  }

  if (next === "SHIPPED") {
    if (!trackingCode && !order.trackingCode) {
      return {
        error: "Informe o código de rastreio antes de marcar como enviado.",
      };
    }
  }

  if (next === "CANCELED") {
    // Cancelamento via operador também devolve estoque (espelha cancelOrderAction)
    await prisma.$transaction(async (tx) => {
      for (const i of order.items) {
        if (i.productVariantId) {
          await tx.productVariant.update({
            where: { id: i.productVariantId },
            data: { stockQuantity: { increment: i.quantity } },
          });
        }
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELED" },
      });
      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: order.payment.status === "PAID" ? "REFUNDED" : "FAILED",
          },
        });
      }
    });
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: next,
        ...(trackingCode ? { trackingCode } : {}),
      },
    });
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
  return { success: true };
}

/**
 * Define / atualiza o código de rastreio do pedido (sem mudar status).
 */
export async function setTrackingCodeAction(formData: FormData) {
  await requireOperator();

  const orderId = str(formData.get("orderId"));
  const trackingCode = str(formData.get("trackingCode"));
  if (!orderId || !trackingCode) return;

  await prisma.order.update({
    where: { id: orderId },
    data: { trackingCode },
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/perfil/pedidos/${orderId}`);
}

/**
 * Ajuste manual de estoque com motivo (log via console por ora — em produção,
 * criar tabela StockMovement).
 */
export async function adjustStockAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const user = await requireOperator();

  const variantId = str(formData.get("variantId"));
  const newQuantity = int(formData.get("newQuantity"));
  const reason = str(formData.get("reason")) || "Ajuste manual";

  if (!variantId) return { error: "Variante inválida." };

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { stockQuantity: true, productId: true, sku: true },
  });
  if (!variant) return { error: "Variante não encontrada." };

  const delta = newQuantity - variant.stockQuantity;

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: newQuantity },
  });

  // Log simples (sem tabela própria por ora)
  console.log(
    `[STOCK] ${variant.sku} ${variant.stockQuantity} → ${newQuantity} (Δ ${delta >= 0 ? "+" : ""}${delta}) por ${user.email} · ${reason}`,
  );

  revalidatePath("/admin/estoque");
  revalidatePath(`/admin/produtos/${variant.productId}`);
  return { success: true };
}
