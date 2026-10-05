import { prisma } from "@/lib/prisma";
import {
  cancelPaymentIntent,
  createCheckoutSession,
  createRefund,
  expireCheckoutSession,
  retrieveCheckoutSession,
  stripeConfigured,
  StripeError,
  type StripeCheckoutSession,
} from "@/lib/stripe";
import {
  checkoutSessionParams,
  describeSession,
  markPaidInTx,
  markRefundedInTx,
  shortOrderCode,
  type PayMethod,
} from "@/lib/payment-rules";
import { cancelOrderInTx, type OrderStatus } from "@/lib/order-cancel";
import { notifyInTx } from "@/lib/notifications";
import { formatBRL } from "@/lib/format";

/**
 * Pagamento real pelo Stripe em modo de teste (itens 16, 17 e 20).
 *
 * Regra principal: o pedido só vira "Pago" quando o próprio Stripe confirma.
 * A confirmação chega por dois caminhos que dão o mesmo resultado (e podem
 * chegar juntos sem problema, porque tudo é idempotente):
 *  1. o webhook (`/api/webhooks/stripe`), que o Stripe chama sozinho;
 *  2. a reconciliação (`syncOrderPayment`), que consulta a sessão no Stripe
 *     quando o cliente volta para a loja ou abre o pedido — cobre o caso de o
 *     webhook atrasar ou não estar rodando.
 */

const orderHref = (orderId: string) => `/perfil/pedidos/${orderId}`;

// --- Abrir a página de pagamento --------------------------------------------

/** Cria a sessão de pagamento do Stripe e devolve o link para o cliente. */
export async function startStripeCheckout(input: {
  orderId: string;
  paymentId: string;
  method: PayMethod;
  totalAmount: number;
  itemsSummary: string;
  customerEmail: string;
  baseUrl: string;
}): Promise<string> {
  const base = {
    orderId: input.orderId,
    method: input.method,
    totalAmount: input.totalAmount,
    itemsSummary: input.itemsSummary,
    customerEmail: input.customerEmail,
    baseUrl: input.baseUrl,
    now: new Date(),
  };

  let session: StripeCheckoutSession;
  try {
    session = await createCheckoutSession(
      checkoutSessionParams(base),
      `checkout-${input.orderId}`,
    );
  } catch (e) {
    // Se o Link não estiver ligado na conta, a carteira segue só com
    // Google Pay / Apple Pay (que vêm dentro de "card").
    if (
      input.method === "WALLET" &&
      e instanceof StripeError &&
      e.param?.startsWith("payment_method_types")
    ) {
      session = await createCheckoutSession(
        checkoutSessionParams({ ...base, methodTypes: ["card"] }),
        `checkout-${input.orderId}-card`,
      );
    } else {
      throw e;
    }
  }
  if (!session.url) throw new StripeError("O Stripe não devolveu o link de pagamento.", 0);

  await prisma.payment.update({
    where: { id: input.paymentId },
    data: { checkoutSessionId: session.id, checkoutUrl: session.url },
  });
  return session.url;
}

// --- Aplicar o que o Stripe diz ----------------------------------------------

/**
 * Aplica no pedido o estado da sessão do Stripe. Pode ser chamada quantas
 * vezes for preciso: só muda o que ainda não mudou.
 */
