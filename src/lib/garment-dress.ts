import { MathUtils, Quaternion, Vector3 } from "three";
import { relaxArms, SHOULDER, WRIST } from "@/lib/arm-pose";
import { clampGirth, girthStep, GIRTHS, type AvatarParams } from "@/lib/avatar-builder";
import { makeTape, tapeGirths, type BodyTape } from "@/lib/body-tape";
import {
  applyMorphs,
  drape,
  makeBody,
  nearestSkin,
  pushOut,
  settle,
  type Body,
  type Grade,
} from "@/lib/garment-fit";
import type { TopHem } from "@/lib/bottom-fit";

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
// Ombro e pulso da pose padrão (ver `arm-pose.ts`). A manga cresce/encolhe
// em volta do eixo ombro → pulso, para continuar em volta do braço.
export { SHOULDER, WRIST };
// Altura da axila do corpo de referência (m): o caimento do tronco começa aqui.
const ARMPIT_Y = 1.24;
// Gancho: o ponto mais baixo do tronco no meio do corpo (x = 0), procurado
// entre essas alturas do corpo de referência (m). Ombro → gancho é o tronco.
const CROTCH_X = 0.006;
const CROTCH_Y = [0.6, 1.0];
// Folga do molde até o corpo de referência (m) em que a peça se apoia nele
// por inteiro / deixa de se apoiar (ver `settle`).
const CONTACT_NEAR = 0.012;
const CONTACT_FAR = 0.025;
// Faixa acima da axila (m) em que o apoio do tronco entra aos poucos.
const CONTACT_FADE = 0.06;
// Pele com a normal a partir desse tanto para cima apoia o tecido por inteiro.
const CONTACT_UP = 0.4;
// Abaixo dos ombros, o tamanho a mais vai quase todo para a largura: frente e
// costas são painéis planos que se apoiam no corpo. DEPTH_SHARE da mudança do
// peito vai para a profundidade e o resto para a largura, mantendo o
// perímetro (DEPTH_RATIO = profundidade ÷ largura do tronco).
const DEPTH_SHARE = 0.3;
const DEPTH_RATIO = 0.7;
// Faixas de altura (m) em que se compara a frente e as costas do corpo do
// cliente com as do corpo de referência (ver `followBodyDepth`), e a meia
// largura do tronco usada nessa comparação (fora dela, os braços).
const DEPTH_ROW = 0.02;
const TORSO_HALF_WIDTH = 0.12;
// Ribana da barra: encolhe até abraçar o quadril com RIB_EASE de folga (m),
// pelo menos RIB_SQUEEZE e no máximo RIB_MAX do raio, e o corpo da peça afina
// até ela nessa altura acima (m). O quadril é medido em RIB_SECTORS setores da
// volta, só no tronco: até HIP_HALF_WIDTH do meio no corpo de referência (fora
// disso, as mãos).
const RIB_SQUEEZE = 0.12;
const RIB_MAX = 0.3;
const RIB_EASE = 0.015;
const RIB_BLEND = 0.08;
const RIB_SECTORS = 24;
const HIP_HALF_WIDTH = 0.25;
// Barra da peça vestida, para a peça de baixo ficar por dentro dela (ver
// `hemProfile`): fatias em volta do corpo, e a faixa acima da barra (m) em que
// se mede o lado de dentro da peça.
const HEM_SECTORS = 24;
const HEM_BAND = 0.08;
// Peça apertada (tamanho pequeno para o corpo): a volta do tronco que o corpo
// esticou além de TIGHT_FREE vira altura a menos abaixo da axila, TIGHT_LIFT
// por unidade de esticão (a barra sobe), até TIGHT_MAX. O esticão é medido
// em TIGHT_BAND abaixo da axila (peito e cintura): no quadril, a peça abre
// em vez de subir. Só conta a camada de fora: o maior raio em cada faixa de
// STRETCH_ROW de altura e em cada um dos STRETCH_SECTORS setores da volta.
const TIGHT_BAND = 0.25;
const TIGHT_FREE = 0.02;
const TIGHT_LIFT = 1.2;
const TIGHT_MAX = 0.2;
const STRETCH_ROW = 0.02;
const STRETCH_SECTORS = 24;

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
  /**
   * Quanto cada vértice é braço (0 a 1), com o sinal do lado: atributo
   * `_BRACO` do avatar (scripts/molde/avatar_braco.py). Com ele, os braços
   * descem para a pose relaxada (`relaxArms`).
   */
  arm?: Float32Array | null;
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

