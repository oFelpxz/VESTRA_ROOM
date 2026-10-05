import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRICE_OPTIONS,
  priceRangeWhere,
  type PriceWhere,
} from "./price-filter";

type Product = {
  name: string;
  basePrice: number;
  promotionalPrice: number | null;
};

/** Aplica a condição como o banco faria, para testar sem banco. */
function inBounds(value: number | null, b: { gte?: number; lte?: number }) {
  if (value === null) return false;
  return (
    (b.gte === undefined || value >= b.gte) &&
    (b.lte === undefined || value <= b.lte)
  );
}

function filter(products: Product[], where: PriceWhere | null) {
  if (!where) return products.map((p) => p.name);
  const [promo, base] = where.OR;
  return products
    .filter(
      (p) =>
        inBounds(p.promotionalPrice, promo.promotionalPrice) ||
        (p.promotionalPrice === null && inBounds(p.basePrice, base.basePrice)),
    )
    .map((p) => p.name);
}

const products: Product[] = [
  { name: "camiseta", basePrice: 150, promotionalPrice: null },
  { name: "moletom-em-promo", basePrice: 400, promotionalPrice: 180 },
  { name: "jaqueta", basePrice: 500, promotionalPrice: null },
  { name: "calca-em-promo", basePrice: 380, promotionalPrice: 300 },
];

describe("priceRangeWhere", () => {
  it("produto em promoção entra na faixa do preço promocional", () => {
    assert.deepEqual(filter(products, priceRangeWhere("ate-200")), [
      "camiseta",
      "moletom-em-promo",
    ]);
    assert.deepEqual(filter(products, priceRangeWhere("200-350")), [
      "calca-em-promo",
    ]);
  });

  it("e sai da faixa do preço base", () => {
    assert.deepEqual(filter(products, priceRangeWhere("350-mais")), [
      "jaqueta",
    ]);
  });

  it("os limites da faixa contam (R$ 200 está nas duas primeiras)", () => {
    const p = [{ name: "200", basePrice: 200, promotionalPrice: null }];
    assert.deepEqual(filter(p, priceRangeWhere("ate-200")), ["200"]);
    assert.deepEqual(filter(p, priceRangeWhere("200-350")), ["200"]);
  });

  it("sem faixa, faixa desconhecida ou nome do Object: sem filtro", () => {
    assert.equal(priceRangeWhere(undefined), null);
    assert.equal(priceRangeWhere(""), null);
    assert.equal(priceRangeWhere("ate-999"), null);
    assert.equal(priceRangeWhere("constructor"), null);
    assert.equal(priceRangeWhere("__proto__"), null);
  });

  it("toda opção da tela tem uma faixa", () => {
    for (const o of PRICE_OPTIONS) assert.ok(priceRangeWhere(o.value), o.value);
  });
});
