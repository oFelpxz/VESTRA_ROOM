/**
 * Caimento das peças de baixo (calça, bermuda) no avatar do provador.
 *
 * O molde da peça de baixo é feito no Blender a partir do próprio corpo de
 * referência (`scripts/molde/calca.py`, marca `vestra_peca = "baixo"`). Cada
 * ponto do tecido é preso aos pontos da pele em volta dele (até BIND_RADIUS);
 * quando o corpo muda com as medidas do cliente, o tecido acompanha a pele —
 * cintura, quadril e comprimento da perna — e mantém a distância que tinha
 * dela no molde, mais a folga do tamanho escolhido.
 *
 * A folga vem da tabela de medidas: quadril do tamanho menos o quadril do
 * cliente. Tamanho maior que o corpo sobra; menor fica colado (até MIN_GAP).
 *
 * Conta pura sobre arrays (x, y, z intercalados, em metros, Y para cima),
 * sem three.js.
 */

/** Tamanho do molde das peças de baixo (o encaixe do Blender). */
export const BOTTOM_MOLDE_SIZE = "40";

const BIND_RADIUS = 0.05; // pele que segura cada ponto do tecido (m)
const BIND_SIGMA = 0.02; // peso cai com a distância (m)
const MIN_GAP = 0.003; // tecido nunca entra na pele (m)
const MAX_EASE = 0.04; // folga a mais, no máximo (m)
const FAR_SPREAD = 0.04; // longe da pele: pele até essa distância além da mais perto (m)
// Sem tabela: quadril cresce 4 cm por tamanho (38, 40, 42...).
const GRADE_HIP_CM = 4;
// Debaixo da peça de cima o tecido fica rente (fica "por dentro" da camiseta),
// a partir de TUCK_START acima da barra dela: perto da barra (e do gancho) a
// peça de baixo mantém a forma.
const TUCK_GAP = 0.004;
const TUCK_START = 0.03; // m
const TUCK_BLEND = 0.03; // m

export type BottomBinding = {
  /** Início dos vizinhos de cada ponto em `skin`/`weights` (n + 1 itens). */
  start: Int32Array;
  skin: Int32Array;
  weights: Float32Array;
  /** Direção pele → tecido no molde (unitária). */
  dir: Float32Array;
  /** Distância pele → tecido no molde (m). */
  gap: Float32Array;
  /** Altura de cada ponto no molde (m). */
  refY: Float32Array;
};

