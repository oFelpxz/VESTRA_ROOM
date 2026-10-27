import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frameBody, STUDIO_FOV } from "./studio-frame";

/** Parte da altura e da largura da tela que o corpo ocupa, vista de frente. */
function fill(height: number, aspect: number) {
  const { dist } = frameBody(height, aspect);
  const view = 2 * dist * Math.tan((STUDIO_FOV * Math.PI) / 360);
  return { h: height / view, w: (height * 0.58) / (view * aspect) };
}

describe("enquadramento do corpo (lista 11, item 9)", () => {
  it("qualquer altura ocupa a mesma parte da tela", () => {
    const fills = [1.45, 1.52, 1.75, 1.95, 2.05].map((h) => fill(h, 1).h);
    for (const f of fills) assert.ok(Math.abs(f - fills[0]) < 1e-9);
    assert.ok(fills[0] > 0.75 && fills[0] < 0.85, `corpo ocupa ${fills[0]}`);
  });

  it("os braços abertos cabem na tela estreita (dois tamanhos lado a lado)", () => {
    for (const aspect of [0.35, 0.5, 0.6])
      for (const h of [1.52, 1.95]) {
        const f = fill(h, aspect);
        assert.ok(f.w < 0.9, `aspecto ${aspect}, ${h} m: braços em ${(f.w * 100).toFixed(0)}% da largura`);
        assert.ok(f.h <= 0.81);
      }
  });

  it("tela larga não afasta a câmera", () => {
    assert.equal(frameBody(1.75, 2.2).dist, frameBody(1.75, 1).dist);
  });

  it("mira no meio do corpo", () => {
    const home = frameBody(1.95, 1);
    assert.equal(home.targetY, 0.975);
    assert.ok(home.y > home.targetY);
  });
});
