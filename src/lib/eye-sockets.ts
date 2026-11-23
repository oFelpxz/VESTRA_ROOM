/**
 * Olhos do avatar (lista 11, item 4). O corpo base (MakeHuman) não tem globo
 * ocular: no lugar do olho fica uma cavidade funda de ~2,5 cm, que no
 * provador virava um buraco escuro. Aqui achamos essa cavidade no corpo de
 * referência e, a cada encaixe, onde vai o globo. A íris, a pupila e a córnea
 * são desenhadas no shader do globo (lista 12, `EyeMaterial`).
 *
 * As medidas mudam o rosto um pouco: o globo segue o centro dos vértices da
 * cavidade e cresce/encolhe com o espalhamento deles. Regras puras, sem three.
 */

export type EyeSocket = {
  /** Vértices do fundo da cavidade. */
  verts: number[];
  /** Espalhamento desses vértices no corpo de referência (m). */
  spread: number;
};

export type EyeBall = { center: [number, number, number]; radius: number };

/** Raio do globo e quanto ele fica à frente do fundo da cavidade, no corpo de referência (m). */
const RADIUS = 0.0125;
const FORWARD = 0.006;
/** Mínimo de vértices para achar que é mesmo uma cavidade de olho. */
const MIN_VERTS = 40;

function centroid(pos: ArrayLike<number>, verts: number[]): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const v of verts) for (let k = 0; k < 3; k++) c[k] += pos[v * 3 + k];
  return [c[0] / verts.length, c[1] / verts.length, c[2] / verts.length];
}

function spreadOf(pos: ArrayLike<number>, verts: number[], c: [number, number, number]) {
  let s = 0;
  for (const v of verts)
    for (let k = 0; k < 3; k++) s += (pos[v * 3 + k] - c[k]) ** 2;
  return Math.sqrt(s / verts.length);
}

/**
 * Cavidades dos dois olhos no corpo de referência (y para cima, frente em +z,
 * pés em y = 0): na faixa de altura dos olhos, ao lado do nariz, 4,5 cm ou
 * mais atrás da ponta do nariz. Corpo sem essa cavidade (outro modelo) → [].
 */
export function findEyeSockets(base: ArrayLike<number>): EyeSocket[] {
  const n = base.length / 3;
  let top = -Infinity;
  for (let i = 0; i < n; i++) top = Math.max(top, base[i * 3 + 1]);
  let front = -Infinity;
  for (let i = 0; i < n; i++)
    if (base[i * 3 + 1] > 0.9 * top) front = Math.max(front, base[i * 3 + 2]);

  const sockets: EyeSocket[] = [];
  for (const side of [1, -1]) {
    const verts: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = side * base[i * 3];
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      if (x > 0.012 && x < 0.056 && y > 0.925 * top && y < 0.953 * top && z > 0.08 && front - z > 0.045)
        verts.push(i);
    }
    if (verts.length < MIN_VERTS) return [];
    sockets.push({ verts, spread: spreadOf(base, verts, centroid(base, verts)) });
  }
  return sockets;
}

/** Onde vai cada globo no corpo já com as medidas do cliente. */
export function placeEyes(positions: ArrayLike<number>, sockets: EyeSocket[]): EyeBall[] {
  return sockets.map(({ verts, spread }) => {
    const c = centroid(positions, verts);
    const s = spreadOf(positions, verts, c) / spread;
    return { center: [c[0], c[1], c[2] + FORWARD * s], radius: RADIUS * s };
  });
}
