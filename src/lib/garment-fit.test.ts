import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOLDE_GRADE,
  drape,
  makeBody,
  pushOut,
  sizeGrade,
} from "./garment-fit";

// Tabela da Boxy Tee (prisma/seed.ts): peito, quadril e braço por tamanho.
const CHART = [
  { size: "GG", chestMinCm: 107, chestMaxCm: 114, hipMinCm: 107, hipMaxCm: 113, armLengthMinCm: 66, armLengthMaxCm: 70 },
  { size: "P", chestMinCm: 86, chestMaxCm: 90, hipMinCm: 88, hipMaxCm: 94, armLengthMinCm: 56, armLengthMaxCm: 60 },
  { size: "M", chestMinCm: 91, chestMaxCm: 98, hipMinCm: 95, hipMaxCm: 100, armLengthMinCm: 60, armLengthMaxCm: 64 },
  { size: "G", chestMinCm: 99, chestMaxCm: 106, hipMinCm: 101, hipMaxCm: 106, armLengthMinCm: 63, armLengthMaxCm: 67 },
];

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

describe("sizeGrade", () => {
  it("o M é o próprio molde", () => {
    assert.deepEqual(sizeGrade("M", CHART), MOLDE_GRADE);
    assert.deepEqual(sizeGrade(null, CHART), MOLDE_GRADE);
  });

  it("cada parte segue a sua medida da tabela", () => {
    const gg = sizeGrade("GG", CHART);
    close(gg.chest, 110.5 / 94.5); // peito
    close(gg.hem, 110 / 97.5); // quadril
    close(gg.sleeve, 0.06); // braço 68 − 62 cm
    close(gg.length, 0.04); // 2 tamanhos × 2 cm
    close(gg.shoulder, 0.024); // 2 tamanhos × 1,2 cm
  });

  it("conta os tamanhos pela ordem do peito, não do cadastro", () => {
    const p = sizeGrade("P", CHART);
    close(p.length, -0.02);
    assert.ok(p.chest < 1 && p.hem < 1 && p.sleeve < 0);
  });

  it("sem quadril nem braço na tabela, usa o peito e a regra padrão", () => {
    const chart = CHART.map(({ size, chestMinCm, chestMaxCm }) => ({ size, chestMinCm, chestMaxCm }));
    const g = sizeGrade("G", chart);
    close(g.hem, g.chest);
    close(g.sleeve, 0.015);
  });

  it("sem tabela, usa a progressão padrão", () => {
    const g = sizeGrade("G", []);
    close(g.chest, 1.06);
    close(g.length, 0.02);
  });
});

/** Esfera (corpo) em volta da origem: vértices + triângulos. */
function sphere(r: number, n = 24) {
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const t = (i / n) * Math.PI;
      const p = (j / n) * 2 * Math.PI;
      pos.push(r * Math.sin(t) * Math.cos(p), r * Math.cos(t), r * Math.sin(t) * Math.sin(p));
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      const b = a + n + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b); // normais para fora
    }
  return { positions: new Float32Array(pos), index };
}

describe("pushOut", () => {
  it("empurra para fora o tecido que ficou dentro do corpo", () => {
    const { positions, index } = sphere(0.1);
    // "tecido": uma casca menor (dentro do corpo)
    const cloth = sphere(0.085, 12).positions;
    pushOut(cloth, makeBody(positions, index));
    // nenhum ponto continua dentro do corpo: todos com folga de 5 mm ou mais
    // (a meta é 8 mm; a esfera facetada deixa alguns entre 6 e 8)
    for (let i = 0; i < cloth.length; i += 3) {
      const r = Math.hypot(cloth[i], cloth[i + 1], cloth[i + 2]);
      assert.ok(r > 0.105, `ponto sem folga: r = ${r}`);
    }
  });

  it("não mexe no tecido que já está longe do corpo", () => {
    const { positions, index } = sphere(0.1);
    const cloth = sphere(0.2, 12).positions;
    const before = cloth.slice();
    pushOut(cloth, makeBody(positions, index));
    for (let i = 0; i < cloth.length; i++) close(cloth[i], before[i]);
  });
});

describe("drape", () => {
  // tubo vertical (tronco) de raio 0,2 m entre y = 0,6 e 1,2
  function tube(radius: (y: number) => number) {
    const pts: number[] = [];
    for (let y = 0.6; y <= 1.2001; y += 0.02)
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * 2 * Math.PI;
        pts.push(radius(y) * Math.cos(a), y, radius(y) * Math.sin(a));
      }
    return new Float32Array(pts);
  }

  it("abaixo do ponto empurrado, o tecido não volta para dentro", () => {
    const before = tube(() => 0.2);
    // o "quadril" empurrou 4 cm só perto de y = 0,8
    const cloth = tube((y) => 0.2 + (Math.abs(y - 0.8) < 0.03 ? 0.04 : 0));
    const arm = new Float32Array(before.length / 3);
    const moved = drape(cloth, before, arm, 1.24);
    assert.ok(moved > 0);
    for (let i = 0; i < cloth.length; i += 3) {
      const y = before[i + 1];
      const r = Math.hypot(cloth[i], cloth[i + 2]);
      if (y < 0.78) assert.ok(r > 0.238, `barra voltou para dentro em y = ${y.toFixed(2)}: r = ${r.toFixed(3)}`);
      // só na horizontal
      close(cloth[i + 1], before[i + 1]);
    }
  });

  it("não mexe nas mangas", () => {
    const before = tube(() => 0.2);
    const cloth = tube((y) => 0.2 + (Math.abs(y - 0.8) < 0.03 ? 0.04 : 0));
    const arm = new Float32Array(before.length / 3).fill(1);
    assert.equal(drape(cloth, before, arm, 1.24), 0);
  });
});
