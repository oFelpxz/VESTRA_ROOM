import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FitRunner } from "./fit-runner";
import { MOLDE_GRADE } from "./garment-fit";
import {
  dress,
  hemProfile,
  rideUp,
  shapeBody,
  squeezeRib,
  torsoStretch,
  type FitBody,
} from "./garment-dress";

const NO_MORPHS = {
  height: 0,
  weight: 0,
  chest: 0,
  waist: 0,
  hip: 0,
  shoulder: 0,
  armLength: 0,
  legLength: 0,
  male: 0,
  female: 0,
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

describe("dress", () => {
  it("a peça acompanha o tronco: no corpo alto a barra desce junto", () => {
    // ombros no anel de 1,42 m (o pescoço do molde) e gancho em 0,60 m
    const body = { ...toyBody(), shoulders: [568, 569, 570] };
    const parts = [{ base: new Float32Array([0, 1.2, 0.2, 0.1, 0.8, 0.2]), arm: null }];
    for (const h of [1.5, 1.66, 1.88]) {
      const k = h / 1.66;
      const { cloth } = dress(body, parts, NO_MORPHS, h, MOLDE_GRADE);
      assert.ok(Math.abs(cloth[4] - 0.8 * k) < 2e-3, `barra ${cloth[4]} ≠ ${0.8 * k} (${h} m)`);
    }
  });
});

describe("peça apertada", () => {
  // anel de tronco no peito (y = 1,1) e um ponto de manga
  const ring = (r: number, y = 1.1) => {
    const out: number[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 2 * Math.PI;
      out.push(r * Math.cos(a), y, r * Math.sin(a));
    }
    return out;
  };
  const armOf = new Float32Array(16);

  it("mede quanto a volta do tronco esticou no peito e na cintura", () => {
    const before = new Float32Array([...ring(0.15), ...ring(0.15, 0.8)]);
    // peito 10% maior; no quadril (fora da faixa) o dobro não conta
    const after = new Float32Array([...ring(0.165), ...ring(0.3, 0.8)]);
    assert.ok(Math.abs(torsoStretch(before, after, armOf, 1.24) - 1.1) < 1e-6);
  });

  it("o forro empurrado da pele não conta: só a camada de fora", () => {
    const before = new Float32Array([...ring(0.15), ...ring(0.1)]);
    const after = new Float32Array([...ring(0.15), ...ring(0.14)]);
    assert.ok(Math.abs(torsoStretch(before, after, armOf, 1.24) - 1) < 1e-6);
  });

  it("a barra sobe e a manga fica onde está", () => {
    const cloth = new Float32Array([0, 0.84, 0.2, 0, 1.3, 0.2, 0.4, 0.84, 0]);
    rideUp(cloth, new Float32Array([0, 0, 1]), 1.24, 0.1);
    assert.ok(Math.abs(cloth[1] - 0.88) < 1e-6, "tronco: 40 cm abaixo da axila → 36");
    assert.equal(cloth[4], Math.fround(1.3), "acima da axila não mexe");
    assert.equal(cloth[7], Math.fround(0.84), "manga não mexe");
  });
});

describe("ribana da barra", () => {
  const ring = (r: number, y = 0.9) => {
    const out: number[] = [];
    for (let k = 0; k < 24; k++) {
      const a = ((k + 0.5) / 24) * 2 * Math.PI;
      out.push(r * Math.cos(a), y, r * Math.sin(a));
    }
    return out;
  };
  const radiusAfter = (hip: number) => {
    const base = new Float32Array(ring(0.3));
    const cloth = base.slice();
    const pos = new Float32Array(ring(hip));
    squeezeRib(cloth, [{ base, arm: null }], new Float32Array(24), 1.0, { base: pos }, pos);
    return Math.hypot(cloth[0], cloth[2]);
  };

  it("abraça o quadril fino com folga, até o limite da ribana", () => {
    assert.ok(Math.abs(radiusAfter(0.2) - 0.215) < 1e-4, "quadril + 1,5 cm");
    assert.ok(Math.abs(radiusAfter(0.1) - 0.21) < 1e-4, "no máximo 30% menor");
  });

  it("quadril largo: encolhe só o mínimo (o empurrão estica depois)", () => {
    assert.ok(Math.abs(radiusAfter(0.29) - 0.264) < 1e-4);
  });
});

describe("barra da peça vestida", () => {
  // tubo de raio 0,2 entre a barra e 1,1 m; nas costas (-Z) a barra é 5 cm mais
  // baixa, e as fatias de +X (em volta do ângulo 0) não têm tecido (fenda)
  const tube: number[] = [];
  for (let k = 0; k < 48; k++) {
    const a = ((k + 0.5) / 48) * 2 * Math.PI;
    if (a < Math.PI / 12 || a > 2 * Math.PI - Math.PI / 12) continue;
    const x = 0.2 * Math.cos(a);
    const z = 0.2 * Math.sin(a);
    for (const y of [z < 0 ? 0.75 : 0.8, 0.9, 1.1]) tube.push(x, y, z);
  }
  const cloth = new Float32Array(tube);
  const hem = hemProfile(cloth, new Float32Array(cloth.length / 3), 1.24)!;

  it("altura da barra em cada fatia e o raio do lado de dentro", () => {
    assert.ok(Math.abs(hem.cx) < 0.01 && Math.abs(hem.cz) < 0.01, "meio do tubo");
    assert.ok(Math.abs(hem.y[6] - 0.8) < 1e-6, "frente (+Z)");
    assert.ok(Math.abs(hem.y[18] - 0.75) < 1e-6, "costas (-Z)");
    assert.ok(hem.r.every((r) => Math.abs(r - 0.2) < 0.01), `${hem.r}`);
  });

  it("fatia sem tecido fica com a vizinha", () => {
    assert.ok(Math.abs(hem.y[0] - 0.8) < 1e-6 && Math.abs(hem.y[23] - 0.75) < 1e-6);
  });

  it("sem tronco: nada", () => {
    assert.equal(hemProfile(cloth, new Float32Array(cloth.length / 3).fill(1), 1.24), null);
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