/** O que muda de uma peça para outra, gravado no molde (ver `readFitOptions`). */
export type FitOptions = {
  /** Altura da ribana da barra (m); 0 = sem ribana. */
  rib: number;
};

export const NO_FIT_OPTIONS: FitOptions = { rib: 0 };

export type Fitted = ReturnType<typeof dress>;

// Corpo de referência (sem medidas) e, para cada ponto do molde, a folga até
// ele e o quanto a pele ali está virada para cima; calculados uma vez por
// avatar / peça.
const referenceBodies = new WeakMap<Float32Array, Body>();
const referenceContacts = new WeakMap<Float32Array, { gap: Float32Array; up: Float32Array }>();
const crotches = new WeakMap<Float32Array, number>();

/** Vértice do gancho no corpo de referência (-1 se não houver). */
function crotchOf(base: Float32Array) {
  let found = crotches.get(base);
  if (found !== undefined) return found;
  found = -1;
  for (let i = 0; i < base.length / 3; i++) {
    const y = base[i * 3 + 1];
    if (Math.abs(base[i * 3]) > CROTCH_X || y < CROTCH_Y[0] || y > CROTCH_Y[1]) continue;
    if (found < 0 || y < base[found * 3 + 1]) found = i;
  }
  crotches.set(base, found);
  return found;
}

function contactsWithReference(body: FitBody, part: FitPart) {
  let found = referenceContacts.get(part.base);
  if (found) return found;
  let ref = referenceBodies.get(body.base);
  if (!ref) {
    ref = makeBody(body.base, body.index);
    referenceBodies.set(body.base, ref);
  }
  const n = part.base.length / 3;
  found = { gap: new Float32Array(n).fill(Infinity), up: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const x = part.base[i * 3];
    const y = part.base[i * 3 + 1];
    const z = part.base[i * 3 + 2];
    const j = nearestSkin(ref, x, y, z);
    if (j < 0) continue;
    found.gap[i] =
      (x - ref.positions[j * 3]) * ref.normals[j * 3] +
      (y - ref.positions[j * 3 + 1]) * ref.normals[j * 3 + 1] +
      (z - ref.positions[j * 3 + 2]) * ref.normals[j * 3 + 2];
    found.up[i] = ref.normals[j * 3 + 1];
  }
  referenceContacts.set(part.base, found);
  return found;
}

/** Até quantas vezes a fita mede e corrige peito, cintura e quadril. */
const GIRTH_PASSES = 5;
/** Erro aceito em cada circunferência (cm). */
const GIRTH_TOLERANCE = 0.2;
const tapes = new WeakMap<Float32Array, BodyTape>();

/**
 * Corpo de referência com as medidas do cliente. A altura não vai direto na
 * shape key: o peso dela é resolvido para o corpo bater a altura em metros,
 * já contando o que as outras medidas mudam. Com `girths` (cm), a fita
 * métrica (`body-tape.ts`) mede peito, cintura e quadril na malha e corrige
 * os pesos até baterem — a calibração linear erra até ~10 cm nos corpos
 * mais longe do base. Devolve as posições com os pés em y = 0, os pesos
 * usados e quanto o corpo subiu (`lift`) para isso.
 */
