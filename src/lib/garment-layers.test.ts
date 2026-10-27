import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PointGrid } from "./garment-fit";
import { duplicateLayers, innerPieceMask } from "./garment-layers";

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

// Malha com os pedaços soltos (cada pedaço: tiras de triângulos do anel).
function mesh(rings: number[][]) {
  const position: number[] = [];
  const index: number[] = [];
  for (const r of rings) {
    const base = position.length / 3;
    const n = r.length / 3;
    position.push(...r);
    for (let i = 0; i + 2 < n; i++) index.push(base + i, base + i + 1, base + i + 2);
  }
  return { position, index };
}

// Pele em volta do eixo, no raio r.
function skinAt(r: number) {
  const positions = new Float32Array(ring(r, 160));
  return { grid: new PointGrid(positions, 0.025), positions };
}

describe("innerPieceMask", () => {
  const N = 160;
  const sleeve = () => ring(0.06, N, 1.3, 1.5).map((v, i) => (i % 3 === 0 ? v + 0.25 : v));

  it("numa malha só, o pedaço do par mais perto da pele sai", () => {
    const { position, index } = mesh([ring(0.2, N), ring(0.198, N), sleeve()]);
    const keep = innerPieceMask(position, index, skinAt(0.15))!;
    assert.ok(keep);
    assert.deepEqual([keep[0], keep[N], keep[2 * N]], [1, 0, 1]);
  });

  it("decide pela pele, não pela distância ao eixo", () => {
    // Capuz em pé: a pele fica do lado de fora do raio do pedaço.
    const { position, index } = mesh([ring(0.2, N), ring(0.198, N)]);
    const keep = innerPieceMask(position, index, skinAt(0.3))!;
    assert.deepEqual([keep[0], keep[N]], [0, 1]);
  });

  it("pedaço pequeno (prega, cordão) fica inteiro", () => {
    const { position, index } = mesh([ring(0.2), ring(0.198)]);
    assert.equal(innerPieceMask(position, index, skinAt(0.15)), null);
  });

  it("sem par, nada muda", () => {
    const { position, index } = mesh([ring(0.2, N)]);
    assert.equal(innerPieceMask(position, index, skinAt(0.15)), null);
  });
});
