import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAvatarParams,
  predictAvatarMeasurements,
  type AvatarBody,
  type MeasurementInput,
} from "./avatar-builder";
import { MEASUREMENT_LIMITS, type MeasurementField } from "./measurement-limits";

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

/**
 * Validação do 3D-05: o avatar gerado pelas medidas tem as medidas pedidas.
 * Casos-limite registrados em docs/SPRINT4-3D05.md.
 */
const BODIES: AvatarBody[] = ["neutral", "male", "female"];

const CASES: Record<string, MeasurementInput> = {
  normal: { heightCm: 175, weightKg: 75, chestCm: 96, waistCm: 82, hipCm: 100, shoulderCm: 45, armLengthCm: 60, legLengthCm: 80 },
  "baixa 1,50": { heightCm: 150, weightKg: 48, chestCm: 82, waistCm: 64, hipCm: 88, shoulderCm: 37, armLengthCm: 48, legLengthCm: 66 },
  "alto 2,00": { heightCm: 200, weightKg: 95, chestCm: 108, waistCm: 90, hipCm: 106, shoulderCm: 52, armLengthCm: 70, legLengthCm: 94 },
  magro: { heightCm: 178, weightKg: 58, chestCm: 84, waistCm: 68, hipCm: 86, shoulderCm: 42, armLengthCm: 60, legLengthCm: 82 },
  pesado: { heightCm: 175, weightKg: 130, chestCm: 125, waistCm: 120, hipCm: 125, shoulderCm: 50, armLengthCm: 60, legLengthCm: 78 },
  "quadril 130": { heightCm: 165, weightKg: 80, chestCm: 96, waistCm: 78, hipCm: 130, shoulderCm: 42, armLengthCm: 56, legLengthCm: 76 },
  "muito alto 2,20": { heightCm: 220, weightKg: 110, chestCm: 115, waistCm: 95, hipCm: 110, shoulderCm: 55, armLengthCm: 78, legLengthCm: 104 },
  "muito baixo 1,20": { heightCm: 120, weightKg: 35, chestCm: 70, waistCm: 58, hipCm: 72, shoulderCm: 32, armLengthCm: 40, legLengthCm: 52 },
};

describe("3D-05 · avatar com as medidas do cliente", () => {
  for (const body of BODIES) {
    for (const [name, m] of Object.entries(CASES)) {
      it(`${body} · ${name}: altura, circunferências, braço e perna a até 0,5 cm`, () => {
        const got = predictAvatarMeasurements(buildAvatarParams(m, body).morphs);
        const pairs: [string, number | null, number][] = [
          ["altura", m.heightCm, got.height],
          ["peito", m.chestCm, got.chest],
          ["cintura", m.waistCm, got.waist],
          ["quadril", m.hipCm, got.hip],
          ["braço", m.armLengthCm, got.arm],
          ["perna", m.legLengthCm, got.inseam],
        ];
        for (const [label, want, value] of pairs) {
          assert.ok(Math.abs(value - want!) <= 0.5, `${label}: pediu ${want}, saiu ${value.toFixed(1)}`);
        }
      });
    }
  }

  it("ombros: a shape key muda pouco, então ombro estreito sai até 4 cm mais largo", () => {
    for (const body of BODIES) {
      for (const m of Object.values(CASES)) {
        const got = predictAvatarMeasurements(buildAvatarParams(m, body).morphs);
        const diff = got.shoulder - m.shoulderCm!;
        assert.ok(diff > -0.5 && diff <= 4.1, `${body}: pediu ${m.shoulderCm}, saiu ${got.shoulder.toFixed(1)}`);
      }
    }
  });

  it("acima do que o corpo alcança, a medida para no máximo (nunca passa do pedido)", () => {
    const enorme = { ...CASES.pesado, weightKg: 150, chestCm: 160, waistCm: 150, hipCm: 160 };
    for (const body of BODIES) {
      const got = predictAvatarMeasurements(buildAvatarParams(enorme, body).morphs);
      for (const k of ["chest", "waist", "hip"] as const) {
        const want = enorme[`${k}Cm`];
        assert.ok(got[k] <= want + 0.5 && got[k] >= want - 5, `${body} ${k}: ${got[k].toFixed(1)}`);
      }
    }
  });

  it("perfil vazio ou com zeros vira o corpo de referência, sem quebrar", () => {
    const vazio = Object.fromEntries(
      Object.keys(MEASUREMENT_LIMITS).map((k) => [k, null]),
    ) as MeasurementInput;
    const zeros = Object.fromEntries(
      Object.keys(MEASUREMENT_LIMITS).map((k) => [k, 0]),
    ) as MeasurementInput;
    assert.deepEqual(buildAvatarParams(vazio).morphs, buildAvatarParams(zeros).morphs);
    assert.equal(buildAvatarParams(vazio).totalHeight, 1.7);
  });

  it("nos limites aceitos pelo perfil, todos os pesos são números dentro das faixas", () => {
    const fields = Object.keys(MEASUREMENT_LIMITS) as MeasurementField[];
    for (const edge of ["min", "max"] as const) {
      const m = Object.fromEntries(
        fields.map((f) => [f, MEASUREMENT_LIMITS[f][edge]]),
      ) as MeasurementInput;
      for (const body of BODIES) {
        for (const [k, v] of Object.entries(buildAvatarParams(m, body).morphs)) {
          assert.ok(Number.isFinite(v) && v >= -2 && v <= 2, `${edge} ${body} ${k} = ${v}`);
        }
      }
    }
  });
});
