import { test } from "node:test";
import assert from "node:assert/strict";
import { findEyeSockets, placeEyes } from "./eye-sockets";

// Corpo de mentira: uma coluna até 1,66 m, a ponta do nariz e, se `eyes`,
// 50 pontos no fundo de cada cavidade (±3 cm, 1,553 m, 10,9 cm à frente).
function body(eyes: boolean) {
  const p: number[] = [];
  for (let y = 0; y <= 1.66; y += 0.02) p.push(0, y, 0);
  p.push(0, 1.66, 0, 0, 1.6, 0.16);
  if (eyes)
    for (const side of [1, -1])
      for (let i = 0; i < 50; i++)
        p.push(side * (0.03 + 0.01 * Math.cos(i)), 1.553 + 0.008 * Math.sin(i), 0.109 + 0.004 * Math.cos(3 * i));
  return p;
}

test("acha as duas cavidades, uma de cada lado", () => {
  const sockets = findEyeSockets(body(true));
  assert.equal(sockets.length, 2);
  for (const s of sockets) assert.equal(s.verts.length, 50);
});

test("corpo sem cavidade não ganha olho", () => {
  assert.deepEqual(findEyeSockets(body(false)), []);
});

test("o globo fica um pouco à frente do fundo da cavidade", () => {
  const base = body(true);
  const [right] = placeEyes(base, findEyeSockets(base));
  assert.ok(Math.abs(right.radius - 0.0125) < 1e-9);
  assert.ok(right.center[0] > 0.02 && right.center[0] < 0.04);
  assert.ok(right.center[2] > 0.109 && right.center[2] < 0.12);
});

test("rosto maior, globo maior; o globo acompanha o rosto", () => {
  const base = body(true);
  const sockets = findEyeSockets(base);
  const bigger = base.map((v, i) => (i % 3 === 1 ? v * 1.1 + 0.05 : v * 1.1));
  const [a] = placeEyes(base, sockets);
  const [b] = placeEyes(bigger, sockets);
  assert.ok(Math.abs(b.radius / a.radius - 1.1) < 1e-6);
  assert.ok(b.center[1] > a.center[1] + 0.1);
});
