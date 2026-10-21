import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  createRefund,
  refundOnce,
  encodeStripeForm,
  verifyStripeSignature,
} from "./stripe";

describe("encodeStripeForm", () => {
  it("codifica objetos e listas aninhados no formato do Stripe", () => {
    const body = encodeStripeForm({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { unit_amount: 1990 } }],
      payment_method_types: ["card", "link"],
      skip: undefined,
    });
    assert.equal(
      decodeURIComponent(body),
      "mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=1990&payment_method_types[0]=card&payment_method_types[1]=link",
    );
  });
});

describe("verifyStripeSignature (webhook)", () => {
  const secret = "whsec_teste";
  const payload = '{"id":"evt_1","type":"checkout.session.completed"}';
  const now = 1_760_000_000;
  const sign = (t: number, body = payload, key = secret) =>
    `t=${t},v1=${createHmac("sha256", key).update(`${t}.${body}`).digest("hex")}`;

  it("aceita aviso assinado pelo Stripe", () => {
    assert.equal(verifyStripeSignature(payload, sign(now), secret, now), true);
  });

  it("recusa corpo alterado, outra chave ou sem assinatura", () => {
    assert.equal(
      verifyStripeSignature(
        payload.replace("evt_1", "evt_2"),
        sign(now),
        secret,
        now,
      ),
      false,
    );
    assert.equal(
      verifyStripeSignature(
        payload,
        sign(now, payload, "whsec_outra"),
        secret,
        now,
      ),
      false,
    );
    assert.equal(verifyStripeSignature(payload, null, secret, now), false);
    assert.equal(verifyStripeSignature(payload, "t=1,v1=", secret, now), false);
  });

  it("recusa aviso antigo reenviado (mais de 5 min)", () => {
    assert.equal(
      verifyStripeSignature(payload, sign(now - 301), secret, now),
      false,
    );
  });
});

describe("createRefund", () => {
  // Chave falsa e fetch trocado: nada sai do computador.
  const realFetch = globalThis.fetch;
  const realKey = process.env.STRIPE_SECRET_KEY;
  let sent: { body: string; headers: Record<string, string> }[] = [];

  beforeEach(() => {
    sent = [];
    process.env.STRIPE_SECRET_KEY = "sk_test_teste";
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push({
        body: String(init.body),
        headers: init.headers as Record<string, string>,
      });
      return new Response(JSON.stringify({ id: "re_1", status: "succeeded" }));
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = realKey;
  });

  it("sem valor pede o estorno total", async () => {
    await createRefund("pi_1", "refund-pay1");
    assert.equal(sent[0].body, "payment_intent=pi_1");
    assert.equal(sent[0].headers["Idempotency-Key"], "refund-pay1");
  });

  it("com valor pede só esses centavos", async () => {
    await createRefund("pi_1", "return-abc", 9000);
    assert.equal(sent[0].body, "payment_intent=pi_1&amount=9000");
  });

  it("recusa valor zero, negativo ou quebrado sem chamar o Stripe", async () => {
    for (const cents of [0, -100, 90.5]) {
      await assert.rejects(createRefund("pi_1", "k", cents));
    }
    assert.equal(sent.length, 0);
  });
});

describe("refundOnce", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.STRIPE_SECRET_KEY;
  let calls: { url: string; method: string; body: string; key?: string }[] = [];
  let existing: { id: string; status: string; metadata?: Record<string, string> }[] = [];

  beforeEach(() => {
    calls = [];
    existing = [];
    process.env.STRIPE_SECRET_KEY = "sk_test_teste";
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({
        url,
        method: String(init.method),
        body: String(init.body),
        key: headers["Idempotency-Key"],
      });
      if (init.method === "GET") return new Response(JSON.stringify({ data: existing }));
      return new Response(JSON.stringify({ id: "re_novo", status: "succeeded" }));
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = realKey;
  });

  it("já estornado com essa ref: devolve o mesmo, sem estornar de novo", async () => {
    existing = [{ id: "re_velho", status: "succeeded", metadata: { vestra_ref: "return-a" } }];
    const r = await refundOnce("pi_1", "return-a", 9000);
    assert.equal(r.id, "re_velho");
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  });

  it("estorno anterior falhou: pede um novo, com a ref e a chave do minuto", async () => {
    existing = [{ id: "re_falhou", status: "failed", metadata: { vestra_ref: "return-a" } }];
    const r = await refundOnce("pi_1", "return-a", 9000, 120_000);
    assert.equal(r.id, "re_novo");
    const post = calls.find((c) => c.method === "POST")!;
    assert.equal(post.key, "return-a-2");
    assert.equal(
      decodeURIComponent(post.body),
      "payment_intent=pi_1&amount=9000&metadata[vestra_ref]=return-a",
    );
  });

  it("estorno de outra devolução não conta", async () => {
    existing = [{ id: "re_b", status: "succeeded", metadata: { vestra_ref: "return-b" } }];
    const r = await refundOnce("pi_1", "return-a", 9000);
    assert.equal(r.id, "re_novo");
  });

  it("procura só os estornos desse pagamento", async () => {
    await refundOnce("pi_1", "refund-p");
    assert.ok(calls[0].url.endsWith("/refunds?payment_intent=pi_1&limit=100"));
  });
});