/** Prende cada ponto da peça (`cloth`) à pele do corpo de referência (`base`). */
export function bindBottom(cloth: Float32Array, base: Float32Array): BottomBinding {
  const cell = BIND_RADIUS;
  const key = (x: number, y: number, z: number) =>
    ((Math.floor(x / cell) + 512) * 1024 + (Math.floor(y / cell) + 512)) * 1024 +
    (Math.floor(z / cell) + 512);
  const grid = new Map<number, number[]>();
  for (let i = 0; i < base.length / 3; i++) {
    const k = key(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }

  const n = cloth.length / 3;
  const start = new Int32Array(n + 1);
  const skin: number[] = [];
  const weights: number[] = [];
  const dir = new Float32Array(n * 3);
  const gap = new Float32Array(n);
  const refY = new Float32Array(n);
  // Pele a menos de `radius` do ponto (procura nas células em volta).
  const gather = (x: number, y: number, z: number, radius: number) => {
    const near: number[] = [];
    const dist: number[] = [];
    const reach = Math.ceil(radius / cell);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    const rr = radius * radius;
    for (let a = -reach; a <= reach; a++)
      for (let b = -reach; b <= reach; b++)
        for (let c = -reach; c <= reach; c++) {
          const list = grid.get(((cx + a + 512) * 1024 + (cy + b + 512)) * 1024 + (cz + c + 512));
          if (!list) continue;
          for (const j of list) {
            const dx = base[j * 3] - x;
            const dy = base[j * 3 + 1] - y;
            const dz = base[j * 3 + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < rr) {
              near.push(j);
              dist.push(d);
            }
          }
        }
    return { near, dist };
  };

  for (let i = 0; i < n; i++) {
    const x = cloth[i * 3];
    const y = cloth[i * 3 + 1];
    const z = cloth[i * 3 + 2];
    refY[i] = y;
    start[i] = skin.length;
    let { near, dist } = gather(x, y, z, BIND_RADIUS);
    let s2 = 2 * BIND_SIGMA * BIND_SIGMA;
    // Longe da pele (a parte solta da saia): segue uma região maior, que
    // cresce com a distância, para os pontos vizinhos andarem juntos.
    for (let r = BIND_RADIUS * 2; near.length === 0 && r < 1; r *= 2) {
      const found = gather(x, y, z, r);
      if (found.near.length === 0) continue;
      const nearest = Math.sqrt(found.dist.reduce((m, d) => Math.min(m, d), Infinity));
      ({ near, dist } = gather(x, y, z, nearest + FAR_SPREAD));
      const sigma = Math.max(BIND_SIGMA, nearest / 2);
      s2 = 2 * sigma * sigma;
    }

    let total = 0;
    const w = dist.map((d) => {
      const v = Math.exp(-d / s2);
      total += v;
      return v;
    });
    let sx = 0;
    let sy = 0;
    let sz = 0;
    near.forEach((j, k) => {
      const wk = w[k] / total;
      skin.push(j);
      weights.push(wk);
      sx += base[j * 3] * wk;
      sy += base[j * 3 + 1] * wk;
      sz += base[j * 3 + 2] * wk;
    });
    const dx = x - sx;
    const dy = y - sy;
    const dz = z - sz;
    const len = Math.hypot(dx, dy, dz);
    gap[i] = len;
    if (len > 1e-6) {
      dir[i * 3] = dx / len;
      dir[i * 3 + 1] = dy / len;
      dir[i * 3 + 2] = dz / len;
    }
  }
  start[n] = skin.length;
  return {
    start,
    skin: Int32Array.from(skin),
    weights: Float32Array.from(weights),
    dir,
    gap,
    refY,
  };
}

/**
 * Posições da peça no corpo do cliente (`pos`, mesmos vértices de `base`).
 * `ease` = folga a mais (ou a menos) que no molde, em m. `tuckY` = barra da
 * peça de cima no molde (m): acima dela o tecido fica rente à pele.
 */
export function fitBottom(
  binding: BottomBinding,
  pos: Float32Array,
  ease: number,
  tuckY: number | null = null,
): Float32Array {
  const { start, skin, weights, dir, gap, refY } = binding;
  const n = gap.length;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let k = start[i]; k < start[i + 1]; k++) {
      const j = skin[k];
      const w = weights[k];
      sx += pos[j * 3] * w;
      sy += pos[j * 3 + 1] * w;
      sz += pos[j * 3 + 2] * w;
    }
    let g = Math.max(gap[i] + ease, MIN_GAP);
    if (tuckY != null) {
      const t = Math.min(Math.max((refY[i] - tuckY - TUCK_START) / TUCK_BLEND, 0), 1);
      g += (Math.min(g, TUCK_GAP) - g) * t;
    }
    out[i * 3] = sx + dir[i * 3] * g;
    out[i * 3 + 1] = sy + dir[i * 3 + 1] * g;
    out[i * 3 + 2] = sz + dir[i * 3 + 2] * g;
  }
  return out;
}

type BottomSizeRow = {
  size: string;
  hipMinCm?: number | null;
  hipMaxCm?: number | null;
};

const mid = (min?: number | null, max?: number | null) =>
  min != null && max != null ? (min + max) / 2 : null;

/** Quadril (cm) de um tamanho: pela tabela ou, sem ela, 4 cm por número. */
function sizeHipCm(size: string, chart: BottomSizeRow[]): number | null {
  const row = chart.find((r) => r.size === size);
  const fromChart = mid(row?.hipMinCm, row?.hipMaxCm);
  if (fromChart != null) return fromChart;
  const ref = mid(
    chart.find((r) => r.size === BOTTOM_MOLDE_SIZE)?.hipMinCm,
    chart.find((r) => r.size === BOTTOM_MOLDE_SIZE)?.hipMaxCm,
  );
  const num = Number(size);
  if (!Number.isFinite(num)) return null;
  return (ref ?? 98) + ((num - Number(BOTTOM_MOLDE_SIZE)) / 2) * GRADE_HIP_CM;
}

/**
 * Folga do tamanho escolhido (m, na distância pele → tecido), em relação ao
 * molde: quadril do tamanho menos o quadril do cliente, dividido pela volta.
 * Sem medida de quadril do cliente, compara com o tamanho do molde.
 */
export function bottomEase(
  size: string | null,
  chart: BottomSizeRow[],
  clientHipCm: number | null,
): number {
  if (!size) return 0;
  const garment = sizeHipCm(size, chart);
  const body = clientHipCm ?? sizeHipCm(BOTTOM_MOLDE_SIZE, chart);
  if (garment == null || body == null) return 0;
  const ease = (garment - body) / (2 * Math.PI) / 100;
  return Math.min(Math.max(ease, -0.05), MAX_EASE);
}
