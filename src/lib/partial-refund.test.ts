import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computePartialRefund,
  type PartialRefundInput,
} from "./partial-refund";

// Pedido: 2 camisetas de R$ 100 + 1 moletom de R$ 250 = R$ 450.
// Cupom de R$ 45 (10%), frete de R$ 20, pago R$ 425.
const order: Omit<PartialRefundInput, "returns"> = {
  items: [
    { id: "tee", name: "Boxy Tee 01 (M)", unitPrice: 100, quantity: 2 },
    { id: "hoodie", name: "Hoodie Core (G)", unitPrice: 250, quantity: 1 },
  ],
  discountAmount: 45,
  shippingAmount: 20,
  paidAmount: 425,
};

function ok(input: PartialRefundInput) {
  const r = computePartialRefund(input);
  if (!r.ok) assert.fail(r.error);
  return r;
}

describe("computePartialRefund", () => {
  it("uma peça devolve o preço dela menos a parte do cupom", () => {
    const r = ok({ ...order, returns: [{ itemId: "tee", quantity: 1 }] });
    assert.equal(r.itemsValue, 100);
    assert.equal(r.discountShare, 10);
    assert.equal(r.amount, 90);
    assert.equal(r.cents, 9000);
    assert.equal(r.shipping, 0);
    assert.equal(r.allReturned, false);
  });

  it("sem cupom devolve o preço cheio", () => {
    const r = ok({
      ...order,
      discountAmount: 0,
      paidAmount: 470,
      returns: [{ itemId: "hoodie", quantity: 1 }],
    });
    assert.equal(r.amount, 250);
  });

  it("frete só volta quando pedido", () => {
    const r = ok({
      ...order,
      includeShipping: true,
      returns: [{ itemId: "tee", quantity: 1 }],
    });
    assert.equal(r.shipping, 20);
    assert.equal(r.amount, 110);
  });

  it("devolver tudo de uma vez devolve o valor pago", () => {
    const r = ok({
      ...order,
      includeShipping: true,
      returns: [
        { itemId: "tee", quantity: 2 },
        { itemId: "hoodie", quantity: 1 },
      ],
    });
    assert.equal(r.amount, 425);
    assert.equal(r.allReturned, true);
  });

  it("devoluções separadas somam o mesmo que devolver tudo, sem perder centavo", () => {
    // Cupom de R$ 10 em 3 peças de R$ 33,33: a divisão não é exata.
    const odd: Omit<PartialRefundInput, "returns"> = {
      items: [{ id: "a", unitPrice: 33.33, quantity: 3 }],
      discountAmount: 10,
      shippingAmount: 0,
      paidAmount: 89.99,
    };
    let refunded = 0;
    for (let i = 0; i < 3; i++) {
      const r = ok({
        ...odd,
        alreadyReturned: { a: i },
        alreadyRefunded: refunded,
        returns: [{ itemId: "a", quantity: 1 }],
      });
      refunded = Math.round((refunded + r.amount) * 100) / 100;
    }
    assert.equal(refunded, 89.99);
  });

  it("linhas repetidas do mesmo item são somadas", () => {
    const r = ok({
      ...order,
      returns: [
        { itemId: "tee", quantity: 1 },
        { itemId: "tee", quantity: 1 },
      ],
    });
    assert.equal(r.amount, 180);
  });

  it("não deixa devolver mais do que comprou, contando o que já voltou", () => {
    const r = computePartialRefund({
      ...order,
      alreadyReturned: { tee: 1 },
      returns: [{ itemId: "tee", quantity: 2 }],
    });
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.error : "", /Boxy Tee 01 \(M\).*devolver 1/);
  });

  it("recusa quantidade inválida, peça de outro pedido e lista vazia", () => {
    for (const returns of [
      [{ itemId: "tee", quantity: 0 }],
      [{ itemId: "tee", quantity: 1.5 }],
      [{ itemId: "outro", quantity: 1 }],
      [],
    ]) {
      assert.equal(computePartialRefund({ ...order, returns }).ok, false);
    }
  });

  it("nunca passa do que falta devolver do pagamento", () => {
    const r = ok({
      ...order,
      alreadyRefunded: 400,
      returns: [{ itemId: "hoodie", quantity: 1 }],
    });
    assert.equal(r.amount, 25);
    assert.equal(r.capped, true);
  });

  it("pagamento já todo devolvido: erro", () => {
    const r = computePartialRefund({
      ...order,
      alreadyRefunded: 425,
      returns: [{ itemId: "tee", quantity: 1 }],
    });
    assert.equal(r.ok, false);
  });

  it("cupom de 100%: a peça devolve 0 (quem chama não pede estorno)", () => {
    const r = ok({
      ...order,
      discountAmount: 450,
      paidAmount: 20,
      returns: [{ itemId: "tee", quantity: 1 }],
    });
    assert.equal(r.cents, 0);
  });
});
