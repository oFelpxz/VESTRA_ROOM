import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAvatarParams } from "./avatar-builder";

const body = {
  heightCm: 175,
  weightKg: 75,
  chestCm: 96,
  waistCm: 82,
  hipCm: 100,
  shoulderCm: null,
  armLengthCm: null,
  legLengthCm: null,
};

describe("buildAvatarParams", () => {
  it("sem ombro, braço e perna, esses comprimentos só acompanham a altura", () => {
    const { morphs } = buildAvatarParams(body);
    assert.equal(morphs.shoulder, 0);
    assert.equal(morphs.armLength, 0);
    assert.equal(morphs.legLength, 0);
  });

  it("perna longa cresce pela perna, não pelo corpo inteiro", () => {
    const normal = buildAvatarParams({ ...body, legLengthCm: 80 }).morphs;
    const longa = buildAvatarParams({ ...body, legLengthCm: 86 }).morphs;
    assert.ok(longa.legLength > normal.legLength);
    // mesma altura total: o resto do corpo encolhe para compensar
    assert.ok(longa.height < normal.height);
  });

  it("pessoa mais alta com as mesmas medidas não fica mais larga", () => {
    const baixa = buildAvatarParams({ ...body, heightCm: 160 }).morphs;
    const alta = buildAvatarParams({ ...body, heightCm: 190 }).morphs;
    assert.ok(alta.height > baixa.height);
    // a altura já aumenta as circunferências: as shape keys descontam isso
    assert.ok(alta.chest < baixa.chest);
    assert.ok(alta.waist < baixa.waist);
    assert.ok(alta.hip < baixa.hip);
  });

  it("homem e mulher: liga o corpo e desconta o que ele já muda", () => {
    const neutro = buildAvatarParams(body).morphs;
    const homem = buildAvatarParams(body, "male").morphs;
    const mulher = buildAvatarParams(body, "female").morphs;
    assert.deepEqual([neutro.male, neutro.female], [0, 0]);
    assert.deepEqual([homem.male, homem.female], [1, 0]);
    assert.deepEqual([mulher.male, mulher.female], [0, 1]);
    // o corpo masculino já tem mais peito e é mais alto: as medidas compensam
    assert.ok(homem.chest < neutro.chest && neutro.chest < mulher.chest);
    assert.ok(homem.height < neutro.height && neutro.height < mulher.height);
  });

  it("todos os pesos ficam dentro dos limites das shape keys", () => {
    const extremo = buildAvatarParams({
      heightCm: 210,
      weightKg: 160,
      chestCm: 150,
      waistCm: 150,
      hipCm: 160,
      shoulderCm: 112,
      armLengthCm: 90,
      legLengthCm: 110,
    }).morphs;
    for (const [k, v] of Object.entries(extremo)) {
      assert.ok(Number.isFinite(v), k);
      assert.ok(v >= -2 && v <= 2, `${k} = ${v}`);
    }
  });
});
