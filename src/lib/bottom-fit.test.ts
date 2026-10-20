import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindBottom, bottomEase, fitBottom } from "./bottom-fit";

// Tabela da calça (scripts/attach-bottom-models.ts): quadril por tamanho.
const CHART = [
  { size: "38", hipMinCm: 92, hipMaxCm: 96 },
  { size: "40", hipMinCm: 96, hipMaxCm: 100 },
  { size: "42", hipMinCm: 100, hipMaxCm: 104 },
  { size: "44", hipMinCm: 104, hipMaxCm: 108 },
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

  it("nunca entra na pele", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, -0.05);
    close(out[1], 1.003, 1e-5);
  });

  it("debaixo da peça de cima fica rente", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, 0, 0.9);
    close(out[1], 1.004, 1e-5);
  });
});
