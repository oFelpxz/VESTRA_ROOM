import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { duplicateLayers } from "./garment-layers";

// Faixa de pontos em volta do eixo, no raio r (x, y, z).
function ring(r: number, n = 24, y0 = 1, y1 = 1.5) {
  const p: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push(Math.cos(a) * r, i % 2 ? y0 : y1, Math.sin(a) * r);
  }
  return p;
}

describe("duplicateLayers", () => {
  it("o avesso (camada de dentro do par) sai", () => {
    const outer = ring(0.2);
    const inner = ring(0.198);
    assert.deepEqual([...duplicateLayers([outer, inner])], [1]);
    assert.deepEqual([...duplicateLayers([inner, outer])], [0]);
  });

  it("peças diferentes ficam todas", () => {
    const body = ring(0.2);
    const sleeve = ring(0.06, 24, 1.3, 1.5).map((v, i) => (i % 3 === 0 ? v + 0.25 : v));
    assert.equal(duplicateLayers([body, sleeve]).size, 0);
  });

  it("malha de uma peça só não muda", () => {
    assert.equal(duplicateLayers([ring(0.2)]).size, 0);
  });
});
