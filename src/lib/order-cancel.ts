import type { Prisma } from "@/generated/prisma/client";

/**
 * Regras de cancelamento de pedido (item 19), compartilhadas pela área do
 * cliente e pelo painel do Admin.
 */

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

/** Cliente cancela só antes da separação (PREPARING em diante, não). */
export const CUSTOMER_CANCELABLE: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
];

/** Admin cancela a qualquer momento, exceto o que já está encerrado. */
export const ADMIN_CANCELABLE: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
];

/** Depois de enviado, a peça saiu do depósito: o estoque só volta se ela voltar. */
export function goodsLeftWarehouse(status: OrderStatus) {
  return status === "SHIPPED" || status === "DELIVERED";
}

export function canCustomerCancel(status: string) {
  return CUSTOMER_CANCELABLE.includes(status as OrderStatus);
}

export function canAdminCancel(status: string) {
  return ADMIN_CANCELABLE.includes(status as OrderStatus);
}

/**
 * Antes do envio o estoque sempre volta; depois, só se o Admin confirmar
 * que a peça retornou.
 */
export function shouldRestock(status: OrderStatus, returnedToStock: boolean) {
  return goodsLeftWarehouse(status) ? returnedToStock : true;
}

/**
 * Cancela o pedido dentro de uma transação já aberta.
 *
 * A troca de status é feita com `updateMany` condicionado ao status atual:
 * se dois cancelamentos chegarem juntos (clique duplo, cliente e Admin ao
 * mesmo tempo), só o primeiro passa e o estoque volta uma vez só.
 *
 * Devolve `false` quando o pedido não está (ou deixou de estar) num status
 * cancelável — nada é alterado nesse caso.
 */
export async function cancelOrderInTx(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    status: OrderStatus;
    items: { productVariantId: string | null; quantity: number }[];
    payment: { id: string } | null;
  },
  opts: { allowedFrom: readonly OrderStatus[]; restock: boolean },
) {
  if (!opts.allowedFrom.includes(order.status)) return false;

  // Exige o mesmo status que a tela viu: se o pedido andou (ex.: foi
  // enviado) nesse meio-tempo, a decisão de devolver estoque já não vale.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: "CANCELED" },
  });
  if (claimed.count === 0) return false;

  if (opts.restock) {
    for (const i of order.items) {
      if (i.productVariantId) {
        await tx.productVariant.update({
          where: { id: i.productVariantId },
          data: { stockQuantity: { increment: i.quantity } },
        });
      }
    }
  }

  // Pago → reembolsado; pendente → falhou. Lido no banco (não no objeto
  // carregado antes) porque a confirmação do pagamento pode ter chegado
  // nesse meio-tempo. O estorno no gateway entra no item 20.
  if (order.payment) {
    await tx.payment.updateMany({
      where: { id: order.payment.id, status: "PAID" },
      data: { status: "REFUNDED" },
    });
    await tx.payment.updateMany({
      where: { id: order.payment.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
  }

  return true;
}