export async function syncCheckoutSession(session: StripeCheckoutSession) {
  const payment = await prisma.payment.findUnique({
    where: { checkoutSessionId: session.id },
    select: {
      id: true,
      boletoUrl: true,
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
          couponId: true,
          totalAmount: true,
          items: { select: { productVariantId: true, quantity: true } },
        },
      },
    },
  });
  // Sessão que não é desta loja (ou de outro banco): ignora.
  if (!payment) return;
  const order = payment.order;
  const code = shortOrderCode(order.id);
  const outcome = describeSession(session);

  if (outcome.kind === "paid") {
    const result = await prisma.$transaction(async (tx) => {
      const r = await markPaidInTx(tx, {
        orderId: order.id,
        paymentId: payment.id,
        externalPaymentId: outcome.paymentIntentId ?? session.id,
        method: outcome.method,
        now: new Date(),
        allowLate: true,
      });
      if (r === "paid") {
        await notifyInTx(tx, {
          userId: order.userId,
          title: `Pagamento confirmado · Pedido #${code}`,
          body: `Recebemos ${formatBRL(Number(order.totalAmount))}. Agora é com a gente: avisamos quando o pedido for enviado.`,
          href: orderHref(order.id),
        });
      }
      return r;
    });
    // Pagou depois que o pedido já estava cancelado: devolve o dinheiro.
    if (result === "late") await refundOrderPayment(order.id);
    return;
  }

  if (outcome.kind === "boleto") {
    await prisma.$transaction(async (tx) => {
      const saved = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING", boletoUrl: null },
        data: {
          boletoUrl: outcome.boletoUrl,
          dueAt: outcome.dueAt,
          externalPaymentId: outcome.paymentIntentId,
        },
      });
      if (saved.count === 1 && outcome.boletoUrl) {
        await notifyInTx(tx, {
          userId: order.userId,
          title: `Boleto gerado · Pedido #${code}`,
          body: outcome.dueAt
            ? `Pague até ${outcome.dueAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. A confirmação do banco pode levar até 2 dias úteis.`
            : "A confirmação do banco pode levar até 2 dias úteis.",
          href: orderHref(order.id),
        });
      }
    });
    return;
  }

  if (outcome.kind === "failed") {
    await prisma.$transaction(async (tx) => {
      const canceled = await cancelOrderInTx(
        tx,
        { ...order, status: order.status as OrderStatus, payment: { id: payment.id } },
        { allowedFrom: ["PENDING_PAYMENT"], restock: true },
      );
      if (canceled) {
        await notifyInTx(tx, {
          userId: order.userId,
          title: `Pedido #${code} cancelado`,
          body: `${outcome.reason} Nenhum valor foi cobrado. Os itens voltaram para a loja; se ainda quiser, é só fazer um novo pedido.`,
          href: orderHref(order.id),
        });
      }
    });
  }
}

// Última consulta ao Stripe por pedido: a tela de acompanhamento consulta a
// cada 2 s, mas o Stripe só é chamado no máximo a cada 10 s por pedido.
const lastSync = new Map<string, number>();
const SYNC_EVERY_MS = 10_000;

/**
 * Reconciliação: confere no Stripe um pagamento que ainda consta como
 * pendente. `force` ignora o intervalo mínimo (volta do cliente do Stripe).
 */
export async function syncOrderPayment(orderId: string, opts: { force?: boolean } = {}) {
  if (!stripeConfigured()) return;
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    select: { provider: true, status: true, checkoutSessionId: true },
  });
  if (
    !payment ||
    payment.provider !== "STRIPE" ||
    payment.status !== "PENDING" ||
    !payment.checkoutSessionId
  ) {
    return;
  }

  const now = Date.now();
  if (!opts.force && now - (lastSync.get(orderId) ?? 0) < SYNC_EVERY_MS) return;
  lastSync.set(orderId, now);

  try {
    await syncCheckoutSession(await retrieveCheckoutSession(payment.checkoutSessionId));
  } catch (e) {
    // Stripe fora do ar: a tela mostra o último estado conhecido e o webhook
    // ainda vai chegar.
    console.error("[stripe] reconciliação falhou", orderId, e);
  }
}

// --- Cancelamento e estorno (item 20) ---------------------------------------

export type RefundResult =
  | { ok: true; refunded: boolean }
  | { ok: false; error: string; manual?: boolean };

/** Boleto pago não tem estorno pelo Stripe: a loja devolve por transferência. */
export function needsManualRefund(p: { provider: string; method: string }) {
  return p.provider === "STRIPE" && p.method === "BOLETO";
}

/**
 * Estorna o pagamento de um pedido cancelado: pede o estorno ao gateway e,
 * aceito, marca o pagamento e o pedido como Reembolsados e avisa o cliente.
 *
 * `manual: true` é para o Admin registrar uma devolução feita fora do
 * gateway (boleto). Pedido não cancelado nunca é estornado aqui.
 */
