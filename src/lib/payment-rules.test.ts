import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkoutSessionParams,
  describeSession,
  detectMethod,
  markPaidInTx,
  markRefundedInTx,
  stripeMethodTypes,
  usesStripe,
} from "./payment-rules";
import type { StripeCheckoutSession } from "./stripe";

describe("qual forma vai pelo Stripe (itens 16 e 17)", () => {
  it("PIX continua simulado; o resto vai pelo Stripe se houver chave", () => {
    assert.equal(usesStripe("PIX", true), false);
    assert.equal(usesStripe("CREDIT_CARD", true), true);
    assert.equal(usesStripe("BOLETO", true), true);
    assert.equal(usesStripe("CREDIT_CARD", false), false);
  });

  it("cada escolha abre a página do Stripe com os meios certos", () => {
    assert.deepEqual(stripeMethodTypes("CREDIT_CARD"), ["card"]);
    assert.deepEqual(stripeMethodTypes("DEBIT_CARD"), ["card"]);
    assert.deepEqual(stripeMethodTypes("BOLETO"), ["boleto"]);
    assert.deepEqual(stripeMethodTypes("WALLET"), ["card", "link"]);
  });
});

describe("checkoutSessionParams", () => {
  const base = {
    orderId: "cmabc123xyz45678",
    totalAmount: 199.9,
    itemsSummary: "1x Camiseta (Preto, M)",
    customerEmail: "cliente@teste.com",
    baseUrl: "http://localhost:3000",
    now: new Date("2026-10-05T12:00:00Z"),
  };

  it("cobra o total do pedido em centavos e liga a sessão ao pedido", () => {
    const p = checkoutSessionParams({ ...base, method: "CREDIT_CARD" });
    assert.equal(p.line_items[0].price_data.unit_amount, 19990);
    assert.equal(p.line_items[0].price_data.currency, "brl");
    assert.equal(p.client_reference_id, base.orderId);
    assert.equal(p.metadata.orderId, base.orderId);
    assert.equal(p.payment_intent_data.metadata.orderId, base.orderId);
    assert.equal(p.payment_method_options, undefined);
  });

  it("volta para a página do pedido, com o id da sessão para reconciliar", () => {
    const p = checkoutSessionParams({ ...base, method: "CREDIT_CARD" });
    assert.equal(
      p.success_url,
      "http://localhost:3000/checkout/sucesso/cmabc123xyz45678?session_id={CHECKOUT_SESSION_ID}",
    );
    assert.equal(p.cancel_url, "http://localhost:3000/checkout/sucesso/cmabc123xyz45678");
  });

  it("a página de pagamento expira em 1 hora", () => {
    const p = checkoutSessionParams({ ...base, method: "CREDIT_CARD" });
    assert.equal(p.expires_at, Math.floor(base.now.getTime() / 1000) + 3600);
  });

  it("e-mail vai preenchido; no boleto de teste fica livre para o cenário", () => {
    assert.equal(checkoutSessionParams({ ...base, method: "BOLETO" }).customer_email, base.customerEmail);
    assert.equal(
      checkoutSessionParams({ ...base, method: "CREDIT_CARD", testMode: true }).customer_email,
      base.customerEmail,
    );
    assert.equal(checkoutSessionParams({ ...base, method: "BOLETO", testMode: true }).customer_email, undefined);
  });

  it("boleto vence em 3 dias", () => {
    const p = checkoutSessionParams({ ...base, method: "BOLETO" });
    assert.deepEqual(p.payment_method_types, ["boleto"]);
    assert.deepEqual(p.payment_method_options, { boleto: { expires_after_days: 3 } });
  });

  it("arredonda centavos sem erro de ponto flutuante", () => {
    const p = checkoutSessionParams({ ...base, method: "PIX", totalAmount: 0.1 + 0.2 + 100 });
    assert.equal(p.line_items[0].price_data.unit_amount, 10030);
  });
});

describe("detectMethod: forma usada de verdade", () => {
  it("lê crédito, débito, carteira e boleto da cobrança", () => {
    const card = (funding: string, wallet: string | null = null) => ({
      id: "ch",
      refunded: false,
      payment_method_details: { type: "card", card: { funding, wallet: wallet ? { type: wallet } : null } },
    });
    assert.equal(detectMethod(card("credit")), "CREDIT_CARD");
    assert.equal(detectMethod(card("debit")), "DEBIT_CARD");
    assert.equal(detectMethod(card("credit", "google_pay")), "WALLET");
    assert.equal(detectMethod({ id: "ch", refunded: false, payment_method_details: { type: "link" } }), "WALLET");
    assert.equal(detectMethod({ id: "ch", refunded: false, payment_method_details: { type: "boleto" } }), "BOLETO");
    assert.equal(detectMethod(null), null);
  });
});

