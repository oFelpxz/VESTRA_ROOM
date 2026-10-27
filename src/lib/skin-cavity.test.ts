import { test } from "node:test";
import assert from "node:assert/strict";
import { surfaceCavity } from "./skin-cavity";

// Grade 5×5 no plano XZ, normal +Y; altura = k·d² (k > 0 tigela, k < 0 calombo).
function grid(k: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  for (let z = 0; z < 5; z++)
    for (let x = 0; x < 5; x++) {
      pos.push(x, k * ((x - 2) ** 2 + (z - 2) ** 2), z);
      nor.push(0, 1, 0);
    }
  const idx: number[] = [];
  for (let z = 0; z < 4; z++)
    for (let x = 0; x < 4; x++) {
      const a = z * 5 + x;
      idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
    }
  return { pos, idx, nor };
}

test("superfície lisa não tem dobra", () => {
  const { pos, idx, nor } = grid(0);
  assert.ok(surfaceCavity(pos, idx, nor).every((v) => v === 0));
});

test("o fundo de uma tigela é dobra; o alto de um calombo, não", () => {
  const hole = grid(0.15);
  assert.ok(surfaceCavity(hole.pos, hole.idx, hole.nor)[12] > 0.5);
  const bump = grid(-0.15);
  assert.equal(surfaceCavity(bump.pos, bump.idx, bump.nor)[12], 0);
});

test("não depende do tamanho do corpo", () => {
  const a = grid(0.1);
  const b = { ...a, pos: a.pos.map((v) => v * 0.01) };
  const ca = surfaceCavity(a.pos, a.idx, a.nor);
  const cb = surfaceCavity(b.pos, b.idx, b.nor);
  for (let i = 0; i < ca.length; i++) assert.ok(Math.abs(ca[i] - cb[i]) < 1e-5);
});

test("fica entre 0 e 1", () => {
  const { pos, idx, nor } = grid(5);
  for (const v of surfaceCavity(pos, idx, nor)) assert.ok(v >= 0 && v <= 1);
});
