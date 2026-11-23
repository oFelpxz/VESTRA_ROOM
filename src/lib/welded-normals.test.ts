import { test } from "node:test";
import assert from "node:assert/strict";
import { weldedNormals } from "./welded-normals";

// Telhado de duas águas (cumeeira em x = 0) com a cumeeira duplicada, como
// a costura do corpo: cada água tem os próprios vértices no meio.
function roof() {
  // Água esquerda: 0 (-1,0,0) 1 (-1,0,1) 2 (0,1,0) 3 (0,1,1)
  // Água direita:  4 (0,1,0)  5 (0,1,1)  6 (1,0,0) 7 (1,0,1)
  const pos = [-1, 0, 0, -1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1];
  const idx = [0, 2, 1, 1, 2, 3, 4, 6, 7, 4, 7, 5];
  return { pos, idx };
}

const vec = (a: Float32Array, i: number) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];

test("as cópias da costura ganham a mesma normal, a média das duas águas", () => {
  const { pos, idx } = roof();
  const n = weldedNormals(pos, idx);
  for (const [a, b] of [[2, 4], [3, 5]]) {
    const [na, nb] = [vec(n, a), vec(n, b)];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(na[k] - nb[k]) < 1e-6);
    // Cumeeira: aponta para cima (sinal pela ordem dos triângulos).
    assert.ok(Math.abs(Math.abs(na[1]) - 1) < 1e-6, `cumeeira ${na}`);
  }
});

test("longe da costura a normal é a da própria água", () => {
  const { pos, idx } = roof();
  const n = weldedNormals(pos, idx);
  const left = vec(n, 0);
  const s = Math.SQRT1_2;
  assert.ok(Math.abs(Math.abs(left[0]) - s) < 1e-6 && Math.abs(Math.abs(left[1]) - s) < 1e-6);
  assert.ok(Math.hypot(...left) > 0.999);
});
