/**
 * Fita métrica virtual do avatar (lista 11, item 7): mede peito, cintura e
 * quadril do corpo já com as medidas do cliente, como uma costureira — o
 * peito e o quadril na parte mais cheia, a cintura na mais fina — e só o
 * tronco (o braço encostado não entra na conta). A fita passa reto por cima
 * das concavidades: é o contorno convexo de uma fatia horizontal da malha.
 * Serve para calibrar as shape keys (`scripts/medir-avatar.ts`) e para o
 * teste que confere que o corpo bate com as medidas. Regras puras, sem three.
 */

export type TapeLevel = "chest" | "waist" | "hip";
export const TAPE_LEVELS: TapeLevel[] = ["chest", "waist", "hip"];

/**
 * Onde cada medida é procurada no corpo de referência (m acima do chão dele,
 * y para cima): a fita sobe e desce entre `from` e `to` e fica com a maior
 * (peito, quadril) ou a menor (cintura). As alturas seguem a pele: no corpo
 * do cliente a janela vai para onde aquela faixa de pele foi.
 */
export const TAPE_WINDOWS: Record<TapeLevel, { from: number; to: number; take: "max" | "min" }> = {
  chest: { from: 1.17, to: 1.245, take: "max" },
  waist: { from: 0.98, to: 1.12, take: "min" },
  hip: { from: 0.82, to: 0.96, take: "max" },
};
/** Abaixo da axila (m acima do chão) braço e tronco são peças separadas da malha. */
export const ARMPIT = 1.25;
/** Fatias em cada janela. */
const STEPS = 16;
/** Meia altura da faixa de pele que marca cada ponta da janela (m). */
const BAND = 0.006;

export type BodyTape = {
  /** Triângulos só do tronco (e pernas), sem os braços. */
  tris: number[];
  /** Vértices do tronco nas duas pontas de cada janela. */
  windows: Record<TapeLevel, { from: number[]; to: number[] }>;
};

/**
 * Prepara a fita para um corpo de referência (posições com y para cima, o
 * meio do corpo em x = 0). Braços: tudo o que, abaixo da axila, não se liga
 * ao tronco pela malha (os vértices repetidos nas costuras contam como um).
 */
export function makeTape(base: ArrayLike<number>, index: ArrayLike<number>): BodyTape {
  const n = base.length / 3;
  let floor = Infinity;
  for (let i = 0; i < n; i++) floor = Math.min(floor, base[i * 3 + 1]);
  const below = (i: number) => base[i * 3 + 1] - floor < ARMPIT;

  // Cópias no mesmo ponto viram um vértice só.
  const canon = new Int32Array(n);
  const first = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = [0, 1, 2].map((k) => Math.round(base[i * 3 + k] * 1e5)).join(",");
    const at = first.get(key);
    if (at === undefined) first.set(key, i);
    canon[i] = at ?? i;
  }
  // Pedaços da malha abaixo da axila (union-find nas arestas).
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let t = 0; t + 2 < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (!tri.every(below)) continue;
    const [a, b, c] = tri.map((v) => root(canon[v]));
    parent[b] = a;
    parent[root(c)] = root(a);
  }
  // O tronco é o pedaço que passa pelo meio do corpo na altura da cintura.
  let seed = -1;
  let best = Infinity;
  const mid = (TAPE_WINDOWS.waist.from + TAPE_WINDOWS.waist.to) / 2;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(base[i * 3]) + Math.abs(base[i * 3 + 1] - floor - mid);
    if (d < best) [seed, best] = [i, d];
  }
  const trunk = root(canon[seed]);
  const isTrunk = (i: number) => below(i) && root(canon[i]) === trunk;

  const tris: number[] = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.every(isTrunk)) tris.push(...tri);
  }
  const band = (h: number) => {
    const out: number[] = [];
    for (let i = 0; i < n; i++)
      if (isTrunk(i) && Math.abs(base[i * 3 + 1] - floor - h) < BAND) out.push(i);
    return out;
  };
  const windows = Object.fromEntries(
    TAPE_LEVELS.map((l) => [l, { from: band(TAPE_WINDOWS[l].from), to: band(TAPE_WINDOWS[l].to) }]),
  ) as BodyTape["windows"];
  return { tris, windows };
}

/** Perímetro (m) do contorno convexo de pontos (x, z). */
export function hullPerimeter(pts: number[][]): number {
  if (pts.length < 3) return 0;
  const s = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: number[][]) => {
    const h: number[][] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  const hull = [...half(s), ...half(s.slice().reverse())];
  let sum = 0;
  for (let i = 0; i < hull.length; i++) {
    const [a, b] = [hull[i], hull[(i + 1) % hull.length]];
    sum += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return sum;
}

/** Contorno (m) da fatia horizontal y = h do tronco. */
function girthAt(tape: BodyTape, pos: ArrayLike<number>, h: number) {
  const pts: number[][] = [];
  for (let t = 0; t + 2 < tape.tris.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = tape.tris[t + e];
      const b = tape.tris[t + ((e + 1) % 3)];
      const ya = pos[a * 3 + 1] - h;
      const yb = pos[b * 3 + 1] - h;
      if (ya < 0 === yb < 0) continue;
      const u = ya / (ya - yb);
      pts.push([
        pos[a * 3] + u * (pos[b * 3] - pos[a * 3]),
        pos[a * 3 + 2] + u * (pos[b * 3 + 2] - pos[a * 3 + 2]),
      ]);
    }
  return hullPerimeter(pts);
}

/** Peito, cintura e quadril (cm) do corpo `pos` (mesmos vértices da referência). */
export function tapeGirths(tape: BodyTape, pos: ArrayLike<number>): Record<TapeLevel, number> {
  const meanY = (idx: number[]) => idx.reduce((s, i) => s + pos[i * 3 + 1], 0) / idx.length;
  const out = {} as Record<TapeLevel, number>;
  for (const l of TAPE_LEVELS) {
    const { from, to } = tape.windows[l];
    const [y0, y1] = [meanY(from), meanY(to)];
    let pick = TAPE_WINDOWS[l].take === "max" ? -Infinity : Infinity;
    for (let s = 0; s <= STEPS; s++) {
      const g = girthAt(tape, pos, y0 + ((y1 - y0) * s) / STEPS);
      pick = TAPE_WINDOWS[l].take === "max" ? Math.max(pick, g) : Math.min(pick, g);
    }
    out[l] = pick * 100;
  }
  return out;
}
