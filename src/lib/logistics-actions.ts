"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_CANCELABLE,
  cancelOrderInTx,
  shouldRestock,
} from "@/lib/order-cancel";
import { afterOrderCanceled, refundOrderPayment } from "@/lib/payments";

export type LogisticsState = { error?: string; success?: boolean };

type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

// Transições permitidas (não pula etapas). Cancelar não entra aqui: é só
// do Admin, em cancelOrderByAdminAction (item 19). PENDING_PAYMENT → PAID
// também não: só a confirmação do pagamento marca o pedido como pago, senão
// o pedido ficaria pago com o Payment ainda PENDING.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ["PREPARING"],
  PREPARING: ["SHIPPED"],
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
    select: { status: true, trackingCode: true },
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

  // Condicionado ao status lido: se o pedido foi cancelado nesse meio-tempo,
  // não volta a andar.
  const moved = await prisma.order.updateMany({
    where: { id: orderId, status: current },
    data: {
      status: next,
      ...(trackingCode ? { trackingCode } : {}),
    },
  });
  if (moved.count === 0) {
    return { error: "O pedido mudou de status. Atualize a página." };
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
  return { success: true };
}

/**
 * Cancelamento pelo Admin (item 19): a qualquer momento, inclusive depois
 * de enviado ou entregue (só não cancela o que já foi cancelado ou
 * reembolsado). Até a separação o estoque sempre volta; depois do envio,
 * só se o Admin marcar que a peça retornou ao depósito.
 */
export async function cancelOrderByAdminAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Só o Administrador pode cancelar pedidos." };
  }

  const orderId = str(formData.get("orderId"));
  if (!orderId) return { error: "Pedido inválido." };
  const returnedToStock = formData.get("returnedToStock") === "on";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      items: { select: { productVariantId: true, quantity: true } },
      payment: { select: { id: true } },
      couponId: true,
    },
  });
  if (!order) return { error: "Pedido não encontrado." };

  const canceled = await prisma.$transaction((tx) =>
    cancelOrderInTx(tx, order, {
      allowedFrom: ADMIN_CANCELABLE,
      restock: shouldRestock(order.status, returnedToStock),
    }),
  );
  if (!canceled) {
    return {
      error: "O pedido mudou de status ou já está encerrado. Atualize a página.",
    };
  }

  // Estorno no gateway (item 20). Se falhar, o cancelamento continua valendo
  // e a página do pedido mostra o botão para tentar o estorno de novo.
  await afterOrderCanceled(orderId, "admin");

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/estoque");
  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
  return { success: true };
}

/**
 * Estorno de pedido cancelado que ainda consta como pago (item 20): nova
 * tentativa depois de uma falha no gateway, ou — com `manual` — registro de
 * um reembolso feito fora do gateway (boleto pago não tem estorno no Stripe).
 */
export async function refundOrderAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Só o Administrador pode reembolsar pedidos." };
  }

  const orderId = str(formData.get("orderId"));
  if (!orderId) return { error: "Pedido inválido." };
  const manual = formData.get("manual") === "on";

  const result = await refundOrderPayment(orderId, { manual });

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
  return result.ok ? { success: true } : { error: result.error };
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

/**
 * Define o limite mínimo de estoque (item 10) que dispara o destaque
 * "Baixo" no painel do Operador de Estoque, por variante.
 */
export async function setLowStockThresholdAction(
  _prev: LogisticsState,
  formData: FormData,
): Promise<LogisticsState> {
  await requireOperator();

  const variantId = str(formData.get("variantId"));
  const threshold = int(formData.get("threshold"));

  if (!variantId) return { error: "Variante inválida." };
  if (threshold < 0) return { error: "Limite inválido." };

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { lowStockThreshold: threshold },
    select: { productId: true },
  });

  revalidatePath("/admin/estoque");
  revalidatePath(`/admin/produtos/${variant.productId}`);
  return { success: true };
}
