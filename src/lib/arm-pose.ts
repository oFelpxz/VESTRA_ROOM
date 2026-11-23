import { Quaternion, Vector3 } from "three";

/**
 * Pose relaxada (lista 12, item 9): o avatar e as roupas são moldados com os
 * braços a 30° da vertical (pose padrão, scripts/molde/pose_lib.py), longe do
 * tronco para o tecido não grudar. Na foto, braço aberto assim parece manequim
 * de loja. Aqui o braço desce até RELAXED da vertical, girando no ombro: cada
 * vértice gira na proporção do seu peso de braço (atributo `_BRACO` do avatar,
 * bone heat do Blender, ver scripts/molde/avatar_braco.py), e a axila, com
 * peso no meio, acompanha só em parte.
 *
 * O braço só desce enquanto sobra CLEARANCE entre ele e o tronco: no corpo
 * largo, ou com o quadril largo, ele para antes (ou fica onde estava), para
 * a manga do moletom não entrar no corpo da peça. Regras puras, sem cena.
 */

// Ombro e pulso do lado +X do corpo de referência na pose padrão (m; o lado
// -X é espelhado), de scripts/molde/pose_lib.py.
export const SHOULDER = new Vector3(0.18, 1.33, 0.02);
export const WRIST = new Vector3(0.415, 0.869, 0.088);

/** Ângulo do braço relaxado, a partir da vertical. */
export const RELAXED = (12 * Math.PI) / 180;
/** Menor distância (m) entre o braço e o tronco depois de descer. */
export const CLEARANCE = 0.06;
// Vértices que acompanham a articulação quando as medidas mudam (m).
const JOINT_RADIUS = 0.05;
// Braço "inteiro" (peso acima disso) e tronco (abaixo disso) na medida da folga.
const ARM_FULL = 0.9;
const TORSO_MAX = 0.05;
// Faixa do tronco em que o braço pode encostar (m, corpo de referência):
// do quadril (onde fica a mão) até a axila.
const TORSO_Y = [0.6, 1.25] as const;
// Passos da busca do maior giro que respeita a folga.
const SEARCH_STEPS = 8;

type Side = {
  shoulder: number[];
  wrist: number[];
  /** Todos os vértices que giram (peso > 0) e os do braço inteiro. */
  moving: number[];
  full: number[];
  torso: number[];
};

const sidesOf = new WeakMap<Float32Array, Side[]>();

function sides(base: Float32Array, arm: ArrayLike<number>): Side[] {
  let out = sidesOf.get(base);
  if (out) return out;
  const v = new Vector3();
  out = [1, -1].map((s) => {
    const sh = SHOULDER.clone().setX(SHOULDER.x * s);
    const wr = WRIST.clone().setX(WRIST.x * s);
    const side: Side = { shoulder: [], wrist: [], moving: [], full: [], torso: [] };
    for (let i = 0; i < base.length / 3; i++) {
      v.fromArray(base, i * 3);
      const w = arm[i] * s;
      if (v.distanceTo(sh) < JOINT_RADIUS) side.shoulder.push(i);
      if (v.distanceTo(wr) < JOINT_RADIUS) side.wrist.push(i);
      if (w > 0) side.moving.push(i);
      if (w > ARM_FULL) side.full.push(i);
      else if (Math.abs(arm[i]) < TORSO_MAX && v.x * s > 0 && v.y > TORSO_Y[0] && v.y < TORSO_Y[1])
        side.torso.push(i);
    }
    return side;
  });
  sidesOf.set(base, out);
  return out;
}

/** Articulação do corpo de referência levada pelos vértices em volta dela. */
function track(pos: ArrayLike<number>, base: Float32Array, idx: number[], joint: Vector3) {
  const out = joint.clone();
  for (const i of idx) {
    out.x += (pos[i * 3] - base[i * 3]) / idx.length;
    out.y += (pos[i * 3 + 1] - base[i * 3 + 1]) / idx.length;
    out.z += (pos[i * 3 + 2] - base[i * 3 + 2]) / idx.length;
  }
  return out;
}

/** Pontos do tronco numa grade de células do tamanho da folga. */
function grid(pos: ArrayLike<number>, idx: number[]) {
  const cells = new Map<string, number[]>();
  for (const i of idx) {
    const key = cellKey(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  }
  return cells;
}

const cell = (v: number) => Math.floor(v / CLEARANCE);
const cellKey = (x: number, y: number, z: number) => `${cell(x)},${cell(y)},${cell(z)}`;

/** Algum ponto a menos de CLEARANCE de `p` na grade? */
function touches(cells: Map<string, number[]>, pos: ArrayLike<number>, p: Vector3) {
  const [cx, cy, cz] = [cell(p.x), cell(p.y), cell(p.z)];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const list = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const ex = pos[i * 3] - p.x;
          const ey = pos[i * 3 + 1] - p.y;
          const ez = pos[i * 3 + 2] - p.z;
          if (ex * ex + ey * ey + ez * ez < CLEARANCE * CLEARANCE) return true;
        }
      }
  return false;
}

/**
 * Abaixa os braços de `pos` (corpo com as medidas, pés no chão) para a pose
 * relaxada, no lugar. `base`: corpo de referência (o mesmo vértice a vértice);
 * `arm`: peso de braço com o sinal do lado. Devolve o giro de cada lado
 * (+X, -X), em radianos (0 = ficou na pose padrão).
 */
export function relaxArms(pos: Float32Array, base: Float32Array, arm: ArrayLike<number>): number[] {
  const down = new Vector3(0, -1, 0);
  const q = new Quaternion();
  const p = new Vector3();
  return sides(base, arm).map((side, k) => {
    const s = k === 0 ? 1 : -1;
    const sh = track(pos, base, side.shoulder, SHOULDER.clone().setX(SHOULDER.x * s));
    const wr = track(pos, base, side.wrist, WRIST.clone().setX(WRIST.x * s));
    const dir = wr.sub(sh).normalize();
    const max = Math.acos(Math.min(1, -dir.y)) - RELAXED;
    if (max <= 0) return 0;
    // gira no plano do braço com a vertical: o braço vai direto para baixo
    const axis = new Vector3().crossVectors(dir, down).normalize();
    const cells = grid(pos, side.torso);
    const fits = (angle: number) => {
      q.setFromAxisAngle(axis, angle);
      for (const i of side.full) {
        p.fromArray(pos, i * 3).sub(sh).applyQuaternion(q).add(sh);
        if (touches(cells, pos, p)) return false;
      }
      return true;
    };
    let angle = max;
    if (!fits(max)) {
      if (!fits(0)) return 0;
      let lo = 0;
      let hi = max;
      for (let n = 0; n < SEARCH_STEPS; n++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      angle = lo;
    }
    q.setFromAxisAngle(axis, angle);
    for (const i of side.moving) {
      const w = Math.min(1, arm[i] * s);
      p.fromArray(pos, i * 3).sub(sh).applyQuaternion(q).add(sh);
      pos[i * 3] += (p.x - pos[i * 3]) * w;
      pos[i * 3 + 1] += (p.y - pos[i * 3 + 1]) * w;
      pos[i * 3 + 2] += (p.z - pos[i * 3 + 2]) * w;
    }
    return angle;
  });
}
