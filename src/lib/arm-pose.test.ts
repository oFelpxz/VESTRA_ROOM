import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { CLEARANCE, RELAXED, relaxArms, SHOULDER, WRIST } from "./arm-pose";
import { applyMorphs } from "./garment-fit";
import { readAvatarGlb } from "./read-avatar-glb";

// Lista 12, item 9: o avatar de verdade (public/models/avatar_base.glb) desce
// os braços da pose padrão (30°) para a relaxada, sem encostar no tronco.

let body: Awaited<ReturnType<typeof readAvatarGlb>>;
before(async () => {
  body = await readAvatarGlb("public/models/avatar_base.glb");
});

const shape = (morphs: Record<string, number>) =>
  applyMorphs(body.base, body.deltas, body.keys.map((k) => (k ? (morphs[k] ?? 0) : 0)));

/** Ângulo (graus) do eixo ombro → pulso com a vertical, lado +X (cada
 * articulação levada pelos vértices em volta dela). O ombro sai
 * de `pivot` (o corpo antes de girar: os vértices do ombro são meio braço). */
function armAngle(pos: Float32Array, pivot = pos) {
  const mean = (j: typeof SHOULDER, from: Float32Array) => {
    const idx: number[] = [];
    for (let i = 0; i < body.base.length / 3; i++)
      if (Math.hypot(body.base[i * 3] - j.x, body.base[i * 3 + 1] - j.y, body.base[i * 3 + 2] - j.z) < 0.05)
        idx.push(i);
    return [j.x, j.y, j.z].map((c, k) => c + idx.reduce((s, i) => s + from[i * 3 + k] - body.base[i * 3 + k], 0) / idx.length);
  };
  const [a, b] = [mean(SHOULDER, pivot), mean(WRIST, pos)];
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return (Math.acos(-d[1] / Math.hypot(...d)) * 180) / Math.PI;
}

/** Menor distância (m) entre o braço inteiro e o tronco do lado +X. */
function gap(pos: Float32Array) {
  const arm = body.arm!;
  const full: number[] = [];
  const torso: number[] = [];
  for (let i = 0; i < arm.length; i++) {
    const y = body.base[i * 3 + 1];
    if (arm[i] > 0.9) full.push(i);
    else if (Math.abs(arm[i]) < 0.05 && body.base[i * 3] > 0 && y > 0.6 && y < 1.25) torso.push(i);
  }
  let best = Infinity;
  for (const i of full)
    for (const j of torso)
      best = Math.min(
        best,
        Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]),
      );
  return best;
}

describe("relaxArms", () => {
  it("o avatar tem o peso de braço dos dois lados", () => {
    const arm = body.arm!;
    assert.equal(arm.length, body.base.length / 3);
    const plus = arm.filter((w) => w > 0.5).length;
    const minus = arm.filter((w) => w < -0.5).length;
    assert.ok(plus > 1000 && plus === minus, `${plus} / ${minus}`);
  });

  it("corpo padrão: o braço desce da pose padrão até a relaxada, com folga do tronco", () => {
    const pos = shape({});
    const pivot = pos.slice();
    assert.ok(armAngle(pos) > 25);
    const turned = relaxArms(pos, body.base, body.arm!);
    const angle = armAngle(pos, pivot);
    assert.ok(Math.abs(angle - (RELAXED * 180) / Math.PI) < 1, `${angle}°`);
    assert.ok(Math.abs(turned[0] - turned[1]) < 1e-3, "os dois lados descem igual");
    assert.ok(gap(pos) >= CLEARANCE - 1e-3, `${gap(pos)} m`);
  });

  it("tronco, pernas e cabeça ficam onde estavam", () => {
    const pos = shape({});
    const before = pos.slice();
    relaxArms(pos, body.base, body.arm!);
    for (let i = 0; i < body.arm!.length; i++)
      if (body.arm![i] === 0)
        for (let k = 0; k < 3; k++) assert.equal(pos[i * 3 + k], before[i * 3 + k]);
  });

  it("corpo largo: o braço para antes de encostar no tronco", () => {
    const pos = shape({ weight: 1, chest: 1, waist: 1, hip: 1 });
    const pivot = pos.slice();
    const start = gap(pos);
    relaxArms(pos, body.base, body.arm!);
    const angle = armAngle(pos, pivot);
    assert.ok(angle > (RELAXED * 180) / Math.PI + 2, `${angle}°`);
    assert.ok(gap(pos) >= Math.min(start, CLEARANCE) - 1e-3, `${gap(pos)} m`);
  });
});
