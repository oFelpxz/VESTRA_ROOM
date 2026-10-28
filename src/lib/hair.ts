/**
 * Cabelo do avatar (lista 11, item 5): sem cabelo, raspado ou curto.
 * Escolhido no provador e salvo no perfil de medidas (`hairStyle`); sem
 * escolha, curto (careca parecia estranho no estudo do item 1). Com touca o
 * cabelo some — ela cobre a cabeça.
 *
 * Sem UV nem textura, como a pele: `hairHeight` diz quanto cada vértice da
 * cabeça está acima da linha do cabelo (medida a partir do olho, por ângulo
 * em volta da cabeça); o shader da pele pinta essa área e, no curto,
 * `hairShell` levanta uma casca por cima, mais grossa no alto. Regras puras,
 * sem three.
 */

import { weldedNormals } from "./welded-normals";

export type HairStyle = { id: string; name: string };

export const HAIR_STYLES: HairStyle[] = [
  { id: "none", name: "Sem cabelo" },
  { id: "raspado", name: "Raspado" },
  { id: "curto", name: "Curto" },
];

export const DEFAULT_HAIR_STYLE = "curto";

export function isHairStyle(id: unknown): id is string {
  return typeof id === "string" && HAIR_STYLES.some((h) => h.id === id);
}

/** Corte salvo no perfil; vazio ou desconhecido vira o padrão. */
export function hairStyle(id: string | null | undefined): HairStyle {
  return HAIR_STYLES.find((h) => h.id === id) ?? HAIR_STYLES.find((h) => h.id === DEFAULT_HAIR_STYLE)!;
}

/**
 * Altura da linha do cabelo acima do centro do olho (m), pelo ângulo em volta
 * da cabeça (0° = testa, 90° = sobre a orelha, 180° = nuca). Sobre a orelha
 * fica 1,5 cm acima do topo dela.
 */
