import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FitRunner } from "./fit-runner";
import { MOLDE_GRADE } from "./garment-fit";
import { dress, shapeBody, type FitBody } from "./garment-dress";

const NO_MORPHS = {
  height: 0,
  weight: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  shoulder: 0,
  armLength: 0,
  legLength: 0,
};

/**
 * "Corpo" de brinquedo: uma coluna de pontos de 0 a 1,66 m e uma shape key de
 * altura que estica tudo por igual (+70 cm em +1), como a do avatar.
 */
function toyBody(): FitBody {
  const base: number[] = [];
  for (let y = 0; y <= 1.66001; y += 0.02)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      base.push(0.15 * Math.cos(a), y, 0.1 * Math.sin(a));
    }
  const b = new Float32Array(base);
  const height = b.map((v, i) => (i % 3 === 1 ? v * (0.7 / 1.66) : 0));
  const index: number[] = [];
  const rings = b.length / 3 / 8;
  for (let r = 0; r < rings - 1; r++)
    for (let k = 0; k < 8; k++) {
      const a = r * 8 + k;
      const c = r * 8 + ((k + 1) % 8);
      index.push(a, a + 8, c, c, a + 8, c + 8);
    }
  return {
    base: b,
    deltas: [height],
    keys: ["height"],
    index,
    shoulders: [0, 1, 2],
    arms: [
      { side: 1, shoulder: [0], wrist: [1] },
      { side: -1, shoulder: [0], wrist: [1] },
    ],
  };
}

const heightOf = (pos: Float32Array) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    min = Math.min(min, pos[i]);
    max = Math.max(max, pos[i]);
  }
  return { min, max };
};

describe("shapeBody", () => {
  it("resolve a shape key de altura para bater a altura pedida", () => {
    for (const h of [1.5, 1.66, 1.88]) {
      const { pos } = shapeBody(toyBody(), NO_MORPHS, h);
      const { min, max } = heightOf(pos);
      assert.ok(Math.abs(min) < 1e-6, "pés no chão");
      assert.ok(Math.abs(max - h) < 1e-4, `altura ${max} ≠ ${h}`);
    }
  });
});

describe("FitRunner", () => {
  const parts = [{ base: new Float32Array([0, 1.2, 0.2, 0.1, 1.0, 0.2]), arm: null }];

  it("sem Web Worker (aqui no Node), calcula na própria página", async () => {
    assert.equal(typeof globalThis.Worker, "undefined");
    const fitted = await new Promise<ReturnType<typeof dress>>((resolve, reject) => {
      const runner = new FitRunner(toyBody(), parts, resolve, reject);
      runner.request(NO_MORPHS, 1.75, MOLDE_GRADE);
    });
    assert.equal(fitted.cloth.length, 6);
    assert.ok(Math.abs(heightOf(fitted.body).max - 1.75) < 1e-4);
  });

  it("pedidos seguidos: só o último é calculado depois do atual", async () => {
    const heights: number[] = [];
    await new Promise<void>((resolve, reject) => {
      const runner = new FitRunner(
        toyBody(),
        parts,
        (f) => {
          heights.push(Math.round(heightOf(f.body).max * 100));
          if (heights.length === 2) resolve();
        },
        reject,
      );
      runner.request(NO_MORPHS, 1.6, MOLDE_GRADE); // começa já
      runner.request(NO_MORPHS, 1.7, MOLDE_GRADE); // pulado
      runner.request(NO_MORPHS, 1.8, MOLDE_GRADE); // o último vale
    });
    assert.deepEqual(heights, [160, 180]);
  });
});