export function shapeBody(
  body: Pick<FitBody, "base" | "deltas" | "keys" | "index" | "arm">,
  morphs: AvatarParams["morphs"],
  totalHeight: number,
  girths?: AvatarParams["girths"],
) {
  const weights = body.keys.map((k) => (k && k !== "height" ? morphs[k] : 0));
  const hk = body.keys.indexOf("height");
  const shape = () => {
    if (hk < 0) return applyMorphs(body.base, body.deltas, weights);
    weights[hk] = 0;
    const pos = applyMorphs(body.base, body.deltas, weights);
    let top = 0;
    let bottom = 0;
    for (let i = 1; i < pos.length / 3; i++) {
      if (pos[i * 3 + 1] > pos[top * 3 + 1]) top = i;
      if (pos[i * 3 + 1] < pos[bottom * 3 + 1]) bottom = i;
    }
    const h0 = pos[top * 3 + 1] - pos[bottom * 3 + 1];
    const gain = body.deltas[hk][top * 3 + 1] - body.deltas[hk][bottom * 3 + 1];
    if (!(gain > 0)) return pos;
    weights[hk] = MathUtils.clamp((totalHeight - h0) / gain, -1, 1);
    return applyMorphs(body.base, body.deltas, weights);
  };
  let pos = shape();
  const gk = GIRTHS.map((g) => body.keys.indexOf(g));
  if (girths && gk.every((k) => k >= 0)) {
    let tape = tapes.get(body.base);
    if (!tape) {
      tape = makeTape(body.base, body.index);
      tapes.set(body.base, tape);
    }
    for (let pass = 0; pass < GIRTH_PASSES; pass++) {
      const got = tapeGirths(tape, pos);
      const err = { chest: girths.chest - got.chest, waist: girths.waist - got.waist, hip: girths.hip - got.hip };
      if (GIRTHS.every((g) => Math.abs(err[g]) < GIRTH_TOLERANCE)) break;
      const step = girthStep(err);
      const before = gk.map((k) => weights[k]);
      GIRTHS.forEach((g, i) => (weights[gk[i]] = clampGirth(weights[gk[i]] + step[g])));
      // no limite da shape key não há o que corrigir
      if (gk.every((k, i) => weights[k] === before[i])) break;
      pos = shape();
    }
  }
  // pés no chão
  let minY = Infinity;
  for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
  for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
  // braços da pose padrão para a relaxada (lista 12, item 9)
  if (body.arm) relaxArms(pos, body.base, body.arm);
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
  options: FitOptions = NO_FIT_OPTIONS,
  girths?: AvatarParams["girths"],
) {
  const t0 = performance.now();

  // 1) corpo com as medidas, na altura do cliente e com os pés no chão
  const { pos } = shapeBody(body, morphs, totalHeight, girths);

  // 2) quanto os ombros subiram/desceram e foram para frente/trás
  let dy = 0;
  let dz = 0;
  for (const i of body.shoulders) {
    dy += pos[i * 3 + 1] - body.base[i * 3 + 1];
    dz += pos[i * 3 + 2] - body.base[i * 3 + 2];
  }
  dy /= body.shoulders.length;
  dz /= body.shoulders.length;

  // ... e quanto o tronco (ombro → gancho) ficou mais comprido: a peça
  // termina no mesmo lugar do corpo, alto ou baixo
  let torsoScale = 1;
  const crotch = crotchOf(body.base);
  if (crotch >= 0) {
    let shoulderY = 0;
    for (const i of body.shoulders) shoulderY += body.base[i * 3 + 1] / body.shoulders.length;
    const ref = shoulderY - body.base[crotch * 3 + 1];
    const now = shoulderY + dy - pos[crotch * 3 + 1];
    if (ref > 0 && now > 0) torsoScale = now / ref;
  }

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
      const d0 = w0.sub(s0).normalize();
      const d1 = w1.sub(s1).normalize();
      // o braço do cliente desceu (pose relaxada): a manga gira junto
      return [a.side, { s0, d0, s1, d1, turn: new Quaternion().setFromUnitVectors(d0, d1) }];
    }),
  );

  // 3) peça no tamanho escolhido, apoiada nos ombros. Cada parte segue a sua
  // graduação (ver `sizeGrade`): o tronco alarga pelo peito até a axila,
  // pela barra embaixo e pelo ombro em cima; a gola quase não muda; o
  // comprimento cresce até a barra e acompanha o tronco. A manga cresce em
  // volta do braço do cliente: comprimento ao longo do eixo, largura em volta
  // dele.
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
  const bodyLen = (1 + grade.length / Math.max(NECK.y - hemY, 0.1)) * torsoScale;
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
      // dos ombros para baixo, a mudança vai da profundidade para a largura
      const flat =
        MathUtils.clamp((SHOULDER.y - by) / (SHOULDER.y - ARMPIT_Y), 0, 1) *
        (1 - DEPTH_SHARE);
      const x = p.base[i] * (1 + (wide - 1) * (1 + flat * DEPTH_RATIO));
      const y = NECK.y + (by - NECK.y) * (by >= NECK.y ? collar : bodyLen) + dy;
      const z = NECK.z + (p.base[i + 2] - NECK.z) * (1 + (wide - 1) * (1 - flat)) + dz;
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
      radial.copy(p0).addScaledVector(arm.d0, -t).multiplyScalar(sleeveWidth).applyQuaternion(arm.turn);
      const q = radial.add(arm.s1).addScaledVector(arm.d1, t * sleeveLen);
      const w = Math.min(1, Math.abs(a));
      cloth[off + i] = x + (q.x - x) * w;
      cloth[off + i + 1] = y + (q.y - y) * w;
      cloth[off + i + 2] = z + (q.z - z) * w;
    }
    off += p.base.length;
  }

  // 4) corpo mais raso que o de referência (sem busto, sem barriga): frente e
  // costas da peça recuam junto, e o tecido que sobra vai para os lados
  followBodyDepth(cloth, parts, armOf, body, pos, dz, hemY);

  // 5) a ribana da barra encolhe até abraçar o quadril do cliente: na peça
  // folgada, segura a sobra (se o quadril for maior, o passo 7 a estica)
  if (options.rib > 0) squeezeRib(cloth, parts, armOf, hemY + options.rib, body, pos);

  // 6) onde o molde se apoiava no corpo de referência (ombros, costas altas,
  // mangas), a peça volta a se apoiar no corpo do cliente
  const skin = makeBody(pos, body.index);
  const goal = new Float32Array(armOf.length);
  const pull = new Float32Array(armOf.length);
  parts.forEach((p, k) => {
    const { gap, up } = contactsWithReference(body, p);
    const o = starts[k] / 3;
    for (let i = 0; i < gap.length; i++) {
      goal[o + i] = gap[i];
      // o tecido só se apoia em pele virada para cima (ombros, parte de cima
      // do braço): embaixo do braço, a manga fica pendurada
      const support = MathUtils.clamp(up[i] / CONTACT_UP, 0, 1);
      // no tronco, só acima da axila: abaixo, a peça pende (passo 5 e `drape`)
      const hanging =
        Math.abs(armOf[o + i]) < 0.5 &&
        p.base[i * 3 + 1] < ARMPIT_Y + CONTACT_FADE;
      const above = MathUtils.clamp((p.base[i * 3 + 1] - ARMPIT_Y) / CONTACT_FADE, 0, 1);
      pull[o + i] =
        MathUtils.clamp((CONTACT_FAR - gap[i]) / (CONTACT_FAR - CONTACT_NEAR), 0, 1) *
        support *
        (hanging ? above : 1);
    }
  });
  const settled = settle(cloth, skin, goal, pull);

  // 7) onde o corpo passa do tecido, o tecido é empurrado ...
  const armpit = ARMPIT_Y + dy;
  const before = cloth.slice();
  let touching = pushOut(cloth, skin);
  // ... e, se o tronco esticou (peça pequena para o corpo), o tecido encurta:
  // a barra sobe e a peça é empurrada de novo a partir daí
  // (a ribana da barra estica de volta de propósito: fica fora da medida)
  const ribLine =
    options.rib > 0 ? NECK.y + (hemY + options.rib + RIB_BLEND - NECK.y) * bodyLen + dy : -Infinity;
  const stretch = torsoStretch(before, cloth, armOf, armpit, ribLine);
  const lift = Math.min(TIGHT_MAX, Math.max(0, stretch - 1 - TIGHT_FREE) * TIGHT_LIFT);
  if (lift > 0) {
    cloth.set(before);
    rideUp(cloth, armOf, armpit, lift);
    before.set(cloth);
    touching = pushOut(cloth, skin);
  }
  // 8) ... e, no tronco, desce reto a partir dali em vez de voltar para dentro
  const draped = drape(cloth, before, armOf, armpit);
  // (indo para fora, a lateral da peça larga pode entrar no braço: um último
  // empurrão curto tira de lá)
  if (draped) touching = pushOut(cloth, skin, 0);
  const hem = hemProfile(cloth, armOf, armpit);

  return {
    body: pos,
    cloth,
    starts,
    touching,
    settled,
    draped,
    stretch,
    lift,
    grade,
    hem,
    ms: Math.round(performance.now() - t0),
  };
}

