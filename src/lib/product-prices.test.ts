import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProductPrices } from "./product-prices";

describe("parseProductPrices", () => {
  it("aceita preço base sem promoção", () => {
    assert.deepEqual(parseProductPrices("199.90", ""), {
      basePrice: 199.9,
      promotionalPrice: null,
    });
  });

  it("aceita promoção menor que o preço base, com vírgula", () => {
    assert.deepEqual(parseProductPrices("199,90", " 149,90 "), {
      basePrice: 199.9,
      promotionalPrice: 149.9,
    });
  });

  it("recusa preço base vazio, zero, negativo ou com texto", () => {
    for (const base of ["", "0", "0.00", "-10", "abc", "10.999"]) {
      assert.ok("error" in parseProductPrices(base, ""), base);
    }
  });

  it("recusa promoção igual ou maior que o preço base", () => {
    assert.ok("error" in parseProductPrices("100", "100"));
    assert.ok("error" in parseProductPrices("100", "120"));
  });

  it("recusa promoção zero (deixaria a peça de graça) ou negativa", () => {
    assert.ok("error" in parseProductPrices("100", "0"));
    assert.ok("error" in parseProductPrices("100", "-5"));
  });

  it("recusa valor acima do que o banco guarda", () => {
    assert.ok("error" in parseProductPrices("100000000", ""));
  });
});
