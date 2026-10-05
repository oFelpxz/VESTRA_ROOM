import type { Prisma } from "@/generated/prisma/client";
import type {
  StripeCharge,
  StripeCheckoutSession,
  StripePaymentIntent,
} from "@/lib/stripe";

/**
 * Regras do pagamento pelo Stripe (itens 16, 17 e 20). Funções sem acesso
 * direto ao banco nem à rede — quem chama passa a transação ou os dados —,
 * para poderem ser testadas.
 */

export type PayMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "BOLETO" | "WALLET";

export const PAY_METHODS: readonly PayMethod[] = [
  "PIX",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BOLETO",
  "WALLET",
];

/** PIX não é oferecido pelo Stripe para a conta de teste: continua simulado. */
export function usesStripe(method: PayMethod, stripeOn: boolean) {
  return stripeOn && method !== "PIX";
}

/** Dias corridos até o boleto vencer (o Stripe aceita de 0 a 60). */
export const BOLETO_DAYS = 3;

/**
 * Tempo para o cliente concluir a página de pagamento do Stripe. Depois disso
 * a sessão expira, o pedido é cancelado e o estoque reservado volta.
 * (O Stripe aceita de 30 min a 24 h.)
 */
export const CHECKOUT_TTL_MIN = 60;

/** Formas de pagamento oferecidas na página do Stripe para cada escolha. */
export function stripeMethodTypes(method: PayMethod): string[] {
  switch (method) {
    case "BOLETO":
      return ["boleto"];
    // Google Pay e Apple Pay aparecem dentro de "card" quando o navegador
    // tem a carteira; o Link é a carteira do próprio Stripe.
    case "WALLET":
      return ["card", "link"];
    default:
      // Crédito e débito usam o mesmo meio ("card"); a modalidade real vem
      // da cobrança depois (ver `detectMethod`).
      return ["card"];
  }
}

