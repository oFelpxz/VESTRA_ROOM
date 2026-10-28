import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { buildAvatarParams, type AvatarBody, type MeasurementInput } from "./avatar-builder";
import { makeTape, tapeGirths } from "./body-tape";
import { mirror, shapeBody, SHOULDER, WRIST } from "./garment-dress";
import { readAvatarGlb } from "./read-avatar-glb";

// Lista 11, item 7: o corpo do avatar de verdade (public/models/avatar_base.glb)
// tem as medidas que o cliente digitou, conferidas com a fita na malha.

const N = { shoulderCm: null, armLengthCm: null, legLengthCm: null };
const BODIES: [string, MeasurementInput, AvatarBody][] = [
  ["padrão", { heightCm: 175, weightKg: 70, chestCm: 96, waistCm: 80, hipCm: 96, ...N }, "neutral"],
  ["magro", { heightCm: 165, weightKg: 55, chestCm: 84, waistCm: 70, hipCm: 88, ...N }, "neutral"],
  ["grande", { heightCm: 175, weightKg: 110, chestCm: 118, waistCm: 110, hipCm: 120, ...N, legLengthCm: 80 }, "neutral"],
  ["mulher", { heightCm: 165, weightKg: 62, chestCm: 94, waistCm: 72, hipCm: 102, ...N }, "female"],
  ["homem", { heightCm: 182, weightKg: 82, chestCm: 102, waistCm: 86, hipCm: 100, ...N }, "male"],
  ["alto", { heightCm: 195, weightKg: 85, chestCm: 100, waistCm: 88, hipCm: 102, ...N }, "neutral"],
  ["baixa", { heightCm: 152, weightKg: 50, chestCm: 82, waistCm: 64, hipCm: 90, shoulderCm: 38, armLengthCm: 50, legLengthCm: 70 }, "female"],
  ["completo", { heightCm: 178, weightKg: 76, chestCm: 98, waistCm: 82, hipCm: 97, shoulderCm: 47, armLengthCm: 60, legLengthCm: 82 }, "male"],
];

let body: Awaited<ReturnType<typeof readAvatarGlb>>;
before(async () => {
  body = await readAvatarGlb("public/models/avatar_base.glb");
});

const near = (pos: Float32Array, idx: number[]) =>
  [0, 1, 2].map((k) => idx.reduce((s, i) => s + pos[i * 3 + k], 0) / idx.length);

/** Comprimentos (cm) como em scripts/molde/avatar_comprimentos.py. */
function lengths(pos: Float32Array) {
  const { base } = body;
  const n = base.length / 3;
  const all = Array.from({ length: n }, (_, i) => i);
  let floor = Infinity;
  for (let i = 0; i < n; i++) floor = Math.min(floor, base[i * 3 + 1]);
  const around = (p: { x: number; y: number; z: number }) =>
    all.filter((i) => Math.hypot(base[i * 3] - p.x, base[i * 3 + 1] - p.y, base[i * 3 + 2] - p.z) < 0.05);
  const midline = all.filter(
    (i) => Math.abs(base[i * 3]) < 0.012 && base[i * 3 + 1] - floor > 0.55 && base[i * 3 + 1] - floor < 1,
  );
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, pos[i * 3 + 1]);
    hi = Math.max(hi, pos[i * 3 + 1]);
  }
  const arm = [1, -1].map((side) => {
    const a = near(pos, around(mirror(SHOULDER, side)));
    const b = near(pos, around(mirror(WRIST, side)));
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  });
  return {
    height: (hi - lo) * 100,
    inseam: (Math.min(...midline.map((i) => pos[i * 3 + 1])) - lo) * 100,
    arm: ((arm[0] + arm[1]) / 2) * 100,
  };
}

describe("o corpo do avatar bate com as medidas (erro < 1 cm)", () => {
  for (const [name, m, kind] of BODIES)
    it(name, () => {
      const params = buildAvatarParams(m, kind);
      // Medido na pose do molde: na relaxada (lista 12, item 9) a axila desce
      // junto com o braço e a fita do peito passa por ela.
      const { pos } = shapeBody({ ...body, arm: null }, params.morphs, params.totalHeight, params.girths);
      const got = { ...tapeGirths(makeTape(body.base, body.index), pos), ...lengths(pos) };
      const want = {
        chest: m.chestCm,
        waist: m.waistCm,
        hip: m.hipCm,
        height: m.heightCm,
        inseam: m.legLengthCm,
        arm: m.armLengthCm,
      };
      for (const [k, w] of Object.entries(want)) {
        if (w == null) continue;
        const g = got[k as keyof typeof got];
        assert.ok(Math.abs(g - w) < 1, `${k}: pedido ${w}, corpo ${g.toFixed(1)}`);
      }
    });
});