/** Quanto o tronco é tronco (1) ou manga (0), pelo atributo de manga. */
const torsoOf = (arm: number) => 1 - MathUtils.clamp(Math.abs(arm) / 0.5, 0, 1);

/**
 * Quanto a volta do tronco de TIGHT_BAND abaixo da axila (e acima de
 * `floor`) cresceu de `before` para `after` (1 = nada). Conta só a camada de
 * fora: em cada faixa de STRETCH_ROW × setor, o maior raio (o forro e o
 * capuz por dentro empurrados da pele não esticam a peça).
 */
export function torsoStretch(
  before: Float32Array,
  after: Float32Array,
  armOf: Float32Array,
  armpit: number,
  floor = -Infinity,
) {
  const inBand = (y: number) => y < armpit && y > Math.max(armpit - TIGHT_BAND, floor);
  let cz = 0;
  let n = 0;
  for (let v = 0; v < armOf.length; v++)
    if (torsoOf(armOf[v]) === 1 && inBand(before[v * 3 + 1])) {
      cz += before[v * 3 + 2];
      n++;
    }
  if (!n) return 1;
  cz /= n;
  const r0 = new Map<number, number>();
  const r1 = new Map<number, number>();
  for (let v = 0; v < armOf.length; v++) {
    const y = before[v * 3 + 1];
    if (torsoOf(armOf[v]) !== 1 || !inBand(y)) continue;
    const x = before[v * 3];
    const z = before[v * 3 + 2] - cz;
    const a = Math.atan2(z, x) / (2 * Math.PI) + 0.5;
    const bin =
      Math.floor((armpit - y) / STRETCH_ROW) * STRETCH_SECTORS +
      (Math.floor(a * STRETCH_SECTORS) % STRETCH_SECTORS);
    r0.set(bin, Math.max(r0.get(bin) ?? 0, Math.hypot(x, z)));
    r1.set(bin, Math.max(r1.get(bin) ?? 0, Math.hypot(after[v * 3], after[v * 3 + 2] - cz)));
  }
  let s0 = 0;
  let s1 = 0;
  for (const [bin, r] of r0) {
    s0 += r;
    s1 += r1.get(bin)!;
  }
  return s0 > 0 ? s1 / s0 : 1;
}

