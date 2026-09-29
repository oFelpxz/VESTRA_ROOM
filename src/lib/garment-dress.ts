import { MathUtils, Vector3 } from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
import {
  applyMorphs,
  drape,
  makeBody,
  pushOut,
  type Grade,
} from "@/lib/garment-fit";

/**
 * Veste a peça moldada no avatar do cliente. Roda num Web Worker
 * (`garment-fit.worker.ts`) para não travar a página; por isso recebe e
 * devolve só arrays, sem objetos do three.js da cena.
 */

// Pescoço do corpo de referência (m): a peça cresce/encolhe por tamanho a
// partir daqui, para a gola continuar no lugar.
const NECK = new Vector3(0, 1.42, 0.025);
// Gola e capuz quase não mudam entre tamanhos; a largura do braço da manga
// muda menos que a do peito (fração da mudança do peito).
const COLLAR_SHARE = 0.25;
const SLEEVE_WIDTH_SHARE = 0.6;
// Ombro e pulso do lado +X do corpo de referência na pose padrão (m; o lado
// -X é espelhado), de scripts/molde/pose_lib.py. A manga cresce/encolhe em
// volta do eixo ombro → pulso, para continuar em volta do braço.
export const SHOULDER = new Vector3(0.18, 1.33, 0.02);
export const WRIST = new Vector3(0.415, 0.869, 0.088);
// Altura da axila do corpo de referência (m): o caimento do tronco começa aqui.
const ARMPIT_Y = 1.24;

export const mirror = (v: Vector3, side: number) =>
  new Vector3(v.x * side, v.y, v.z);

type MorphKey = keyof AvatarParams["morphs"];

/** Corpo de referência já em coordenadas do mundo (ver `extractBody`). */
export type FitBody = {
  base: Float32Array;
  deltas: Float32Array[];
  keys: (MorphKey | null)[];
  index: number[];
  /** Vértices do topo dos ombros: a peça segue a altura deles. */
  shoulders: number[];
  /** Vértices em volta do ombro e do pulso de cada lado (+1 / -1). */
  arms: { side: number; shoulder: number[]; wrist: number[] }[];
};

export type FitPart = {
  base: Float32Array;
  /**
   * Quanto cada vértice é manga (0 a 1), com o sinal do lado (+X / -X):
   * atributo `_BRACO` gravado por scripts/molde/posar_roupa.py. Peças sem
   * ele (camiseta) crescem inteiras a partir do pescoço.
   */
  arm: ArrayLike<number> | null;
};

export type Fitted = ReturnType<typeof dress>;

/**
 * Corpo de referência com as medidas do cliente. A altura não vai direto na
 * shape key: o peso dela é resolvido para o corpo bater a altura em metros,
 * já contando o que as outras medidas mudam. Devolve as posições com os pés
 * em y = 0, os pesos usados e quanto o corpo subiu (`lift`) para isso.
 */
export function shapeBody(
  body: Pick<FitBody, "base" | "deltas" | "keys">,
  morphs: AvatarParams["morphs"],
  totalHeight: number,
) {
  const weights = body.keys.map((k) => (k && k !== "height" ? morphs[k] : 0));
  let pos = applyMorphs(body.base, body.deltas, weights);
  const hk = body.keys.indexOf("height");
  if (hk >= 0) {
    let top = 0;
    let bottom = 0;
    for (let i = 1; i < pos.length / 3; i++) {
      if (pos[i * 3 + 1] > pos[top * 3 + 1]) top = i;
      if (pos[i * 3 + 1] < pos[bottom * 3 + 1]) bottom = i;
    }
    const h0 = pos[top * 3 + 1] - pos[bottom * 3 + 1];
    const gain = body.deltas[hk][top * 3 + 1] - body.deltas[hk][bottom * 3 + 1];
    if (gain > 0) {
      weights[hk] = MathUtils.clamp((totalHeight - h0) / gain, -1, 1);
      pos = applyMorphs(body.base, body.deltas, weights);
    }
  }
  // pés no chão
  let minY = Infinity;
  for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
  return { pos, weights, lift: -minY };
}

/**
 * Corpo com as medidas do cliente + peça no tamanho escolhido, apoiada nos
 * ombros e empurrada só onde o corpo passa do tecido.
 */
