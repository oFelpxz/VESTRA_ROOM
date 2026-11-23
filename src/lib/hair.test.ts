import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HAIR_STYLE, hairEdge, hairHeight, hairShell, hairStyle, isHairStyle } from "./hair";

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
  const above = hairHeight(pos, EYE);
  assert.ok(above[nearest(pos, [0, 1, 0])] > 0.01);
  assert.ok(above[nearest(pos, [0, -0.3, -0.95])] > 0.01, "nuca");
  assert.ok(above[nearest(pos, [0, -0.3, 0.95])] < -0.01, "rosto");
  assert.ok(above[nearest(pos, [1, -0.3, 0])] < -0.01, "orelha");
});

test("a casca é grossa no alto e encosta na pele na borda", () => {
  const { pos, nor, idx } = head();
  const shell = hairShell(pos, nor, idx, hairHeight(pos, EYE), EYE);
  assert.ok(shell.index.length > 0);
  const lift = (i: number) =>
    Math.hypot(...[0, 1, 2].map((k) => shell.position[i * 3 + k] - shell.root[i * 3 + k]));
  let top = 0;
  let edge = 0;
  for (let i = 0; i < shell.above.length; i++) {
    if (shell.root[i * 3 + 1] > C[1] + R * 0.99) top = Math.max(top, lift(i));
    if (shell.above[i] < 0) edge = Math.max(edge, lift(i));
  }
  assert.ok(top > 0.007, `alto ${top}`);
  // 0,6 mm da pele, mais a curva que a subdivisão devolve ao triângulo reto.
  assert.ok(edge < 0.0012, `borda ${edge}`);
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
  for (let i = 0; i < shell.above.length; i++)
    if ([0, 1, 2].every((k) => Math.abs(shell.root[i * 3 + k] - pos[v * 3 + k]) < 1e-6)) same.push(at(i));
  assert.equal(same.length, 2);
  assert.ok(Math.hypot(...[0, 1, 2].map((k) => same[0][k] - same[1][k])) < 1e-6);
});

test("a borda vai para o shader como distância, limitada (lista 12)", () => {
  assert.deepEqual([...hairEdge([0.001, -0.002, 0.5, -Infinity])], [0.001, -0.002, 0.05, -0.05].map(Math.fround));
});

test("casca redonda: o meio das arestas sobe até a curva da cabeça (sem gomos)", () => {
  const { pos, nor, idx } = head();
  // Tudo cabelo e bem acima do olho: a espessura é a mesma em toda a casca.
  const shell = hairShell(pos, nor, idx, new Float32Array(pos.length / 3).fill(1), EYE - 1);
  const r: number[] = [];
  for (let i = 0; i < shell.above.length; i++)
    r.push(Math.hypot(...[0, 1, 2].map((k) => shell.position[i * 3 + k] - C[k])));
  assert.ok(r.length > 3 * (pos.length / 3));
  assert.ok(Math.max(...r) - Math.min(...r) < 0.00015, `variação ${Math.max(...r) - Math.min(...r)}`);
});

test("o fio sai do redemoinho: na testa vai para a frente, na nuca para baixo, sempre na superfície", () => {
  const { pos, nor, idx } = head();
  const shell = hairShell(pos, nor, idx, hairHeight(pos, EYE), EYE);
  const at = (dir: number[]) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < shell.above.length; i++) {
      const d = [0, 1, 2].reduce((s, k) => s + (shell.root[i * 3 + k] - (C[k] + R * dir[k])) ** 2, 0);
      if (d < bestD) [best, bestD] = [i, d];
    }
    return best;
  };
  const t = (i: number) => [0, 1, 2].map((k) => shell.tangent[i * 4 + k]);
  const front = t(at([0, 0.5, 0.87]));
  const back = t(at([0, -0.2, -0.98]));
  assert.ok(front[2] > 0.3 || front[1] < -0.3, `testa ${front}`);
  assert.ok(back[1] < -0.8, `nuca ${back}`);
  for (let i = 0; i < shell.above.length; i++) {
    const n = [0, 1, 2].map((k) => shell.normal[i * 3 + k]);
    const d = t(i).reduce((s, v, k) => s + v * n[k], 0);
    assert.ok(Math.abs(d) < 1e-5);
  }
});
