import { prisma } from "@/lib/prisma";
import { computePartialRefund } from "@/lib/partial-refund";
import { refundsShipping, type ReturnReason } from "@/lib/returns";

/**
 * Quanto devolver numa devolução em dinheiro (item 22 ligado ao item 20):
 * a parte das peças, menos a fatia do cupom, e o frete uma vez no
 * arrependimento ou defeito. Usado pela tela do Admin (prévia) e pela action.
 */
export async function loadReturnRefund(req: {
  orderId: string;
  orderItemId: string;
  quantity: number;
  reason: ReturnReason;
}) {
  const order = await prisma.order.findUnique({
    where: { id: req.orderId },
    select: {
      discountAmount: true,
      shippingAmount: true,
      items: { select: { id: true, productName: true, size: true, unitPrice: true, quantity: true } },
      payment: {
        select: {
          id: true,
          status: true,
          provider: true,
          method: true,
          amount: true,
          refundedAmount: true,
          externalPaymentId: true,
        },
      },
      returnRequests: {
        where: { status: "COMPLETED", approvedKind: "REFUND" },
        select: { orderItemId: true, quantity: true, refundShipping: true },
      },
    },
  });
  const payment = order?.payment;
  if (!order || !payment) return { ok: false as const, error: "Pedido sem pagamento." };
  if (payment.status !== "PAID") {
    return { ok: false as const, error: "Este pagamento já foi todo devolvido." };
  }

  const alreadyReturned: Record<string, number> = {};
  for (const r of order.returnRequests) {
    alreadyReturned[r.orderItemId] = (alreadyReturned[r.orderItemId] ?? 0) + r.quantity;
  }
  const refund = computePartialRefund({
    items: order.items.map((i) => ({
      id: i.id,
      name: `${i.productName} (${i.size})`,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
    })),
    returns: [{ itemId: req.orderItemId, quantity: req.quantity }],
    alreadyReturned,
    discountAmount: Number(order.discountAmount),
    shippingAmount: Number(order.shippingAmount),
    paidAmount: Number(payment.amount),
    alreadyRefunded: Number(payment.refundedAmount),
    includeShipping: refundsShipping(
      req.reason,
      order.returnRequests.some((r) => r.refundShipping),
    ),
  });
  if (!refund.ok) return { ok: false as const, error: refund.error };
  return { ok: true as const, payment, refund };
}
