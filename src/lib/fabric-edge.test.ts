import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDGE_CAP, edgeDistance } from "./fabric-edge";

/** Retalho plano N×N com vértices a cada 1 cm. */
function patch(N: number) {
  const pos: number[] = [];
  const index: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pos.push(i * 0.01, j * 0.01, 0);
  for (let j = 0; j < N - 1; j++)
    for (let i = 0; i < N - 1; i++) {
      const a = j * N + i;
      index.push(a, a + 1, a + N, a + 1, a + N + 1, a + N);
    }
  return { pos, index, at: (i: number, j: number) => j * N + i };
}

const close = (a: number, b: number, msg = "") => assert.ok(Math.abs(a - b) < 1e-4, `${msg} ${a} ≠ ${b}`);

describe("edgeDistance", () => {
  it("borda = 0, e cresce para dentro", () => {
    const g = patch(11);
    const e = edgeDistance(g.pos, g.index);
    close(e[2 * g.at(0, 5)], 0, "borda");
    close(e[2 * g.at(1, 5)], 0.01, "1 cm");
    close(e[2 * g.at(3, 5)], 0.03, "3 cm");
  });

  it("para no limite", () => {
    const g = patch(21);
    const e = edgeDistance(g.pos, g.index);
    close(e[2 * g.at(10, 10)], EDGE_CAP);
  });

  it("posição ao longo da borda acompanha o contorno", () => {
    const g = patch(11);
    const e = edgeDistance(g.pos, g.index);
    // Dois vizinhos na borda ficam a 1 cm um do outro no contorno...
    close(Math.abs(e[2 * g.at(0, 5) + 1] - e[2 * g.at(0, 6) + 1]), 0.01, "na borda");
    // ...e o vértice 1 cm para dentro herda a posição da borda mais perto.
    close(e[2 * g.at(1, 5) + 1], e[2 * g.at(0, 5) + 1], "para dentro");
  });

  it("costura de UV (vértice repetido) não vira borda", () => {
    const g = patch(11);
    // Duplica a coluna do meio e faz os triângulos da direita usarem a cópia.
    const copies = new Map<number, number>();
    for (let j = 0; j < 11; j++) {
      const v = g.at(5, j);
      copies.set(v, g.pos.length / 3);
      g.pos.push(g.pos[3 * v], g.pos[3 * v + 1], g.pos[3 * v + 2]);
    }
    for (let t = 0; t < g.index.length; t += 3) {
      const tri = g.index.slice(t, t + 3);
      if (tri.some((v) => v % 11 > 5)) for (let k = 0; k < 3; k++) g.index[t + k] = copies.get(tri[k]) ?? tri[k];
    }
    const e = edgeDistance(g.pos, g.index, 0.1);
    close(e[2 * g.at(5, 5)], 0.05, "meio");
    close(e[2 * copies.get(g.at(5, 5))!], 0.05, "cópia");
  });
});
