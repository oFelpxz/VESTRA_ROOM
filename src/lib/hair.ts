/**
 * Cabelo do avatar (lista 11, item 5): sem cabelo, raspado ou curto.
 * Escolhido no provador e salvo no perfil de medidas (`hairStyle`); sem
 * escolha, curto (careca parecia estranho no estudo do item 1). Com touca o
 * cabelo some — ela cobre a cabeça.
 *
 * Sem UV nem textura, como a pele: `hairMask` diz quanto de cada vértice da
 * cabeça é couro cabeludo (linha do cabelo medida a partir do olho, por
 * ângulo em volta da cabeça); o shader da pele pinta essa área e, no curto,
 * `hairShell` levanta uma casca por cima, mais grossa no alto. Regras puras,
 * sem three.
 */

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
/** Meia largura da passagem pele → cabelo (m). */
const FEATHER = 0.006;

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

/** 0 = pele, 1 = couro cabeludo, por vértice (a partir de `hairHeight`). */
export function hairMask(above: Float32Array): Float32Array {
  return above.map((a) => smoothstep(-FEATHER, FEATHER, a));
}

/** Espessura do curto (m): 0,8 cm no alto, 0,3 cm nas laterais e na nuca. */
function thickness(dy: number) {
  return 0.003 + 0.005 * smoothstep(-0.02, 0.08, dy);
}
/** Distância acima da linha em que o curto chega à espessura toda (degradê). */
const TAPER = 0.035;

export type HairShell = {
  position: Float32Array;
  /** Ponto da pele embaixo de cada vértice (o ruído da borda bate com a pele). */
  root: Float32Array;
  mask: Float32Array;
  index: number[];
};

/**
 * Casca do corte curto: os triângulos do couro cabeludo, levantados ao longo
 * da normal. Na borda ela encosta na pele e vai engrossando por 3,5 cm, como
 * um degradê de barbeiro — sem degrau de capacete na linha do cabelo. A
 * normal é a média dos vértices que caem no mesmo ponto (o corpo tem a costura
 * do meio da cabeça duplicada), senão a casca abre uma fresta ali.
 */
export function hairShell(
  positions: ArrayLike<number>,
  normals: ArrayLike<number>,
  index: ArrayLike<number>,
  above: Float32Array,
  eyeY: number,
): HairShell {
  const mask = hairMask(above);
  const remap = new Int32Array(mask.length).fill(-1);
  const verts: number[] = [];
  const tris: number[] = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.some((v) => mask[v] < 0.01)) continue;
    for (const v of tri) {
      if (remap[v] < 0) {
        remap[v] = verts.length;
        verts.push(v);
      }
      tris.push(remap[v]);
    }
  }
  const position = new Float32Array(verts.length * 3);
  const root = new Float32Array(verts.length * 3);
  const shellMask = new Float32Array(verts.length);
  const key = (v: number) =>
    [0, 1, 2].map((k) => Math.round(positions[v * 3 + k] * 1e5)).join(",");
  const welded = new Map<string, number[]>();
  for (const v of verts) {
    const sum = welded.get(key(v)) ?? [0, 0, 0];
    for (let k = 0; k < 3; k++) sum[k] += normals[v * 3 + k];
    welded.set(key(v), sum);
  }
  verts.forEach((v, i) => {
    const n = welded.get(key(v))!;
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const lift = 0.0006 + thickness(positions[v * 3 + 1] - eyeY) * smoothstep(0, TAPER, above[v]);
    for (let k = 0; k < 3; k++) {
      root[i * 3 + k] = positions[v * 3 + k];
      position[i * 3 + k] = positions[v * 3 + k] + (n[k] / len) * lift;
    }
    shellMask[i] = mask[v];
  });
  return { position, root, mask: shellMask, index: tris };
}
