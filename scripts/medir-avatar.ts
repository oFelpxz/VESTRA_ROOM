/**
 * Fita métrica no avatar (lista 11, item 7).
 *
 *   npx tsx scripts/medir-avatar.ts            tabela: medida pedida × corpo
 *   npx tsx scripts/medir-avatar.ts calibrar   refaz a calibração das
 *                                              circunferências (AVATAR_CALIBRATION)
 *
 * Calibrar: sorteia 400 corpos (pesos das shape keys), mede peito, cintura e
 * quadril com a fita de src/lib/body-tape.ts e ajusta uma reta por mínimos
 * quadrados. A reta é só o primeiro palpite — `shapeBody` corrige medindo.
 */
import { buildAvatarParams, type AvatarBody, type MeasurementInput } from "../src/lib/avatar-builder";
import { makeTape, tapeGirths, TAPE_LEVELS } from "../src/lib/body-tape";
import { shapeBody } from "../src/lib/garment-dress";
import { applyMorphs } from "../src/lib/garment-fit";
import { readAvatarGlb } from "../src/lib/read-avatar-glb";

const N = { shoulderCm: null, armLengthCm: null, legLengthCm: null };
const BODIES: [string, MeasurementInput, AvatarBody][] = [
  ["padrão", { heightCm: 175, weightKg: 70, chestCm: 96, waistCm: 80, hipCm: 96, ...N }, "neutral"],
  ["magro", { heightCm: 165, weightKg: 55, chestCm: 84, waistCm: 70, hipCm: 88, ...N }, "neutral"],
  ["grande", { heightCm: 175, weightKg: 110, chestCm: 118, waistCm: 110, hipCm: 120, ...N, legLengthCm: 80 }, "neutral"],
  ["mulher", { heightCm: 165, weightKg: 62, chestCm: 94, waistCm: 72, hipCm: 102, ...N }, "female"],
  ["homem", { heightCm: 182, weightKg: 82, chestCm: 102, waistCm: 86, hipCm: 100, ...N }, "male"],
  ["alto", { heightCm: 195, weightKg: 85, chestCm: 100, waistCm: 88, hipCm: 102, ...N }, "neutral"],
];

/** Faixa sorteada de cada shape key. */
const RANGES: Record<string, [number, number]> = {
  height: [-0.35, 0.5],
  weight: [-0.7, 1],
  chest: [-0.6, 1.3],
  waist: [-0.6, 1.3],
  hip: [-0.6, 1.3],
  legLength: [-0.5, 0.4],
};
const FIT_KEYS = ["height", "weight", "chest", "waist", "hip", "male", "female"];

/** Resolve A x = b (eliminação de Gauss com pivô). */
function solve(A: number[][], b: number[]) {
  const m = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[m] / r[i]);
}

async function main() {
  const body = await readAvatarGlb("public/models/avatar_base.glb");
  const tape = makeTape(body.base, body.index);

  if (process.argv[2] === "calibrar") {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const X: number[][] = [];
    const Y: number[][] = [];
    for (let s = 0; s < 400; s++) {
      const w: Record<string, number> = {};
      for (const [k, [a, b]] of Object.entries(RANGES)) w[k] = a + rnd() * (b - a);
      const sex = rnd();
      w.male = sex < 1 / 3 ? 1 : 0;
      w.female = sex > 2 / 3 ? 1 : 0;
      const pos = applyMorphs(body.base, body.deltas, body.keys.map((k) => (k ? (w[k] ?? 0) : 0)));
      const g = tapeGirths(tape, pos);
      X.push([1, ...FIT_KEYS.map((k) => w[k])]);
      Y.push(TAPE_LEVELS.map((l) => g[l]));
    }
    const XtX = X[0].map((_, i) => X[0].map((_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
    const fit = TAPE_LEVELS.map((_, o) => {
      const b = solve(XtX, X[0].map((_, i) => X.reduce((s, r, n) => s + r[i] * Y[n][o], 0)));
      const res = X.map((r, n) => r.reduce((s, x, i) => s + x * b[i], 0) - Y[n][o]);
      const rms = Math.sqrt(res.reduce((s, x) => s + x * x, 0) / res.length);
      console.log(`${TAPE_LEVELS[o]}: resto da reta ${rms.toFixed(1)} cm (rms)`);
      return b.map((x) => Math.round(x * 10) / 10);
    });
    const per = (i: number) => Object.fromEntries(TAPE_LEVELS.map((l, o) => [l, fit[o][i]]));
    console.log("base:", JSON.stringify(per(0)));
    FIT_KEYS.forEach((k, i) => console.log(`${k}:`, JSON.stringify(per(i + 1))));
    return;
  }

  console.log("corpo      medida   pedido  calibração   corpo final");
  for (const [name, m, kind] of BODIES) {
    const params = buildAvatarParams(m, kind);
    const first = tapeGirths(tape, shapeBody(body, params.morphs, params.totalHeight).pos);
    const final = tapeGirths(tape, shapeBody(body, params.morphs, params.totalHeight, params.girths).pos);
    for (const l of TAPE_LEVELS) {
      const want = params.girths[l];
      const row = (g: number) => `${g.toFixed(1).padStart(6)} (${(g - want >= 0 ? "+" : "") + (g - want).toFixed(1)})`;
      console.log(`${name.padEnd(10)} ${l.padEnd(7)} ${want.toFixed(0).padStart(6)}  ${row(first[l])}  ${row(final[l])}`);
    }
  }
}

main();