describe("describeSession", () => {
  const session = (over: Partial<StripeCheckoutSession>): StripeCheckoutSession => ({
    id: "cs_1",
    url: null,
    status: "open",
    payment_status: "unpaid",
    client_reference_id: "o1",
    metadata: null,
    payment_intent: null,
    ...over,
  });

  it("pago, com a forma detectada", () => {
    const out = describeSession(
      session({
        status: "complete",
        payment_status: "paid",
        payment_intent: {
          id: "pi_1",
          status: "succeeded",
          latest_charge: { id: "ch_1", refunded: false, payment_method_details: { type: "card", card: { funding: "debit" } } },
        },
      }),
    );
    assert.deepEqual(out, { kind: "paid", paymentIntentId: "pi_1", method: "DEBIT_CARD" });
  });

  it("boleto gerado e ainda não pago: link e vencimento", () => {
    const out = describeSession(
      session({
        status: "complete",
        payment_intent: {
          id: "pi_2",
          status: "requires_action",
          next_action: {
            boleto_display_details: { hosted_voucher_url: "https://boleto", expires_at: 1_760_000_000 },
          },
        },
      }),
    );
    assert.deepEqual(out, {
      kind: "boleto",
      paymentIntentId: "pi_2",
      boletoUrl: "https://boleto",
      dueAt: new Date(1_760_000_000 * 1000),
    });
  });

  it("boleto vencido é falha", () => {
    const out = describeSession(
      session({ status: "complete", payment_intent: { id: "pi_3", status: "requires_payment_method" } }),
    );
    assert.equal(out.kind, "failed");
  });

  it("página expirada é falha; página aberta não muda nada", () => {
    assert.equal(describeSession(session({ status: "expired" })).kind, "failed");
    assert.equal(describeSession(session({ status: "open" })).kind, "open");
  });
});

/** Banco falso em memória, só com o que markPaidInTx/markRefundedInTx usam. */
function fakeTx(orderStatus: string, paymentStatus: string) {
  const db = { order: { status: orderStatus }, payment: { status: paymentStatus } as Record<string, unknown> };
  const matches = (current: unknown, cond: unknown) =>
    typeof cond === "object" && cond !== null && "in" in cond
      ? (cond as { in: unknown[] }).in.includes(current)
      : current === cond;
  const tx = {
    order: {
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (db.order.status !== where.status) return { count: 0 };
        db.order.status = data.status;
        return { count: 1 };
      },
    },
    payment: {
      updateMany: async ({ where, data }: { where: { status: unknown }; data: Record<string, unknown> }) => {
        if (!matches(db.payment.status, where.status)) return { count: 0 };
        Object.assign(db.payment, data);
        return { count: 1 };
      },
    },
  };
  return { db, tx: tx as never };
}

const paidInput = (allowLate: boolean) => ({
  orderId: "o1",
  paymentId: "p1",
  externalPaymentId: "pi_1",
  method: "CREDIT_CARD" as const,
  now: new Date("2026-10-05T12:00:00Z"),
  allowLate,
});

describe("markPaidInTx", () => {
  it("confirma o pedido que aguardava pagamento", async () => {
    const { db, tx } = fakeTx("PENDING_PAYMENT", "PENDING");
    assert.equal(await markPaidInTx(tx, paidInput(true)), "paid");
    assert.equal(db.order.status, "PAID");
    assert.equal(db.payment.status, "PAID");
    assert.equal(db.payment.externalPaymentId, "pi_1");
  });

  it("aviso repetido (webhook + volta do cliente) não muda nada", async () => {
    const { db, tx } = fakeTx("PENDING_PAYMENT", "PENDING");
    const results = await Promise.all([markPaidInTx(tx, paidInput(true)), markPaidInTx(tx, paidInput(true))]);
    assert.deepEqual(results.sort(), ["already", "paid"]);
    assert.equal(db.order.status, "PAID");
  });

  it("pagamento real depois do cancelamento: registra para estornar", async () => {
    const { db, tx } = fakeTx("CANCELED", "FAILED");
    assert.equal(await markPaidInTx(tx, paidInput(true)), "late");
    assert.equal(db.order.status, "CANCELED");
    assert.equal(db.payment.status, "PAID");
  });

  it("simulado depois do cancelamento: ignora", async () => {
    const { db, tx } = fakeTx("CANCELED", "FAILED");
    assert.equal(await markPaidInTx(tx, paidInput(false)), "already");
    assert.equal(db.payment.status, "FAILED");
  });
});

describe("markRefundedInTx (item 20)", () => {
  const input = { orderId: "o1", paymentId: "p1", refundId: "re_1", now: new Date() };

  it("pedido cancelado e pago vira Reembolsado", async () => {
    const { db, tx } = fakeTx("CANCELED", "PAID");
    assert.equal(await markRefundedInTx(tx, input), true);
    assert.equal(db.order.status, "REFUNDED");
    assert.equal(db.payment.status, "REFUNDED");
    assert.equal(db.payment.refundId, "re_1");
  });

  it("estorno repetido não avisa o cliente duas vezes", async () => {
    const { tx } = fakeTx("CANCELED", "PAID");
    const results = await Promise.all([markRefundedInTx(tx, input), markRefundedInTx(tx, input)]);
    assert.deepEqual(results.sort(), [false, true]);
  });
});
