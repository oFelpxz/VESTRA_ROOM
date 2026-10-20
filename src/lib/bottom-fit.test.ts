import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindBottom, bottomEase, bottomLength, fitBottom } from "./bottom-fit";

// Tabela da calça (scripts/attach-bottom-models.ts): quadril e perna por tamanho.
const CHART = [
  { size: "38", hipMinCm: 92, hipMaxCm: 96, legLengthMinCm: 76, legLengthMaxCm: 80 },
  { size: "40", hipMinCm: 96, hipMaxCm: 100, legLengthMinCm: 78, legLengthMaxCm: 82 },
  { size: "42", hipMinCm: 100, hipMaxCm: 104, legLengthMinCm: 80, legLengthMaxCm: 84 },
  { size: "44", hipMinCm: 104, hipMaxCm: 108, legLengthMinCm: 82, legLengthMaxCm: 86 },
];

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// Pele: um quadrado no chão (y = 1); tecido: um ponto 1 cm acima do meio.
const SKIN = new Float32Array([
  -0.01, 1, -0.01,
  0.01, 1, -0.01,
  -0.01, 1, 0.01,
  0.01, 1, 0.01,
]);
const CLOTH = new Float32Array([0, 1.01, 0]);

describe("bottomEase", () => {
  it("o 40 num quadril de 98 é o próprio molde", () => {
    close(bottomEase("40", CHART, 98), 0);
    close(bottomEase(null, CHART, 98), 0);
  });

  it("tamanho maior sobra, menor aperta", () => {
    close(bottomEase("44", CHART, 98), 8 / (2 * Math.PI) / 100);
    close(bottomEase("38", CHART, 98), -4 / (2 * Math.PI) / 100);
  });

  it("sem tabela, 4 cm de quadril por número", () => {
    close(bottomEase("42", [], 98), 4 / (2 * Math.PI) / 100);
  });

  it("sem quadril do cliente, compara com o molde", () => {
    close(bottomEase("40", CHART, null), 0);
  });
});

describe("fitBottom", () => {
  it("no corpo do molde o tecido fica onde estava", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, 0);
    close(out[0], 0);
    close(out[1], 1.01);
    close(out[2], 0);
  });

  it("acompanha a pele e soma a folga", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const moved = SKIN.map((v, i) => (i % 3 === 1 ? v + 0.1 : v));
    const out = fitBottom(binding, moved, 0.005);
    close(out[1], 1.1 + 0.015, 1e-5);
  });

  it("apertado chega no máximo a 3/4 da distância do molde", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, -0.05);
    close(out[1], 1.0075, 1e-5);
  });

  it("nunca entra na pele", () => {
    const near = new Float32Array([0, 1.004, 0]);
    const out = fitBottom(bindBottom(near, SKIN), SKIN, -0.05);
    close(out[1], 1.003, 1e-5);
  });

  it("debaixo da peça de cima fica rente", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, 0, 0.9);
    close(out[1], 1.004, 1e-5);
  });
});

describe("bindBottom longe da pele", () => {
  it("a barra solta da saia segue as duas pernas, não só a mais perto", () => {
    // Duas "pernas" (um ponto cada) a 10 cm do meio; tecido no meio, à frente.
    const legs = new Float32Array([-0.1, 0.5, 0, 0.1, 0.5, 0]);
    const cloth = new Float32Array([0.001, 0.5, 0.12]);
    const binding = bindBottom(cloth, legs);
    assert.equal(binding.start[1] - binding.start[0], 2);
    // As pernas abrem 2 cm cada: o tecido fica no meio.
    const wider = new Float32Array([-0.12, 0.5, 0, 0.12, 0.5, 0]);
    const out = fitBottom(binding, wider, 0);
    close(out[0], 0.001, 2e-3);
  });
});

describe("bottomLength", () => {
  it("perna do tamanho menos a perna do cliente", () => {
    close(bottomLength("40", CHART, 80), 0);
    close(bottomLength("44", CHART, 80), 0.04);
    close(bottomLength("38", CHART, 82), -0.04);
  });

  it("sem perna na tabela ou sem medida, não muda", () => {
    close(bottomLength("40", [{ size: "40", hipMinCm: 96, hipMaxCm: 100 }], 80), 0);
    close(bottomLength("40", CHART, null), 0);
  });

  it("no máximo 5 cm mais longa e 10 cm mais curta", () => {
    close(bottomLength("44", CHART, 60), 0.05);
    close(bottomLength("38", CHART, 100), -0.1);
  });
});

describe("fitBottom comprimento", () => {
  // Pele: um ponto na coxa (acima do entrepernas) e um no tornozelo.
  const skin = new Float32Array([0.1, 0.9, 0, 0.1, 0.1, 0]);
  const cloth = new Float32Array([0.1, 0.9, 0.02, 0.1, 0.1, 0.02]);

  it("a barra desce, a coxa fica onde estava", () => {
    const out = fitBottom(bindBottom(cloth, skin), skin, 0, null, 0.03);
    close(out[1], 0.9, 1e-5);
    close(out[4], 0.07, 1e-5);
  });

  it("mais curta: a barra sobe; mais longa: para no chão", () => {
    const binding = bindBottom(cloth, skin);
    close(fitBottom(binding, skin, 0, null, -0.05)[4], 0.15, 1e-5);
    close(fitBottom(binding, skin, 0, null, 0.2)[4], 0.005, 1e-5);
  });
});
