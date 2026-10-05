import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAdminCancel,
  canCustomerCancel,
  cancelOrderInTx,
  CUSTOMER_CANCELABLE,
  shouldRestock,
  type OrderStatus,
} from "./order-cancel";

describe("quem cancela o quê", () => {
  it("cliente cancela só antes da separação", () => {
    assert.equal(canCustomerCancel("PENDING_PAYMENT"), true);
    assert.equal(canCustomerCancel("PAID"), true);
    assert.equal(canCustomerCancel("PREPARING"), false);
    assert.equal(canCustomerCancel("SHIPPED"), false);
  });

  it("Admin cancela a qualquer momento, menos o que já está encerrado", () => {
    for (const s of ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED"]) {
      assert.equal(canAdminCancel(s), true, s);
    }
    assert.equal(canAdminCancel("CANCELED"), false);
    assert.equal(canAdminCancel("REFUNDED"), false);
  });
});

describe("devolução de estoque", () => {
  it("antes do envio, sempre devolve", () => {
    assert.equal(shouldRestock("PREPARING", false), true);
  });

  it("depois do envio, só se a peça voltou", () => {
    assert.equal(shouldRestock("SHIPPED", false), false);
    assert.equal(shouldRestock("DELIVERED", true), true);
  });
});

/** Banco falso em memória, só com o que cancelOrderInTx usa. */
function fakeTx(orderStatus: OrderStatus, paymentStatus: string) {
  const db = {
    order: { status: orderStatus as string },
    payment: { status: paymentStatus },
    stock: 10,
    couponUses: 3,
  };
  const tx = {
    order: {
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (db.order.status !== where.status) return { count: 0 };
        db.order.status = data.status;
        return { count: 1 };
      },
    },
    productVariant: {
      update: async ({ data }: { data: { stockQuantity: { increment: number } } }) => {
        db.stock += data.stockQuantity.increment;
      },
    },
    coupon: {
      updateMany: async ({ where, data }: { where: { usedCount: { gt: number } }; data: { usedCount: { decrement: number } } }) => {
        if (!(db.couponUses > where.usedCount.gt)) return { count: 0 };
        db.couponUses -= data.usedCount.decrement;
        return { count: 1 };
      },
    },
    payment: {
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        if (db.payment.status !== where.status) return { count: 0 };
        db.payment.status = data.status;
        return { count: 1 };
      },
    },
  };
  return { db, tx: tx as never };
}

const order = (status: OrderStatus, couponId: string | null = null) => ({
  id: "o1",
  status,
  items: [{ productVariantId: "v1", quantity: 2 }],
  payment: { id: "p1" },
  couponId,
});

describe("cancelOrderInTx", () => {
  it("cancela, devolve estoque e reembolsa o que estava pago", async () => {
    const { db, tx } = fakeTx("PAID", "PAID");
    const ok = await cancelOrderInTx(tx, order("PAID"), {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    });
    assert.equal(ok, true);
    assert.deepEqual(db, { order: { status: "CANCELED" }, payment: { status: "REFUNDED" }, stock: 12, couponUses: 3 });
  });

  it("pagamento pendente vira falho", async () => {
    const { db, tx } = fakeTx("PENDING_PAYMENT", "PENDING");
    await cancelOrderInTx(tx, order("PENDING_PAYMENT"), {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    });
    assert.equal(db.payment.status, "FAILED");
  });

  it("clique duplo devolve o estoque uma vez só", async () => {
    const { db, tx } = fakeTx("PAID", "PAID");
    const opts = { allowedFrom: CUSTOMER_CANCELABLE, restock: true };
    const results = await Promise.all([
      cancelOrderInTx(tx, order("PAID"), opts),
      cancelOrderInTx(tx, order("PAID"), opts),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(db.stock, 12);
  });

  it("não cancela se o pedido andou depois que a tela foi aberta", async () => {
    const { db, tx } = fakeTx("SHIPPED", "PAID");
    const ok = await cancelOrderInTx(tx, order("PREPARING"), {
      allowedFrom: ["PREPARING", "SHIPPED"],
      restock: true,
    });
    assert.equal(ok, false);
    assert.deepEqual(db, { order: { status: "SHIPPED" }, payment: { status: "PAID" }, stock: 10, couponUses: 3 });
  });

  it("cliente não cancela pedido em separação", async () => {
    const { db, tx } = fakeTx("PREPARING", "PAID");
    const ok = await cancelOrderInTx(tx, order("PREPARING"), {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    });
    assert.equal(ok, false);
    assert.equal(db.stock, 10);
  });

  it("pedido com cupom devolve o uso uma vez só, mesmo com clique duplo", async () => {
    const { db, tx } = fakeTx("PAID", "PAID");
    const opts = { allowedFrom: CUSTOMER_CANCELABLE, restock: true };
    await Promise.all([
      cancelOrderInTx(tx, order("PAID", "c1"), opts),
      cancelOrderInTx(tx, order("PAID", "c1"), opts),
    ]);
    assert.equal(db.couponUses, 2);
  });

  it("não deixa o contador do cupom ficar negativo", async () => {
    const { db, tx } = fakeTx("PAID", "PAID");
    db.couponUses = 0;
    await cancelOrderInTx(tx, order("PAID", "c1"), {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    });
    assert.equal(db.couponUses, 0);
  });

  it("pedido recusado não mexe no cupom", async () => {
    const { db, tx } = fakeTx("PREPARING", "PAID");
    await cancelOrderInTx(tx, order("PREPARING", "c1"), {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    });
    assert.equal(db.couponUses, 3);
  });

  it("Admin cancela enviado sem devolver estoque se a peça não voltou", async () => {
    const { db, tx } = fakeTx("SHIPPED", "PAID");
    const ok = await cancelOrderInTx(tx, order("SHIPPED"), {
      allowedFrom: ["SHIPPED"],
      restock: shouldRestock("SHIPPED", false),
    });
    assert.equal(ok, true);
    assert.equal(db.stock, 10);
    assert.equal(db.order.status, "CANCELED");
  });
});
