import { MathUtils, Vector3 } from "three";
import type { AvatarParams } from "@/lib/avatar-builder";
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
// Ribana da barra: encolhe até essa fração do raio quando o corpo deixa, e o
// corpo da peça afina até ela nessa altura acima (m).
const RIB_SQUEEZE = 0.12;
const RIB_BLEND = 0.08;

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
  options: FitOptions = NO_FIT_OPTIONS,
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
      radial.copy(p0).addScaledVector(arm.d0, -t).multiplyScalar(sleeveWidth);
      const q = radial.add(arm.s1).addScaledVector(arm.d1, t * sleeveLen);
      const w = Math.min(1, Math.abs(a));
      cloth[off + i] = x + (q.x - x) * w;
      cloth[off + i + 1] = y + (q.y - y) * w;
      cloth[off + i + 2] = z + (q.z - z) * w;
    }
    off += p.base.length;
  }

  // 4) a ribana da barra encolhe até abraçar o quadril (se o quadril for
  // maior, o passo 7 a estica de volta)
  if (options.rib > 0) squeezeRib(cloth, parts, armOf, hemY + options.rib);

  // 5) corpo mais raso que o de referência (sem busto, sem barriga): frente e
  // costas da peça recuam junto, e o tecido que sobra vai para os lados
  followBodyDepth(cloth, parts, armOf, body, pos, dz, hemY);

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
  const before = cloth.slice();
  const touching = pushOut(cloth, skin);
  // 8) ... e, no tronco, desce reto a partir dali em vez de voltar para dentro
  const draped = drape(cloth, before, armOf, ARMPIT_Y + dy);

  return {
    body: pos,
    cloth,
    starts,
    touching,
    settled,
    draped,
    grade,
    ms: Math.round(performance.now() - t0),
  };
}

/**
 * Ribana da barra: o tronco abaixo de `ribTop` (y do molde) encolhe em volta
 * do centro da barra até RIB_SQUEEZE do raio; logo acima, a peça afina até
 * ela aos poucos.
 */
function squeezeRib(
  cloth: Float32Array,
  parts: FitPart[],
  armOf: Float32Array,
  ribTop: number,
) {
  const w = new Float32Array(armOf.length);
  let cx = 0;
  let cz = 0;
  let n = 0;
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
        n++;
      }
    }
    off += p.base.length / 3;
  }
  if (!n) return;
  cx /= n;
  cz /= n;
  for (let v = 0; v < w.length; v++) {
    if (!w[v]) continue;
    const k = 1 - RIB_SQUEEZE * w[v];
    cloth[v * 3] = cx + (cloth[v * 3] - cx) * k;
    cloth[v * 3 + 2] = cz + (cloth[v * 3 + 2] - cz) * k;
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
