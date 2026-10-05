import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { encodeStripeForm, verifyStripeSignature } from "./stripe";

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
    assert.equal(verifyStripeSignature(payload.replace("evt_1", "evt_2"), sign(now), secret, now), false);
    assert.equal(verifyStripeSignature(payload, sign(now, payload, "whsec_outra"), secret, now), false);
    assert.equal(verifyStripeSignature(payload, null, secret, now), false);
    assert.equal(verifyStripeSignature(payload, "t=1,v1=", secret, now), false);
  });

  it("recusa aviso antigo reenviado (mais de 5 min)", () => {
    assert.equal(verifyStripeSignature(payload, sign(now - 301), secret, now), false);
  });
});
