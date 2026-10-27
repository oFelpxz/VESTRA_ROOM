import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HAIR_STYLE, hairHeight, hairMask, hairShell, hairStyle, isHairStyle } from "./hair";

const EYE = 1.55;
const C = [0, EYE + 0.02, 0.05];
const R = 0.08;

// Cabeça de mentira: esfera em grade de latitude/longitude, normais para fora.
function head() {
  const pos: number[] = [];
  const nor: number[] = [];
  const LAT = 24;
  const LON = 32;
  for (let i = 0; i <= LAT; i++)
    for (let j = 0; j < LON; j++) {
      const th = (Math.PI * i) / LAT;
      const ph = (2 * Math.PI * j) / LON;
      const n = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      nor.push(...n);
      pos.push(C[0] + R * n[0], C[1] + R * n[1], C[2] + R * n[2]);
    }
  const idx: number[] = [];
  for (let i = 0; i < LAT; i++)
    for (let j = 0; j < LON; j++) {
      const a = i * LON + j;
      const b = i * LON + ((j + 1) % LON);
      idx.push(a, a + LON, b, b, a + LON, b + LON);
    }
  return { pos, nor, idx };
}

// Vértice mais perto da direção (x, y, z) a partir do centro.
function nearest(pos: number[], dir: number[]) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pos.length / 3; i++) {
    const d = [0, 1, 2].reduce((s, k) => s + (pos[i * 3 + k] - (C[k] + R * dir[k])) ** 2, 0);
    if (d < bestD) [best, bestD] = [i, d];
  }
  return best;
}

test("sem escolha, ou corte que não existe, vale o padrão", () => {
  assert.equal(hairStyle(null).id, DEFAULT_HAIR_STYLE);
  assert.equal(hairStyle("moicano").id, DEFAULT_HAIR_STYLE);
  assert.equal(hairStyle("none").id, "none");
  assert.equal(isHairStyle("raspado"), true);
  assert.equal(isHairStyle(2), false);
});

test("cabelo no alto e na nuca; testa e rosto ficam pele", () => {
  const { pos } = head();
  const mask = hairMask(hairHeight(pos, EYE));
  assert.equal(mask[nearest(pos, [0, 1, 0])], 1);
  assert.equal(mask[nearest(pos, [0, -0.3, -0.95])], 1, "nuca");
  assert.equal(mask[nearest(pos, [0, -0.3, 0.95])], 0, "rosto");
  assert.equal(mask[nearest(pos, [1, -0.3, 0])], 0, "orelha");
});

test("a casca é grossa no alto e encosta na pele na borda", () => {
  const { pos, nor, idx } = head();
  const shell = hairShell(pos, nor, idx, hairHeight(pos, EYE), EYE);
  assert.ok(shell.index.length > 0);
  const lift = (i: number) =>
    Math.hypot(...[0, 1, 2].map((k) => shell.position[i * 3 + k] - shell.root[i * 3 + k]));
  let top = 0;
  let edge = Infinity;
  for (let i = 0; i < shell.mask.length; i++) {
    if (shell.root[i * 3 + 1] > C[1] + R * 0.99) top = Math.max(top, lift(i));
    if (shell.mask[i] < 0.4) edge = Math.min(edge, lift(i));
  }
  assert.ok(top > 0.007, `alto ${top}`);
  assert.ok(edge < 0.001, `borda ${edge}`);
});

test("vértices repetidos no mesmo ponto sobem juntos (sem fresta na costura)", () => {
  const { pos, nor, idx } = head();
  // Duplica um vértice do alto com a normal torta, como a costura do meio.
  const v = nearest(pos, [0, 0.9, -0.43]);
  const dup = pos.length / 3;
  pos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  nor.push(1, 0, 0);
  for (let t = 0; t < idx.length; t += 3)
    if (idx[t] === v) {
      idx[t] = dup;
      break;
    }
  const shell = hairShell(pos, nor, idx, hairHeight(pos, EYE), EYE);
  const at = (i: number) => [0, 1, 2].map((k) => shell.position[i * 3 + k]);
  const same: number[][] = [];
  for (let i = 0; i < shell.mask.length; i++)
    if ([0, 1, 2].every((k) => Math.abs(shell.root[i * 3 + k] - pos[v * 3 + k]) < 1e-6)) same.push(at(i));
  assert.equal(same.length, 2);
  assert.ok(Math.hypot(...[0, 1, 2].map((k) => same[0][k] - same[1][k])) < 1e-6);
});