/**
 * Peça apertada sobe: o tronco abaixo da axila encolhe na altura em `lift`
 * (fração), puxando a barra para cima; a manga não mexe.
 */
export function rideUp(cloth: Float32Array, armOf: Float32Array, armpit: number, lift: number) {
  for (let v = 0; v < armOf.length; v++) {
    const y = cloth[v * 3 + 1];
    if (y >= armpit) continue;
    cloth[v * 3 + 1] = armpit + (y - armpit) * (1 - lift * torsoOf(armOf[v]));
  }
}

/**
 * Ribana da barra: o tronco abaixo de `ribTop` (y do molde) encolhe em volta
 * do centro da barra até abraçar o quadril do cliente (`pos`) com RIB_EASE de
 * folga, setor a setor, entre RIB_SQUEEZE e RIB_MAX do raio; logo acima, a
 * peça afina até ela aos poucos. Na peça folgada, a sobra fica acima da
 * ribana, em vez de a barra descer reta e longe do quadril.
 */
export function squeezeRib(
  cloth: Float32Array,
  parts: FitPart[],
  armOf: Float32Array,
  ribTop: number,
  body: Pick<FitBody, "base">,
  pos: Float32Array,
) {
  const w = new Float32Array(armOf.length);
  const rib: number[] = [];
  let cx = 0;
  let cz = 0;
  let off = 0;
  for (const p of parts) {
    for (let i = 0; i < p.base.length / 3; i++) {
      const v = off + i;
      const torso = 1 - MathUtils.clamp(Math.abs(armOf[v]) / 0.5, 0, 1);
      const t = MathUtils.smoothstep(ribTop + RIB_BLEND - p.base[i * 3 + 1], 0, RIB_BLEND);
      w[v] = torso * t;
      if (torso > 0 && p.base[i * 3 + 1] < ribTop) {
        cx += cloth[v * 3];
        cz += cloth[v * 3 + 2];
        rib.push(v);
      }
    }
    off += p.base.length / 3;
  }
  if (!rib.length) return;
  cx /= rib.length;
  cz /= rib.length;
  const sectorOf = (x: number, z: number) =>
    (Math.atan2(z - cz, x - cx) / (2 * Math.PI) + 0.5) * RIB_SECTORS;

  // raio da ribana (camada de fora) e do quadril em cada setor, na altura dela
  const outer = new Float32Array(RIB_SECTORS);
  const hip = new Float32Array(RIB_SECTORS);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of rib) {
    const x = cloth[v * 3];
    const z = cloth[v * 3 + 2];
    const s = Math.floor(sectorOf(x, z)) % RIB_SECTORS;
    outer[s] = Math.max(outer[s], Math.hypot(x - cx, z - cz));
    lo = Math.min(lo, cloth[v * 3 + 1]);
    hi = Math.max(hi, cloth[v * 3 + 1]);
  }
  for (let j = 0; j < body.base.length / 3; j++) {
    const y = pos[j * 3 + 1];
    if (y < lo || y > hi || Math.abs(body.base[j * 3]) > HIP_HALF_WIDTH) continue;
    const x = pos[j * 3];
    const z = pos[j * 3 + 2];
    const s = Math.floor(sectorOf(x, z)) % RIB_SECTORS;
    hip[s] = Math.max(hip[s], Math.hypot(x - cx, z - cz));
  }

  // quanto cada setor encolhe, suavizado entre setores vizinhos
  const keep = new Float32Array(RIB_SECTORS);
  for (let s = 0; s < RIB_SECTORS; s++)
    keep[s] =
      outer[s] > 0 && hip[s] > 0
        ? MathUtils.clamp((hip[s] + RIB_EASE) / outer[s], 1 - RIB_MAX, 1 - RIB_SQUEEZE)
        : 1 - RIB_SQUEEZE;
  const smooth = keep.map(
    (k, s) =>
      (keep[(s + RIB_SECTORS - 1) % RIB_SECTORS] + 2 * k + keep[(s + 1) % RIB_SECTORS]) / 4,
  );

  for (let v = 0; v < w.length; v++) {
    if (!w[v]) continue;
    const f = sectorOf(cloth[v * 3], cloth[v * 3 + 2]) - 0.5;
    const s0 = Math.floor(f);
    const a = smooth[(s0 + RIB_SECTORS) % RIB_SECTORS];
    const b = smooth[(s0 + 1) % RIB_SECTORS];
    const k = 1 - (1 - (a + (b - a) * (f - s0))) * w[v];
    cloth[v * 3] = cx + (cloth[v * 3] - cx) * k;
    cloth[v * 3 + 2] = cz + (cloth[v * 3 + 2] - cz) * k;
  }
}

