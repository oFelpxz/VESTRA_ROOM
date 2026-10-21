/**
 * Trama de cada tecido, gerada por código (sem baixar textura): um quadrado
 * que se repete sem emenda, com o relevo dos fios (normal), o tom dos fios e
 * uma mancha grande e suave (o tecido nunca tem a cor 100% igual).
 *
 * Cada pixel sai em RGBA de 8 bits:
 * - R, G: inclinação do relevo (normal x/y, de -1..1 para 0..255);
 * - B: mancha grande (0,5 = neutro), lida numa escala bem maior no shader;
 * - A: tom dos fios em volta de 1 (A/255 + 0,5), média 1 no quadrado.
 *
 * Arquivo sem three.js nem DOM para dar para testar no Node.
 */

export type FabricName = "algodao" | "sarja" | "denim" | "trico" | "cetim" | "moletom";

export const FABRICS: FabricName[] = ["algodao", "sarja", "denim", "trico", "cetim", "moletom"];

export const WEAVE_SIZE = 256;

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const wrap = (v: number, n: number) => ((v % n) + n) % n;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ruído suave que fecha em `px` × `py` células (repete sem emenda). */
function noise(x: number, y: number, px: number, py: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const a = hash(wrap(x0, px), wrap(y0, py), seed);
  const b = hash(wrap(x0 + 1, px), wrap(y0, py), seed);
  const c = hash(wrap(x0, px), wrap(y0 + 1, py), seed);
  const d = hash(wrap(x0 + 1, px), wrap(y0 + 1, py), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Soma de ruídos (u, v de 0 a 1), `f` células na primeira camada. */
function fbm(u: number, v: number, f: number, octaves: number, seed: number) {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(u * f, v * f, f, f, seed + i);
    total += amp;
    f *= 2;
    amp *= 0.5;
  }
  return sum / total;
}

const frac = (v: number) => v - Math.floor(v);
const bump = (d: number, w: number) => Math.max(0, 1 - (d / w) ** 2);

type Sample = { h: number; tone: number };

/**
 * Relevo (h, 0..1) e tom (em volta de 1) de cada tecido no ponto (u, v) do
 * quadrado; u vai para a direita (trama) e v para cima (urdume).
 */
const PATTERNS: Record<FabricName, (u: number, v: number) => Sample> = {
  // Malha de camiseta: colunas de "V" (24 colunas × 32 carreiras).
  algodao: (u, v) => {
    const fu = frac(u * 24) - 0.5;
    const fv = frac(v * 32) - 0.5;
    const leg = bump(Math.abs(Math.abs(fu) - (0.22 + 0.16 * fv)), 0.2);
    const h = 0.75 * leg + 0.25 * fbm(u, v, 32, 2, 1);
    return { h, tone: 0.94 + 0.08 * h + (fbm(u, v, 16, 2, 2) - 0.5) * 0.06 };
  },
  // Sarja: diagonais a 45° (14 por quadrado) com o cruzamento dos fios.
  sarja: (u, v) => {
    const line = 0.5 + 0.5 * Math.cos(2 * Math.PI * (14 * u + 14 * v));
    const cross = 0.5 + 0.5 * Math.cos(2 * Math.PI * (42 * u - 42 * v));
    const h = 0.7 * line + 0.15 * cross + 0.15 * fbm(u, v, 32, 2, 3);
    return { h, tone: 0.95 + 0.07 * h + (fbm(u, v, 16, 2, 4) - 0.5) * 0.05 };
  },
  // Denim: sarja mais em pé (~63°); o fio branco aparece no fundo das
  // diagonais e o fio azul tem falhas compridas na vertical (slub).
  denim: (u, v) => {
    const line = (0.5 + 0.5 * Math.cos(2 * Math.PI * (10 * u + 20 * v))) ** 1.5;
    const h = 0.8 * line + 0.2 * fbm(u, v, 32, 2, 5);
    const slub = noise(u * 96, v * 5, 96, 5, 6) - 0.5;
    return { h, tone: 0.84 + 0.18 * (1 - line) + slub * 0.22 + (fbm(u, v, 32, 2, 7) - 0.5) * 0.06 };
  },
  // Tricô canelado: 10 canelas por quadrado, pontos em "V" em cada uma; o
  // fundo entre as canelas fica mais escuro.
  trico: (u, v) => {
    const t = frac(u * 10);
    const rib = Math.sin(Math.PI * t) ** 0.7;
    const stitch = 0.5 + 0.5 * Math.cos(2 * Math.PI * (v * 28 + 1.5 * Math.abs(t - 0.5)));
    const h = rib * (0.78 + 0.22 * stitch) * (0.9 + 0.1 * fbm(u, v, 16, 2, 8));
    return { h, tone: 0.68 + 0.36 * h + (fbm(u, v, 8, 2, 9) - 0.5) * 0.06 };
  },
  // Cetim: quase liso, só o fio comprido na horizontal.
  cetim: (u, v) => {
    const h = 0.5 + 0.5 * (noise(u * 128, v * 6, 128, 6, 10) - 0.5);
    return { h, tone: 1 + (h - 0.5) * 0.04 };
  },
  // Moletom: malha como a da camiseta, mais fechada e felpuda.
  moletom: (u, v) => {
    const fu = frac(u * 32) - 0.5;
    const fv = frac(v * 40) - 0.5;
    const leg = bump(Math.abs(Math.abs(fu) - (0.22 + 0.16 * fv)), 0.22);
    const h = 0.55 * leg + 0.45 * fbm(u, v, 64, 2, 11);
    return { h, tone: 0.96 + 0.06 * h + (fbm(u, v, 16, 2, 12) - 0.5) * 0.05 };
  },
};

/** Quanto o relevo inclina a normal (por pixel do quadrado). */
const RELIEF: Record<FabricName, number> = {
  algodao: 3,
  sarja: 3,
  denim: 4,
  trico: 6,
  cetim: 1,
  moletom: 2.5,
};

/** Quadrado RGBA (`WEAVE_SIZE`², linha 0 = v = 0) de um tecido. */
export function makeWeave(fabric: FabricName, size = WEAVE_SIZE): Uint8Array {
  const pattern = PATTERNS[fabric];
  const h = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  let toneSum = 0;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const s = pattern(i / size, j / size);
      h[j * size + i] = s.h;
      tone[j * size + i] = s.tone;
      toneSum += s.tone;
    }
  const toneMean = toneSum / (size * size);
  const k = RELIEF[fabric];
  const at = (i: number, j: number) => h[wrap(j, size) * size + wrap(i, size)];
  const out = new Uint8Array(size * size * 4);
  const byte = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) / 2;
      const dy = (at(i, j + 1) - at(i, j - 1)) / 2;
      const nx = -k * dx;
      const ny = -k * dy;
      const len = Math.hypot(nx, ny, 1);
      const p = (j * size + i) * 4;
      out[p] = byte((nx / len) * 0.5 + 0.5);
      out[p + 1] = byte((ny / len) * 0.5 + 0.5);
      out[p + 2] = byte(fbm(i / size, j / size, 5, 3, 20));
      out[p + 3] = byte(tone[j * size + i] / toneMean - 0.5);
    }
  return out;
}