export function shortOrderCode(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

/** Parâmetros da sessão do Stripe Checkout para um pedido. */
export function checkoutSessionParams(input: {
  orderId: string;
  method: PayMethod;
  totalAmount: number;
  itemsSummary: string;
  customerEmail: string;
  baseUrl: string;
  now: Date;
  methodTypes?: string[];
}) {
  const code = shortOrderCode(input.orderId);
  const page = `${input.baseUrl}/checkout/sucesso/${input.orderId}`;
  return {
    mode: "payment",
    locale: "pt-BR",
    client_reference_id: input.orderId,
    customer_email: input.customerEmail,
    metadata: { orderId: input.orderId },
    payment_intent_data: { metadata: { orderId: input.orderId } },
    payment_method_types: input.methodTypes ?? stripeMethodTypes(input.method),
    payment_method_options:
      input.method === "BOLETO"
        ? { boleto: { expires_after_days: BOLETO_DAYS } }
        : undefined,
    // Um item só, com o total do pedido: desconto do cupom e frete já estão
    // calculados pela loja e o Stripe cobra exatamente esse valor.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: Math.round(input.totalAmount * 100),
          product_data: {
            name: `Pedido #${code} · VESTRA ROOM`,
            description: input.itemsSummary.slice(0, 500) || undefined,
          },
        },
      },
    ],
    expires_at: Math.floor(input.now.getTime() / 1000) + CHECKOUT_TTL_MIN * 60,
    success_url: `${page}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: page,
  };
}

/** Forma de pagamento que o cliente realmente usou, lida da cobrança. */
export function detectMethod(charge: StripeCharge | null | undefined): PayMethod | null {
  const details = charge?.payment_method_details;
  if (!details) return null;
  if (details.type === "boleto") return "BOLETO";
  if (details.type === "link") return "WALLET";
  if (details.type === "card") {
    if (details.card?.wallet?.type) return "WALLET";
    if (details.card?.funding === "debit") return "DEBIT_CARD";
    if (details.card?.funding === "credit") return "CREDIT_CARD";
  }
  return null;
}

export type SessionOutcome =
  | { kind: "paid"; paymentIntentId: string | null; method: PayMethod | null }
  | { kind: "boleto"; paymentIntentId: string; boletoUrl: string | null; dueAt: Date | null }
  | { kind: "failed"; reason: string }
  | { kind: "open" };

/**
 * O que a sessão do Stripe diz sobre o pagamento. Usada igual pelo webhook e
 * pela página de retorno, para os dois caminhos chegarem à mesma conclusão.
 */
export function describeSession(session: StripeCheckoutSession): SessionOutcome {
  const pi =
    session.payment_intent && typeof session.payment_intent === "object"
      ? (session.payment_intent as StripePaymentIntent)
      : null;
  const piId =
    typeof session.payment_intent === "string" ? session.payment_intent : pi?.id ?? null;

  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    const charge =
      pi?.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    return { kind: "paid", paymentIntentId: piId, method: detectMethod(charge) };
  }
  if (session.status === "expired") {
    return { kind: "failed", reason: "O prazo para concluir o pagamento acabou." };
  }
  if (session.status === "complete" && pi) {
    // Boleto vencido ou recusado: o PaymentIntent volta a pedir pagamento.
    if (pi.status === "requires_payment_method" || pi.status === "canceled") {
      return { kind: "failed", reason: "O boleto venceu sem pagamento." };
    }
    const boleto = pi.next_action?.boleto_display_details;
    return {
      kind: "boleto",
      paymentIntentId: pi.id,
      boletoUrl: boleto?.hosted_voucher_url ?? null,
      dueAt: boleto?.expires_at ? new Date(boleto.expires_at * 1000) : null,
    };
  }
  return { kind: "open" };
}

/**
 * Marca o pagamento como pago. Idempotente: o webhook e a página de retorno
 * podem chegar juntos, e o Stripe reenvia avisos.
 *
 * - "paid": o pedido saiu de Aguardando pagamento → Pago agora.
 * - "already": já estava pago (aviso repetido).
 * - "late": o pedido foi cancelado antes de o pagamento chegar. Com
 *   `allowLate` (gateway real: o dinheiro saiu do cliente), o pagamento fica
 *   registrado como pago para ser estornado em seguida; sem ele (simulado),
 *   nada muda e o resultado é "already".
 */
export async function markPaidInTx(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    paymentId: string;
    externalPaymentId: string;
    method: PayMethod | null;
    now: Date;
    allowLate: boolean;
  },
): Promise<"paid" | "already" | "late"> {
  const paymentData = {
    status: "PAID" as const,
    paidAt: input.now,
    externalPaymentId: input.externalPaymentId,
    ...(input.method ? { method: input.method } : {}),
  };

  const moved = await tx.order.updateMany({
    where: { id: input.orderId, status: "PENDING_PAYMENT" },
    data: { status: "PAID" },
  });
  if (moved.count === 1) {
    await tx.payment.updateMany({
      where: { id: input.paymentId, status: { in: ["PENDING", "FAILED"] } },
      data: paymentData,
    });
    return "paid";
  }

  // Pedido não está mais aguardando. Se o pagamento ainda não constava como
  // pago, o dinheiro chegou depois do cancelamento: registra para estornar.
  if (!input.allowLate) return "already";
  const late = await tx.payment.updateMany({
    where: { id: input.paymentId, status: { in: ["PENDING", "FAILED"] } },
    data: paymentData,
  });
  return late.count === 1 ? "late" : "already";
}

/**
 * Registra o reembolso: pagamento Pago → Reembolsado e pedido Cancelado →
 * Reembolsado. Só o primeiro a chegar altera (devolve false para os demais).
 */
export async function markRefundedInTx(
  tx: Prisma.TransactionClient,
  input: { orderId: string; paymentId: string; refundId: string | null; now: Date },
): Promise<boolean> {
  const done = await tx.payment.updateMany({
    where: { id: input.paymentId, status: "PAID" },
    data: { status: "REFUNDED", refundId: input.refundId, refundedAt: input.now },
  });
  if (done.count === 0) return false;
  await tx.order.updateMany({
    where: { id: input.orderId, status: "CANCELED" },
    data: { status: "REFUNDED" },
  });
  return true;
}
