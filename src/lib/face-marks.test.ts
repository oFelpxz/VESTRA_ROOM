import { test } from "node:test";
import assert from "node:assert/strict";
import { faceCoords, OFF_FACE } from "./face-marks";
import type { EyeBall } from "./eye-sockets";

const EYES: EyeBall[] = [
  { center: [0.03, 1.553, 0.115], radius: 0.0125 },
  { center: [-0.03, 1.553, 0.115], radius: 0.0125 },
];

// Sobrancelha direita, canto da boca esquerdo, borda do olho, nuca e umbigo.
const POINTS = [0.03, 1.575, 0.135, -0.022, 1.487, 0.14, 0.03, 1.5675, 0.115, 0, 1.55, -0.09, 0, 1.0, 0.12];

test("posição no rosto medida a partir dos olhos, igual dos dois lados", () => {
  const f = faceCoords(POINTS, EYES);
  assert.ok(Math.abs(f[0] - 0.03) < 1e-6 && Math.abs(f[1] - 0.022) < 1e-6);
  assert.ok(Math.abs(f[3] - 0.022) < 1e-6 && Math.abs(f[4] + 0.066) < 1e-6);
  // Logo acima do globo: borda da pálpebra a 2 mm.
  assert.ok(Math.abs(f[8] - 0.002) < 1e-6);
});

test("nuca e resto do corpo ficam fora do rosto", () => {
  const f = faceCoords(POINTS, EYES);
  assert.deepEqual([...f.slice(9, 12)], OFF_FACE);
  assert.deepEqual([...f.slice(12, 15)], OFF_FACE);
});

test("rosto maior: a marca acompanha (medida em tamanho de olho)", () => {
  const big = EYES.map((e) => ({ center: e.center.map((v) => v * 1.1) as EyeBall["center"], radius: e.radius * 1.1 }));
  const f = faceCoords(POINTS.map((v) => v * 1.1), big);
  assert.ok(Math.abs(f[1] - 0.022) < 1e-6);
  assert.ok(Math.abs(f[4] + 0.066) < 1e-6);
});

test("sem os dois olhos, nenhuma marca", () => {
  const f = faceCoords(POINTS, EYES.slice(0, 1));
  for (let i = 0; i < 5; i++) assert.deepEqual([...f.slice(i * 3, i * 3 + 3)], OFF_FACE);
});