export function dress(
  body: FitBody,
  parts: FitPart[],
  morphs: AvatarParams["morphs"],
  totalHeight: number,
  grade: Grade,
) {
  const t0 = performance.now();

  // 1) corpo com as medidas, na altura do cliente e com os pés no chão
  const { pos } = shapeBody(body, morphs, totalHeight);

  // 2) quanto os ombros subiram/desceram e foram para frente/trás
  let dy = 0;
  let dz = 0;
  for (const i of body.shoulders) {
    dy += pos[i * 3 + 1] - body.base[i * 3 + 1];
    dz += pos[i * 3 + 2] - body.base[i * 3 + 2];
  }
  dy /= body.shoulders.length;
  dz /= body.shoulders.length;

  // ... e o eixo ombro → pulso de cada braço (referência e cliente)
  const track = (idx: number[], j: Vector3) => {
    const out = j.clone();
    for (const i of idx) {
      out.x += (pos[i * 3] - body.base[i * 3]) / idx.length;
      out.y += (pos[i * 3 + 1] - body.base[i * 3 + 1]) / idx.length;
      out.z += (pos[i * 3 + 2] - body.base[i * 3 + 2]) / idx.length;
    }
    return out;
  };
  const arms = new Map(
    body.arms.map((a) => {
      const s0 = mirror(SHOULDER, a.side);
      const w0 = mirror(WRIST, a.side);
      const s1 = track(a.shoulder, s0);
      const w1 = track(a.wrist, w0);
      return [
        a.side,
        { s0, d0: w0.sub(s0).normalize(), s1, d1: w1.sub(s1).normalize() },
      ];
    }),
  );

  // 3) peça no tamanho escolhido, apoiada nos ombros. Cada parte segue a sua
  // graduação (ver `sizeGrade`): o tronco alarga pelo peito até a axila,
  // pela barra embaixo e pelo ombro em cima; a gola quase não muda; o
  // comprimento cresce até a barra. A manga cresce em volta do braço do
  // cliente: comprimento ao longo do eixo, largura em volta dele.
  let hemY = NECK.y;
  for (const p of parts)
    for (let i = 0; i < p.base.length; i += 3)
      if (!p.arm || Math.abs(p.arm[i / 3]) < 0.5) hemY = Math.min(hemY, p.base[i + 1]);
  const collar = 1 + (grade.chest - 1) * COLLAR_SHARE;
  const shoulder = 1 + grade.shoulder / 2 / SHOULDER.x;
  const lerp = (a: number, b: number, t: number) =>
    a + (b - a) * MathUtils.clamp(t, 0, 1);
  const widthAt = (y: number) =>
    y >= NECK.y
      ? collar
      : y >= SHOULDER.y
        ? lerp(shoulder, collar, (y - SHOULDER.y) / (NECK.y - SHOULDER.y))
        : y >= ARMPIT_Y
          ? lerp(grade.chest, shoulder, (y - ARMPIT_Y) / (SHOULDER.y - ARMPIT_Y))
          : lerp(grade.chest, grade.hem, (ARMPIT_Y - y) / (ARMPIT_Y - hemY));
  const bodyLen = 1 + grade.length / Math.max(NECK.y - hemY, 0.1);
  const sleeveLen = 1 + grade.sleeve / SHOULDER.distanceTo(WRIST);
  const sleeveWidth = 1 + (grade.chest - 1) * SLEEVE_WIDTH_SHARE;

  const cloth = new Float32Array(parts.reduce((n, p) => n + p.base.length, 0));
  const armOf = new Float32Array(cloth.length / 3);
  const starts: number[] = [];
  const p0 = new Vector3();
  const radial = new Vector3();
  let off = 0;
  for (const p of parts) {
    starts.push(off);
    for (let i = 0; i < p.base.length; i += 3) {
      const by = p.base[i + 1];
      const wide = widthAt(by);
      const x = p.base[i] * wide;
      const y = NECK.y + (by - NECK.y) * (by >= NECK.y ? collar : bodyLen) + dy;
      const z = NECK.z + (p.base[i + 2] - NECK.z) * wide + dz;
      const a = p.arm ? p.arm[i / 3] : 0;
      armOf[(off + i) / 3] = a;
      const arm = a ? arms.get(Math.sign(a)) : undefined;
      if (!arm) {
        cloth[off + i] = x;
        cloth[off + i + 1] = y;
        cloth[off + i + 2] = z;
        continue;
      }
      p0.fromArray(p.base, i).sub(arm.s0);
      const t = p0.dot(arm.d0);
      radial.copy(p0).addScaledVector(arm.d0, -t).multiplyScalar(sleeveWidth);
      const q = radial.add(arm.s1).addScaledVector(arm.d1, t * sleeveLen);
      const w = Math.min(1, Math.abs(a));
      cloth[off + i] = x + (q.x - x) * w;
      cloth[off + i + 1] = y + (q.y - y) * w;
      cloth[off + i + 2] = z + (q.z - z) * w;
    }
    off += p.base.length;
  }

  // 4) onde o corpo passa do tecido, o tecido é empurrado ...
  const before = cloth.slice();
  const touching = pushOut(cloth, makeBody(pos, body.index));
  // 5) ... e, no tronco, desce reto a partir dali em vez de voltar para dentro
  const draped = drape(cloth, before, armOf, ARMPIT_Y + dy);

  return {
    body: pos,
    cloth,
    starts,
    touching,
    draped,
    grade,
    ms: Math.round(performance.now() - t0),
  };
}
