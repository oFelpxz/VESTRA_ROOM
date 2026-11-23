import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countByStatus,
  dailyRevenue,
  parsePeriod,
  periodStart,
  spDayKey,
  startOfSpDay,
  summarizeSales,
} from "./dashboard";

describe("período", () => {
  it("aceita 7, 30 e 90; o resto vira 30", () => {
    assert.equal(parsePeriod("7"), 7);
    assert.equal(parsePeriod("90"), 90);
    assert.equal(parsePeriod("15"), 30);
    assert.equal(parsePeriod(undefined), 30);
    assert.equal(parsePeriod(["7", "90"]), 30);
  });

  it("o dia vira à meia-noite de Brasília, não à de UTC", () => {
    // 01:30 UTC de 06/10 ainda é 22:30 de 05/10 em Brasília.
    assert.equal(spDayKey(new Date("2026-10-06T01:30:00Z")), "2026-10-05");
    assert.equal(spDayKey(new Date("2026-10-06T03:00:00Z")), "2026-10-06");
    assert.equal(
      startOfSpDay(new Date("2026-10-06T01:30:00Z")).toISOString(),
      "2026-10-05T03:00:00.000Z",
    );
  });

  it("7 dias contam hoje e os 6 anteriores", () => {
    const now = new Date("2026-10-05T15:00:00Z");
    assert.equal(periodStart(now, 7).toISOString(), "2026-09-29T03:00:00.000Z");
    assert.equal(periodStart(now, 1).toISOString(), "2026-10-05T03:00:00.000Z");
  });
});

const at = (iso: string) => new Date(iso);

describe("vendas", () => {
  const orders = [
    { createdAt: at("2026-10-05T12:00:00Z"), status: "PAID", totalAmount: 100 },
    { createdAt: at("2026-10-05T13:00:00Z"), status: "DELIVERED", totalAmount: 300 },
    { createdAt: at("2026-10-04T12:00:00Z"), status: "CANCELED", totalAmount: 999 },
    { createdAt: at("2026-10-04T12:00:00Z"), status: "PENDING_PAYMENT", totalAmount: 50 },
    { createdAt: at("2026-10-03T12:00:00Z"), status: "REFUNDED", totalAmount: 70 },
  ];

  it("cancelado, reembolsado e aguardando pagamento não contam como venda", () => {
    assert.deepEqual(summarizeSales(orders), {
      revenue: 400,
      salesCount: 2,
      averageTicket: 200,
    });
  });

  it("sem vendas, ticket médio é zero (não NaN)", () => {
    assert.equal(summarizeSales([]).averageTicket, 0);
  });

  it("conta pedidos de todos os status", () => {
    assert.deepEqual(countByStatus(orders), {
      PAID: 1,
      DELIVERED: 1,
      CANCELED: 1,
      PENDING_PAYMENT: 1,
      REFUNDED: 1,
    });
  });

  it("série diária tem um dia por posição, com zero onde não vendeu", () => {
    const series = dailyRevenue(orders, at("2026-10-05T15:00:00Z"), 3);
    assert.deepEqual(series, [
      { day: "2026-10-03", revenue: 0, salesCount: 0 },
      { day: "2026-10-04", revenue: 0, salesCount: 0 },
      { day: "2026-10-05", revenue: 400, salesCount: 2 },
    ]);
  });
});
