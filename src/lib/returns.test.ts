import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allowedKinds,
  availableToReturn,
  canMove,
  detectImageType,
  openReasons,
  parseReturnForm,
  refundsShipping,
  summarizeReturns,
  type ReturnFormContext,
  type ReturnFormInput,
} from "./returns";

const D = { regretDays: 7, exchangeDays: 30, defectDays: 90 };
const delivered = new Date("2026-10-01T12:00:00Z");
const day = (n: number) => new Date(delivered.getTime() + n * 86_400_000);

describe("prazos de troca (item 21)", () => {
  it("dentro do arrependimento: troca ou devolução por qualquer motivo", () => {
    for (const r of ["SIZE", "COLOR", "REGRET", "OTHER", "DEFECT"] as const) {
      assert.deepEqual(allowedKinds(r, delivered, day(5), D), ["EXCHANGE", "REFUND"]);
    }
  });

  it("tamanho/cor depois de 7 dias: só troca, até 30", () => {
    assert.deepEqual(allowedKinds("SIZE", delivered, day(20), D), ["EXCHANGE"]);
    assert.deepEqual(allowedKinds("COLOR", delivered, day(31), D), []);
  });

  it("arrependimento fecha em 7 dias, defeito vai até 90 com devolução", () => {
    assert.deepEqual(allowedKinds("REGRET", delivered, day(8), D), []);
    assert.deepEqual(allowedKinds("DEFECT", delivered, day(89), D), ["EXCHANGE", "REFUND"]);
    assert.deepEqual(allowedKinds("DEFECT", delivered, day(91), D), []);
  });

  it("openReasons: nada sem data de entrega", () => {
    assert.deepEqual(openReasons(null, day(1), D), []);
    assert.deepEqual(openReasons(delivered, day(40), D), ["DEFECT"]);
  });
});

describe("availableToReturn", () => {
  it("negado e cancelado devolvem a quantidade", () => {
    const reqs = [
      { quantity: 1, status: "COMPLETED" as const },
      { quantity: 1, status: "DENIED" as const },
      { quantity: 1, status: "CANCELED" as const },
      { quantity: 1, status: "OPEN" as const },
    ];
    assert.equal(availableToReturn(3, reqs), 1);
    assert.equal(availableToReturn(2, reqs), 0);
  });
});

function input(over: Partial<ReturnFormInput> = {}): ReturnFormInput {
  return {
    quantity: "1",
    reason: "SIZE",
    reasonText: "",
    kind: "EXCHANGE",
    exchangeVariantId: "v-g",
    photoCount: 0,
    ...over,
  };
}
function ctx(over: Partial<ReturnFormContext> = {}): ReturnFormContext {
  return {
    orderStatus: "DELIVERED",
    deliveredAt: delivered,
    now: day(10),
    deadlines: D,
    available: 2,
    currentVariantId: "v-m",
    ...over,
  };
}

describe("parseReturnForm (item 21)", () => {
  it("aceita troca de tamanho dentro do prazo", () => {
    const r = parseReturnForm(input(), ctx());
    assert.ok("data" in r);
    assert.equal(r.data.exchangeVariantId, "v-g");
  });

  it("só pedido entregue", () => {
    assert.ok("error" in parseReturnForm(input(), ctx({ orderStatus: "SHIPPED" })));
  });

  it("tamanho depois de 7 dias não devolve dinheiro", () => {
    const r = parseReturnForm(input({ kind: "REFUND" }), ctx());
    assert.ok("error" in r && r.error.includes("só dá para trocar"));
  });

  it("troca exige variante diferente, exceto defeito", () => {
    assert.ok("error" in parseReturnForm(input({ exchangeVariantId: "v-m" }), ctx()));
    const defect = parseReturnForm(
      input({ reason: "DEFECT", reasonText: "Costura aberta", exchangeVariantId: "v-m", photoCount: 1 }),
      ctx(),
    );
    assert.ok("data" in defect);
  });

  it("defeito exige foto e descrição", () => {
    const noPhoto = parseReturnForm(input({ reason: "DEFECT", reasonText: "Furo na manga" }), ctx());
    assert.ok("error" in noPhoto && noPhoto.error.includes("foto"));
    const noText = parseReturnForm(input({ reason: "DEFECT", photoCount: 1 }), ctx());
    assert.ok("error" in noText);
  });

  it("no máximo 3 fotos e a quantidade disponível", () => {
    assert.ok("error" in parseReturnForm(input({ photoCount: 4 }), ctx()));
    assert.ok("error" in parseReturnForm(input({ quantity: "3" }), ctx()));
    assert.ok("error" in parseReturnForm(input(), ctx({ available: 0 })));
  });

  it("outro motivo exige texto", () => {
    const r = parseReturnForm(input({ reason: "OTHER", kind: "REFUND" }), ctx({ now: day(3) }));
    assert.ok("error" in r);
  });
});

describe("detectImageType", () => {
  it("reconhece JPG, PNG e WEBP pelos bytes", () => {
    assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(
      detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    assert.equal(detectImageType(webp), "image/webp");
    assert.equal(detectImageType(new TextEncoder().encode("<svg>")), null);
  });
});

describe("transições e frete", () => {
  it("segue o fluxo", () => {
    assert.ok(canMove("OPEN", "APPROVED"));
    assert.ok(canMove("APPROVED", "CANCELED"));
    assert.ok(!canMove("DENIED", "APPROVED"));
    assert.ok(!canMove("OPEN", "COMPLETED"));
  });

  it("frete volta no arrependimento e no defeito, uma vez", () => {
    assert.ok(refundsShipping("REGRET", false));
    assert.ok(refundsShipping("DEFECT", false));
    assert.ok(!refundsShipping("DEFECT", true));
    assert.ok(!refundsShipping("SIZE", false));
  });
});

describe("relatório de devoluções (item 24)", () => {
  const base = {
    quantity: 1,
    createdAt: day(1),
    answeredAt: null,
    approvedKind: null,
    refundAmount: null,
  } as const;

  it("conta motivos, aprovação, tempo de resposta e valor devolvido", () => {
    const s = summarizeReturns([
      { ...base, reason: "SIZE", status: "COMPLETED", approvedKind: "EXCHANGE", answeredAt: new Date(day(1).getTime() + 2 * 36e5) },
      { ...base, reason: "DEFECT", status: "COMPLETED", approvedKind: "REFUND", quantity: 2, answeredAt: new Date(day(1).getTime() + 4 * 36e5), refundAmount: 129.9 },
      { ...base, reason: "SIZE", status: "DENIED", answeredAt: new Date(day(1).getTime() + 6 * 36e5) },
      { ...base, reason: "REGRET", status: "OPEN" },
    ]);
    assert.equal(s.requests, 4);
    assert.equal(s.units, 5);
    assert.equal(s.byReason.SIZE, 2);
    assert.equal(s.byStatus.OPEN, 1);
    assert.equal(s.approved, 2);
    assert.equal(s.denied, 1);
    assert.equal(s.approvalRate, 2 / 3);
    assert.equal(s.avgAnswerHours, 4);
    assert.equal(s.refunded, 129.9);
    assert.equal(s.exchanges, 1);
  });

  it("período vazio não divide por zero", () => {
    const s = summarizeReturns([]);
    assert.equal(s.approvalRate, null);
    assert.equal(s.avgAnswerHours, null);
    assert.equal(s.refunded, 0);
  });
});