const HAIRLINE: [number, number][] = [
  [0, 0.072],
  [30, 0.07],
  [50, 0.058],
  [65, 0.04],
  [80, 0.022],
  [110, 0.02],
  [135, -0.015],
  [160, -0.055],
  [180, -0.068],
];
function hairlineAt(deg: number) {
  for (let i = 1; i < HAIRLINE.length; i++) {
    const [a, ya] = HAIRLINE[i - 1];
    const [b, yb] = HAIRLINE[i];
    if (deg <= b) return ya + ((yb - ya) * (deg - a)) / (b - a);
  }
  return HAIRLINE[HAIRLINE.length - 1][1];
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Quanto cada vértice está acima da linha do cabelo (m; negativo = pele,
 * -Infinity = longe da cabeça). `eyeY`: altura do centro dos olhos (y para
 * cima, rosto para +z, cabeça centrada em x = 0).
 */
export function hairHeight(positions: ArrayLike<number>, eyeY: number): Float32Array {
  const n = positions.length / 3;
  // Meio da cabeça (frente/trás) na altura da testa.
  let front = -Infinity;
  let back = Infinity;
  for (let i = 0; i < n; i++) {
    const dy = positions[i * 3 + 1] - eyeY;
    if (dy > 0.04 && dy < 0.06) {
      front = Math.max(front, positions[i * 3 + 2]);
      back = Math.min(back, positions[i * 3 + 2]);
    }
  }
  const above = new Float32Array(n).fill(-Infinity);
  if (!(front > back)) return above;
  const cz = (front + back) / 2;
  for (let i = 0; i < n; i++) {
    const dy = positions[i * 3 + 1] - eyeY;
    if (dy < -0.1) continue;
    const deg = (Math.atan2(Math.abs(positions[i * 3]), positions[i * 3 + 2] - cz) * 180) / Math.PI;
    above[i] = dy - hairlineAt(deg);
  }
  return above;
}

/** Até onde, em volta da linha, a altura vai para a placa de vídeo (m; além do degradê). */
const EDGE_RANGE = 0.05;

/**
 * Altura acima da linha que vai para o shader, limitada a ±5 cm. A placa
 * interpola a distância (que muda devagar) e decide pele ou cabelo em cada
 * pixel — com a máscara 0/1 por vértice, a borda seguia os triângulos e
 * saía em escada na têmpora (lista 12, item 4).
 */
export function hairEdge(above: ArrayLike<number>): Float32Array {
  return Float32Array.from(above, (a) => Math.min(EDGE_RANGE, Math.max(-EDGE_RANGE, a)));
}

/** Espessura do curto (m): 0,8 cm no alto, 0,3 cm nas laterais e na nuca. */
function thickness(dy: number) {
  return 0.003 + 0.005 * smoothstep(-0.02, 0.08, dy);
}
/** Distância acima da linha em que o curto chega à espessura toda (degradê). */
const TAPER = 0.035;

/** Triângulos com algum vértice até 1,2 cm abaixo da linha entram na casca (o shader recorta). */
const NEAR = 0.012;
/** Redemoinho: atrás do alto da cabeça (m), de onde os fios saem. */
const CROWN_BACK = 0.03;

export type HairShell = {
  position: Float32Array;
  normal: Float32Array;
  /** Ponto da pele embaixo de cada vértice (o ruído da borda bate com a pele). */
  root: Float32Array;
  /** Altura acima da linha do cabelo (`hairEdge`). */
  above: Float32Array;
  /** Direção do fio, do redemoinho para fora, na superfície (xyz + 1). */
  tangent: Float32Array;
  /** Fio: (seno e cosseno do ângulo em volta do redemoinho, distância dele em m). */
  flow: Float32Array;
  index: number[];
};

/**
 * Casca do corte curto: os triângulos do couro cabeludo, levantados ao longo
 * da normal. Na borda ela encosta na pele e vai engrossando por 3,5 cm, como
 * um degradê de barbeiro — sem degrau de capacete na linha do cabelo. A
 * normal é a média dos vértices que caem no mesmo ponto (o corpo tem a costura
 * do meio da cabeça duplicada), senão a casca abre uma fresta ali.
 *
 * Lista 12, item 4: cada triângulo vira quatro, com o ponto do meio de cada
 * aresta empurrado para fora pela curvatura (a cabeça fica redonda, sem os
 * gomos no contorno), e cada vértice leva a direção do fio — do redemoinho,
 * atrás do alto da cabeça, para a testa, as laterais e a nuca — para o brilho
 * esticado de cabelo e o grão dos fios.
 */
export function hairShell(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  index: ArrayLike<number>,
  above: Float32Array,
  eyeY: number,
): HairShell {
  const edge = hairEdge(above);
  const remap = new Int32Array(edge.length).fill(-1);
  const verts: number[] = [];
  const tris: number[] = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.every((v) => edge[v] < -NEAR)) continue;
    for (const v of tri) {
      if (remap[v] < 0) {
        remap[v] = verts.length;
        verts.push(v);
      }
      tris.push(remap[v]);
    }
  }
  // Pele (p), normal soldada (n) e altura (a) de cada vértice da casca.
  const p: number[] = [];
  const n: number[] = [];
  const a: number[] = [];
  const key = (v: number) =>
    [0, 1, 2].map((k) => Math.round(positions[v * 3 + k] * 1e5)).join(",");
  const welded = new Map<string, number[]>();
  for (const v of verts) {
    const sum = welded.get(key(v)) ?? [0, 0, 0];
    for (let k = 0; k < 3; k++) sum[k] += normals[v * 3 + k];
    welded.set(key(v), sum);
  }
  for (const v of verts) {
    const w = welded.get(key(v))!;
    const len = Math.hypot(w[0], w[1], w[2]) || 1;
    for (let k = 0; k < 3; k++) {
      p.push(positions[v * 3 + k]);
      n.push(w[k] / len);
    }
    a.push(edge[v]);
  }

  // Um nível de subdivisão: meio da aresta na curva que as duas normais pedem.
  const surface: number[] = [...p];
  const mids = new Map<string, number>();
  const mid = (i: number, j: number) => {
    const id = i < j ? `${i},${j}` : `${j},${i}`;
    const got = mids.get(id);
    if (got !== undefined) return got;
    const m = a.length;
    const d = [0, 1, 2].map((k) => p[i * 3 + k] - p[j * 3 + k]);
    const dn = [0, 1, 2].map((k) => n[i * 3 + k] - n[j * 3 + k]);
    const sag = (d[0] * dn[0] + d[1] * dn[1] + d[2] * dn[2]) / 8;
    const nm = [0, 1, 2].map((k) => n[i * 3 + k] + n[j * 3 + k]);
    const len = Math.hypot(nm[0], nm[1], nm[2]) || 1;
    for (let k = 0; k < 3; k++) {
      p.push((p[i * 3 + k] + p[j * 3 + k]) / 2);
      n.push(nm[k] / len);
      surface.push((p[i * 3 + k] + p[j * 3 + k]) / 2 + (nm[k] / len) * sag);
    }
    a.push((a[i] + a[j]) / 2);
    mids.set(id, m);
    return m;
  };
  const fine: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const [i, j, k] = [tris[t], tris[t + 1], tris[t + 2]];
    const [ij, jk, ki] = [mid(i, j), mid(j, k), mid(k, i)];
    fine.push(i, ij, ki, ij, j, jk, ki, jk, k, ij, jk, ki);
  }

  const count = a.length;
  const position = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const lift = 0.0006 + thickness(p[i * 3 + 1] - eyeY) * smoothstep(0, TAPER, a[i]);
    for (let k = 0; k < 3; k++) position[i * 3 + k] = surface[i * 3 + k] + n[i * 3 + k] * lift;
  }
  const normal = weldedNormals(position, fine);

  // Redemoinho: o ponto mais alto da pele, um pouco para trás.
  let top = 0;
  for (let i = 1; i < count; i++) if (p[i * 3 + 1] > p[top * 3 + 1]) top = i;
  const crown = [p[top * 3], p[top * 3 + 1], p[top * 3 + 2] - CROWN_BACK];
  const tangent = new Float32Array(count * 4);
  const flow = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const d = [0, 1, 2].map((k) => p[i * 3 + k] - crown[k]);
    const nn = [normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]];
    // Para fora do redemoinho, na superfície; no próprio redemoinho, para a testa.
    let dot = d[0] * nn[0] + d[1] * nn[1] + d[2] * nn[2];
    let s = d.map((v, k) => v - nn[k] * dot);
    if (Math.hypot(s[0], s[1], s[2]) < 1e-4) {
      dot = nn[2];
      s = [0, 0, 1].map((v, k) => v - nn[k] * dot);
    }
    const len = Math.hypot(s[0], s[1], s[2]) || 1;
    for (let k = 0; k < 3; k++) tangent[i * 4 + k] = s[k] / len;
    tangent[i * 4 + 3] = 1;
    const az = Math.atan2(d[0], d[2]);
    flow[i * 3] = Math.sin(az);
    flow[i * 3 + 1] = Math.cos(az);
    flow[i * 3 + 2] = Math.hypot(d[0], d[1], d[2]);
  }
  return { position, normal, root: Float32Array.from(p), above: Float32Array.from(a), tangent, flow, index: fine };
}