/**
 * Barra da peça vestida (`TopHem`): o ponto mais baixo do tronco em cada uma
 * das HEM_SECTORS fatias em volta do meio dele (abaixo da axila) e o raio
 * mais curto do tronco até HEM_BAND acima dela. Fatia sem tronco (fenda da
 * barra) fica com a da vizinha. Sem tronco: null.
 */
export function hemProfile(
  cloth: Float32Array,
  armOf: Float32Array,
  armpit: number,
): TopHem | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let v = 0; v < armOf.length; v++) {
    if (Math.abs(armOf[v]) >= 0.5 || cloth[v * 3 + 1] > armpit) continue;
    x0 = Math.min(x0, cloth[v * 3]);
    x1 = Math.max(x1, cloth[v * 3]);
    z0 = Math.min(z0, cloth[v * 3 + 2]);
    z1 = Math.max(z1, cloth[v * 3 + 2]);
  }
  if (x0 > x1) return null;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const sectorOf = (v: number) => {
    const a = Math.atan2(cloth[v * 3 + 2] - cz, cloth[v * 3] - cx) / (2 * Math.PI) + 1;
    return Math.floor(a * HEM_SECTORS) % HEM_SECTORS;
  };
  const y = new Float32Array(HEM_SECTORS).fill(Infinity);
  const r = new Float32Array(HEM_SECTORS).fill(Infinity);
  for (let v = 0; v < armOf.length; v++) {
    if (Math.abs(armOf[v]) >= 0.5 || cloth[v * 3 + 1] > armpit) continue;
    const s = sectorOf(v);
    y[s] = Math.min(y[s], cloth[v * 3 + 1]);
  }
  fillGaps(y);
  for (let v = 0; v < armOf.length; v++) {
    if (Math.abs(armOf[v]) >= 0.5) continue;
    const s = sectorOf(v);
    if (cloth[v * 3 + 1] > y[s] + HEM_BAND) continue;
    r[s] = Math.min(r[s], Math.hypot(cloth[v * 3] - cx, cloth[v * 3 + 2] - cz));
  }
  fillGaps(r);
  return { cx, cz, y, r };
}

