import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { measurementError } from "./measurement-limits";

const ok = {
  heightCm: 175,
  weightKg: 75,
  chestCm: 96,
  waistCm: 82,
  hipCm: 100,
  shoulderCm: 45,
  armLengthCm: 60,
  legLengthCm: 80,
};

describe("measurementError", () => {
  it("aceita um corpo comum e medidas em branco", () => {
    assert.equal(measurementError(ok), null);
    assert.equal(
      measurementError({ ...ok, shoulderCm: null, armLengthCm: null, legLengthCm: null }),
      null,
    );
  });

  it("aceita os extremos da faixa", () => {
    assert.equal(measurementError({ ...ok, heightCm: 100 }), null);
    assert.equal(measurementError({ ...ok, heightCm: 230 }), null);
  });

  it("recusa erro de digitação: altura em metros, peso negativo, texto", () => {
    assert.match(measurementError({ ...ok, heightCm: 1.75 }) ?? "", /^Altura: .*100 e 230 cm/);
    assert.match(measurementError({ ...ok, weightKg: -70 }) ?? "", /^Peso/);
    assert.match(measurementError({ ...ok, hipCm: NaN }) ?? "", /^Quadril/);
    assert.match(measurementError({ ...ok, chestCm: 960 }) ?? "", /^Tórax/);
  });
});