export async function refundOrderPayment(
  orderId: string,
  opts: { manual?: boolean } = {},
): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      payment: {
        select: {
          id: true,
          status: true,
          provider: true,
          method: true,
          amount: true,
          externalPaymentId: true,
        },
      },
    },
  });
  const payment = order?.payment;
  if (!order || !payment) return { ok: false, error: "Pedido sem pagamento." };
  if (payment.status !== "PAID") return { ok: true, refunded: false };
  if (order.status !== "CANCELED") {
    return { ok: false, error: "Só pedido cancelado pode ser reembolsado." };
  }

  let refundId: string | null;
  if (opts.manual) {
    refundId = null;
  } else if (needsManualRefund(payment)) {
    return {
      ok: false,
      manual: true,
      error:
        "Boleto não tem estorno automático no Stripe. Devolva o valor por PIX ou transferência e registre o reembolso manual.",
    };
  } else if (payment.provider === "STRIPE") {
    if (!payment.externalPaymentId?.startsWith("pi_")) {
      return { ok: false, error: "Pagamento sem identificador do Stripe." };
    }
    try {
      // A chave de idempotência faz um segundo pedido (clique duplo, nova
      // tentativa) devolver o mesmo estorno em vez de estornar de novo.
      const refund = await createRefund(payment.externalPaymentId, `refund-${payment.id}`);
      if (refund.status === "failed" || refund.status === "canceled") {
        return { ok: false, error: "O Stripe recusou o estorno." };
      }
      refundId = refund.id;
    } catch (e) {
      // "charge_already_refunded": já foi estornado no painel do Stripe.
      if (e instanceof StripeError && e.code === "charge_already_refunded") {
        refundId = null;
      } else {
        console.error("[stripe] estorno falhou", orderId, e);
        return {
          ok: false,
          error: `O Stripe não aceitou o estorno agora (${e instanceof Error ? e.message : "erro"}). Tente de novo.`,
        };
      }
    }
  } else {
    refundId = `SIM-REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }

  const code = shortOrderCode(order.id);
  await prisma.$transaction(async (tx) => {
    const done = await markRefundedInTx(tx, {
      orderId: order.id,
      paymentId: payment.id,
      refundId,
      now: new Date(),
    });
    if (done) {
      await notifyInTx(tx, {
        userId: order.userId,
        title: `Reembolso de ${formatBRL(Number(payment.amount))} · Pedido #${code}`,
        body: opts.manual
          ? "A loja devolveu o valor do boleto por transferência."
          : payment.method === "PIX" || payment.provider === "SIMULATED"
            ? "O valor foi devolvido."
            : "O estorno foi pedido à operadora do cartão. Ele aparece na fatura ou no extrato em até 10 dias úteis.",
        href: orderHref(order.id),
      });
    }
  });
  return { ok: true, refunded: true };
}

/**
 * Depois de cancelar um pedido: estorna o que foi pago e fecha o que ficou
 * aberto no Stripe (página de pagamento ou boleto ainda não pago), para o
 * cliente não conseguir pagar um pedido cancelado.
 */
export async function afterOrderCanceled(
  orderId: string,
  by: "customer" | "admin",
): Promise<RefundResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      payment: {
        select: {
          status: true,
          provider: true,
          method: true,
          checkoutSessionId: true,
          externalPaymentId: true,
        },
      },
    },
  });
  const payment = order?.payment;
  if (!order || !payment) return { ok: true, refunded: false };

  if (by === "admin") {
    await prisma.notification.create({
      data: {
        userId: order.userId,
        title: `Pedido #${shortOrderCode(orderId)} cancelado pela loja`,
        body:
          payment.status === "PAID"
            ? needsManualRefund(payment)
              ? "O valor do boleto pago será devolvido por transferência e você recebe outro aviso."
              : "O valor pago será estornado e você recebe outro aviso."
            : "Nenhum valor foi cobrado.",
        href: orderHref(orderId),
      },
    });
  }

  if (payment.status === "PAID") return refundOrderPayment(orderId);

  if (payment.provider === "STRIPE" && payment.status === "FAILED" && stripeConfigured()) {
    try {
      if (payment.method === "BOLETO" && payment.externalPaymentId?.startsWith("pi_")) {
        await cancelPaymentIntent(payment.externalPaymentId);
      } else if (payment.checkoutSessionId) {
        await expireCheckoutSession(payment.checkoutSessionId);
      }
    } catch (e) {
      // Sessão já expirada/concluída: nada a fechar. Se o cliente ainda
      // assim pagar, o webhook vê o pedido cancelado e estorna sozinho.
      if (!(e instanceof StripeError)) console.error("[stripe] fechar pagamento", orderId, e);
    }
  }
  return { ok: true, refunded: false };
}