/** Fatia vazia (Infinity) fica com a menor das vizinhas, em volta. */
function fillGaps(a: Float32Array) {
  const n = a.length;
  for (let pass = 0; pass < n && a.includes(Infinity); pass++) {
    const prev = a.slice();
    for (let s = 0; s < n; s++)
      if (prev[s] === Infinity) a[s] = Math.min(prev[(s + n - 1) % n], prev[(s + 1) % n]);
  }
}

/**
 * Frente e costas da peça pendem do ponto mais saliente do corpo acima delas
 * (peito, barriga; omoplatas). Onde o cliente é mais raso que o corpo de
 * referência nesse ponto, o painel recua o mesmo tanto, em vez de manter a
 * forma do corpo de referência no ar; a largura cresce para o perímetro da
 * peça continuar o mesmo (é a sobra do tamanho). Corpo mais fundo não mexe
 * aqui: `pushOut` empurra a peça para fora.
 */
function followBodyDepth(
  cloth: Float32Array,
  parts: FitPart[],
  armOf: Float32Array,
  body: FitBody,
  pos: Float32Array,
  dz: number,
  hemY: number,
) {
  const top = ARMPIT_Y + 0.05;
  const rows = Math.ceil((top - hemY) / DEPTH_ROW) + 1;
  const rowOf = (y: number) => MathUtils.clamp((top - y) / DEPTH_ROW, 0, rows - 1);

  // 1) frente (maior z) e costas (menor z) do tronco, por faixa, nos dois corpos
  const refF = new Float32Array(rows).fill(-Infinity);
  const cliF = new Float32Array(rows).fill(-Infinity);
  const refB = new Float32Array(rows).fill(Infinity);
  const cliB = new Float32Array(rows).fill(Infinity);
  for (let j = 0; j < body.base.length / 3; j++) {
    const y = body.base[j * 3 + 1];
    if (y > top || y < hemY - DEPTH_ROW || Math.abs(body.base[j * 3]) > TORSO_HALF_WIDTH)
      continue;
    const r = Math.round(rowOf(y));
    const z0 = body.base[j * 3 + 2];
    const z1 = pos[j * 3 + 2] - dz;
    refF[r] = Math.max(refF[r], z0);
    cliF[r] = Math.max(cliF[r], z1);
    refB[r] = Math.min(refB[r], z0);
    cliB[r] = Math.min(cliB[r], z1);
  }

  // 2) o painel pende do ponto mais saliente acima: máximo (frente) / mínimo
  // (costas) acumulado de cima para baixo; recua só se o cliente for mais raso
  const front = new Float32Array(rows);
  const back = new Float32Array(rows);
  let hrF = -Infinity, hcF = -Infinity, hrB = Infinity, hcB = Infinity;
  for (let r = 0; r < rows; r++) {
    if (refF[r] !== -Infinity) {
      hrF = Math.max(hrF, refF[r]);
      hcF = Math.max(hcF, cliF[r]);
      hrB = Math.min(hrB, refB[r]);
      hcB = Math.min(hcB, cliB[r]);
    }
    front[r] = hrF === -Infinity ? 0 : Math.min(0, hcF - hrF);
    back[r] = hrB === Infinity ? 0 : Math.max(0, hcB - hrB);
  }
  const at = (g: Float32Array, f: number) => {
    const r0 = Math.floor(f);
    const r1 = Math.min(r0 + 1, rows - 1);
    return g[r0] + (g[r1] - g[r0]) * (f - r0);
  };

  // 3) centro, meia largura e meia profundidade da peça por faixa
  const baseY = new Float32Array(armOf.length);
  let off = 0;
  for (const p of parts) {
    for (let i = 0; i < p.base.length / 3; i++) baseY[off + i] = p.base[i * 3 + 1];
    off += p.base.length / 3;
  }
  const minX = new Float32Array(rows).fill(Infinity);
  const maxX = new Float32Array(rows).fill(-Infinity);
  const minZ = new Float32Array(rows).fill(Infinity);
  const maxZ = new Float32Array(rows).fill(-Infinity);
  for (let v = 0; v < armOf.length; v++) {
    if (Math.abs(armOf[v]) >= 0.5 || baseY[v] > top) continue;
    const r = Math.round(rowOf(baseY[v]));
    minX[r] = Math.min(minX[r], cloth[v * 3]);
    maxX[r] = Math.max(maxX[r], cloth[v * 3]);
    minZ[r] = Math.min(minZ[r], cloth[v * 3 + 2]);
    maxZ[r] = Math.max(maxZ[r], cloth[v * 3 + 2]);
  }

  // centro e meias medidas por faixa, sem faixas vazias e suavizados entre
  // faixas vizinhas (senão cada faixa anda um pouco diferente: degraus)
  const cx = new Float32Array(rows);
  const hx = new Float32Array(rows);
  const cz = new Float32Array(rows);
  const hz = new Float32Array(rows);
  let last = -1;
  for (let r = 0; r < rows; r++) {
    if (maxZ[r] <= minZ[r] || maxX[r] <= minX[r]) continue;
    cx[r] = (maxX[r] + minX[r]) / 2;
    hx[r] = (maxX[r] - minX[r]) / 2;
    cz[r] = (maxZ[r] + minZ[r]) / 2;
    hz[r] = (maxZ[r] - minZ[r]) / 2;
    for (let k = last + 1; k < r; k++) {
      const src = last < 0 ? r : last;
      cx[k] = cx[src]; hx[k] = hx[src]; cz[k] = cz[src]; hz[k] = hz[src];
    }
    last = r;
  }
  if (last < 0) return;
  for (let k = last + 1; k < rows; k++) {
    cx[k] = cx[last]; hx[k] = hx[last]; cz[k] = cz[last]; hz[k] = hz[last];
  }
  for (const g of [cx, hx, cz, hz]) {
    const prev = g.slice();
    for (let r = 0; r < rows; r++)
      g[r] = (prev[Math.max(r - 1, 0)] + 2 * prev[r] + prev[Math.min(r + 1, rows - 1)]) / 4;
  }

  // 4) move frente e costas; a largura compensa o perímetro
  for (let v = 0; v < armOf.length; v++) {
    const torso = 1 - MathUtils.clamp(Math.abs(armOf[v]) / 0.5, 0, 1);
    if (!torso || baseY[v] > top) continue;
    const f = rowOf(baseY[v]);
    // entra aos poucos logo abaixo de `top`
    const w = torso * MathUtils.smoothstep(top - baseY[v], 0, 0.08);
    const dF = at(front, f) * w;
    const dB = at(back, f) * w;
    if (!dF && !dB) continue;
    const rz = at(cz, f);
    const s = (cloth[v * 3 + 2] - rz) / at(hz, f);
    cloth[v * 3 + 2] += s > 0 ? dF * Math.min(1, s) : dB * Math.min(1, -s);
    const rx = at(cx, f);
    cloth[v * 3] = rx + (cloth[v * 3] - rx) * (1 + (dB - dF) / 2 / at(hx, f));
  }
}
