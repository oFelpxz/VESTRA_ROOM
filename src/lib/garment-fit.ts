/**
 * Caimento da roupa sobre o avatar do provador.
 *
 * A peça tem forma própria (a do tamanho escolhido) e NÃO acompanha as
 * medidas do cliente: ela só sobe/desce para continuar apoiada nos ombros, é
 * empurrada para fora onde o corpo for maior que ela (`pushOut`) e, dali para
 * baixo, cai reta (`drape`). Cliente magro num GG vê a camiseta sobrando;
 * cliente grande num P vê o tecido esticado.
 *
 * Tudo aqui é conta pura sobre arrays de posições (x, y, z intercalados, em
 * metros, Y para cima), sem three.js — o componente só lê e grava geometria.
 */

/** Soma os morph targets (deltas relativos) na posição base. */
export function applyMorphs(
  base: Float32Array,
  deltas: Float32Array[],
  weights: number[],
): Float32Array {
  const out = base.slice();
  deltas.forEach((d, k) => {
    const w = weights[k];
    if (!w) return;
    for (let i = 0; i < out.length; i++) out[i] += d[i] * w;
  });
  return out;
}

/** Grade espacial para achar o vértice do corpo mais próximo de um ponto. */
export class PointGrid {
  private cells = new Map<number, number[]>();

  constructor(
    private points: Float32Array,
    private cell: number,
  ) {
    for (let i = 0; i < points.length / 3; i++) {
      const key = this.key(
        Math.floor(points[i * 3] / cell),
        Math.floor(points[i * 3 + 1] / cell),
        Math.floor(points[i * 3 + 2] / cell),
      );
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  private key(x: number, y: number, z: number) {
    return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  }

  /** Índice do ponto mais próximo até `maxRings` células de distância, ou -1. */
  nearest(x: number, y: number, z: number, maxRings: number): number {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const cz = Math.floor(z / this.cell);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxRings; r++) {
      for (let i = cx - r; i <= cx + r; i++) {
        for (let j = cy - r; j <= cy + r; j++) {
          for (let k = cz - r; k <= cz + r; k++) {
            // só a "casca" do anel r (o miolo já foi visto)
            if (
              Math.max(Math.abs(i - cx), Math.abs(j - cy), Math.abs(k - cz)) !== r
            )
              continue;
            const list = this.cells.get(this.key(i, j, k));
            if (!list) continue;
            for (const p of list) {
              const dx = this.points[p * 3] - x;
              const dy = this.points[p * 3 + 1] - y;
              const dz = this.points[p * 3 + 2] - z;
              const d = dx * dx + dy * dy + dz * dz;
              if (d < bestD) {
                bestD = d;
                best = p;
              }
            }
          }
        }
      }
      // achou algo e o próximo anel já não pode ter nada mais perto
      if (best >= 0 && Math.sqrt(bestD) <= r * this.cell) break;
    }
    return best;
  }
}

/** Normais por vértice (média das faces), para saber o lado "de fora" da pele. */
export function vertexNormals(
  pos: Float32Array,
  index: ArrayLike<number>,
): Float32Array {
  const n = new Float32Array(pos.length);
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f] * 3;
    const b = index[f + 1] * 3;
    const c = index[f + 2] * 3;
    const ux = pos[b] - pos[a];
    const uy = pos[b + 1] - pos[a + 1];
    const uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a];
    const vy = pos[c + 1] - pos[a + 1];
    const vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      n[v] += nx;
      n[v + 1] += ny;
      n[v + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

export type Body = {
  positions: Float32Array;
  normals: Float32Array;
  grid: PointGrid;
};

export const BODY_GRID_CELL = 0.025;

export function makeBody(positions: Float32Array, index: ArrayLike<number>): Body {
  return {
    positions,
    normals: vertexNormals(positions, index),
    grid: new PointGrid(positions, BODY_GRID_CELL),
  };
}

const MARGIN = 0.008; // folga mínima entre pele e tecido (m)
const FIELD_CELL = 0.015; // célula do campo de deslocamento (m)
const FIELD_SIGMA = 2; // borrão do campo, em células (~3 cm)
const SEARCH_RINGS = 6; // até ~15 cm dentro do corpo
const FAR_OUTSIDE = 0.05; // acima disso o ponto não encosta mais no corpo

/**
 * Empurra o tecido para fora onde o corpo atravessa. O deslocamento é
 * espalhado num campo 3D borrado, então o tecido estica de forma suave e todas
 * as camadas da peça (frente, avesso, gola) se movem juntas.
 * Retorna quantos vértices ainda encostam no fim.
 */
export function pushOut(
  garment: Float32Array,
  body: Body,
  iterations = 10,
): number {
  const count = garment.length / 3;
  const active = new Uint8Array(count).fill(1);
  const disp = new Float32Array(garment.length);
  let touching = 0;

  for (let it = 0; it < iterations; it++) {
    touching = 0;
    disp.fill(0);
    const hit: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!active[i]) continue;
      const x = garment[i * 3];
      const y = garment[i * 3 + 1];
      const z = garment[i * 3 + 2];
      const j = body.grid.nearest(x, y, z, SEARCH_RINGS);
      if (j < 0) {
        active[i] = 0;
        continue;
      }
      const nx = body.normals[j * 3];
      const ny = body.normals[j * 3 + 1];
      const nz = body.normals[j * 3 + 2];
      const s =
        (x - body.positions[j * 3]) * nx +
        (y - body.positions[j * 3 + 1]) * ny +
        (z - body.positions[j * 3 + 2]) * nz;
      if (s > FAR_OUTSIDE) {
        active[i] = 0; // o campo só empurra para fora: não volta a encostar
        continue;
      }
      if (s < MARGIN) {
        const m = MARGIN - s;
        disp[i * 3] = nx * m;
        disp[i * 3 + 1] = ny * m;
        disp[i * 3 + 2] = nz * m;
        hit.push(i);
      }
    }
    touching = hit.length;
    if (touching === 0) break;
    applyField(garment, disp, hit);
  }
  return touching;
}

/** Espalha os deslocamentos pontuais num campo suave e aplica em toda a peça. */
function applyField(garment: Float32Array, disp: Float32Array, hit: number[]) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < garment.length; i += 3) {
    minX = Math.min(minX, garment[i]); maxX = Math.max(maxX, garment[i]);
    minY = Math.min(minY, garment[i + 1]); maxY = Math.max(maxY, garment[i + 1]);
    minZ = Math.min(minZ, garment[i + 2]); maxZ = Math.max(maxZ, garment[i + 2]);
  }
  const pad = FIELD_CELL * (FIELD_SIGMA * 3 + 2);
  const ox = minX - pad, oy = minY - pad, oz = minZ - pad;
  const nx = Math.ceil((maxX + pad - ox) / FIELD_CELL) + 2;
  const ny = Math.ceil((maxY + pad - oy) / FIELD_CELL) + 2;
  const nz = Math.ceil((maxZ + pad - oz) / FIELD_CELL) + 2;
  const size = nx * ny * nz;
  const fx = new Float32Array(size), fy = new Float32Array(size), fz = new Float32Array(size);
  const fw = new Float32Array(size);
  const at = (i: number, j: number, k: number) => (i * ny + j) * nz + k;

  for (const v of hit) {
    const c = at(
      Math.round((garment[v * 3] - ox) / FIELD_CELL),
      Math.round((garment[v * 3 + 1] - oy) / FIELD_CELL),
      Math.round((garment[v * 3 + 2] - oz) / FIELD_CELL),
    );
    fx[c] += disp[v * 3]; fy[c] += disp[v * 3 + 1]; fz[c] += disp[v * 3 + 2];
    fw[c] += 1;
  }
  for (const f of [fx, fy, fz, fw]) blur3(f, nx, ny, nz);

  let maxW = 0;
  for (let c = 0; c < size; c++) maxW = Math.max(maxW, fw[c]);
  const floor = maxW * 0.02;
  for (let c = 0; c < size; c++) {
    const w = fw[c];
    if (w <= 1e-9) { fx[c] = fy[c] = fz[c] = 0; continue; }
    // média local + queda suave nas bordas; 1,15 ajuda a convergir rápido
    const k = (Math.min(1, w / floor) * 1.15) / w;
    fx[c] *= k; fy[c] *= k; fz[c] *= k;
  }

  for (let v = 0; v < garment.length; v += 3) {
    const gx = (garment[v] - ox) / FIELD_CELL;
    const gy = (garment[v + 1] - oy) / FIELD_CELL;
    const gz = (garment[v + 2] - oz) / FIELD_CELL;
    const i0 = Math.floor(gx), j0 = Math.floor(gy), k0 = Math.floor(gz);
    const tx = gx - i0, ty = gy - j0, tz = gz - k0;
    let dx = 0, dy = 0, dz = 0;
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++)
        for (let c = 0; c < 2; c++) {
          const w = (a ? tx : 1 - tx) * (b ? ty : 1 - ty) * (c ? tz : 1 - tz);
          const idx = at(i0 + a, j0 + b, k0 + c);
          dx += fx[idx] * w; dy += fy[idx] * w; dz += fz[idx] * w;
        }
    garment[v] += dx; garment[v + 1] += dy; garment[v + 2] += dz;
  }
}

/** Borrão gaussiano separável numa grade 3D (in place). */
function blur3(f: Float32Array, nx: number, ny: number, nz: number) {
  const r = Math.ceil(FIELD_SIGMA * 3);
  const kernel = Array.from({ length: 2 * r + 1 }, (_, i) =>
    Math.exp(-0.5 * ((i - r) / FIELD_SIGMA) ** 2),
  );
  const dims = [nx, ny, nz];
  const strides = [ny * nz, nz, 1];
  const line = new Float32Array(Math.max(nx, ny, nz));
  for (let axis = 0; axis < 3; axis++) {
    const n = dims[axis];
    const s = strides[axis];
    const [o1, o2] = [0, 1, 2].filter((a) => a !== axis);
    for (let a = 0; a < dims[o1]; a++) {
      for (let b = 0; b < dims[o2]; b++) {
        const start = a * strides[o1] + b * strides[o2];
        let any = false;
        for (let i = 0; i < n; i++) {
          line[i] = f[start + i * s];
          if (line[i] !== 0) any = true;
        }
        if (!any) continue;
        for (let i = 0; i < n; i++) {
          let acc = 0;
          for (let t = -r; t <= r; t++) {
            const j = i + t;
            if (j >= 0 && j < n) acc += line[j] * kernel[t + r];
          }
          f[start + i * s] = acc;
        }
      }
    }
  }
}

const DRAPE_COLUMNS = 48; // colunas em volta do tronco (7,5° cada)
const DRAPE_ROW = 0.015; // altura de cada linha (m)
const DRAPE_ARM = 0.3; // vértices mais "manga" que isso ficam de fora
const DRAPE_FADE = 0.05; // entrada suave logo abaixo de `top` (m)
// Empurrão máximo de uma coluna (m) em que o tecido começa / termina de ficar
// esticado em linha reta (ver `drape`).
const DRAPE_TENSION = [0.01, 0.04];

/**
 * Caimento simplificado, depois de `pushOut`. O tecido que o corpo empurrou
 * para fora não volta a entrar logo abaixo (o "balão" em quadril ou barriga
 * maior que a peça): ele desce reto a partir do ponto mais largo, como com
 * gravidade, e fica esticado em linha reta entre dois apoios (peito → quadril).
 *
 * Trabalha em colunas verticais em volta do tronco, comparando a peça antes
 * (`before`) e depois do empurrão; só move para fora, na horizontal. Só vale
 * para o tronco abaixo de `top` (axila): `arm` diz quanto cada vértice é manga
 * (0 a 1). Retorna quantos vértices se moveram.
 */
export function drape(
  cloth: Float32Array,
  before: Float32Array,
  arm: ArrayLike<number>,
  top: number,
): number {
  const count = cloth.length / 3;
  const weight = new Float32Array(count);
  let cx = 0, cz = 0, n = 0, bottom = Infinity;
  for (let i = 0; i < count; i++) {
    const y = before[i * 3 + 1];
    const a = Math.abs(arm[i]);
    if (y >= top || a >= DRAPE_ARM) continue;
    weight[i] = (1 - a / DRAPE_ARM) * Math.min(1, (top - y) / DRAPE_FADE);
    cx += before[i * 3];
    cz += before[i * 3 + 2];
    bottom = Math.min(bottom, y);
    n++;
  }
  if (!n) return 0;
  cx /= n;
  cz /= n;

  // 1) por célula (coluna × linha): quanto o tecido foi empurrado e a que
  // distância do eixo ele ficou, no máximo
  const C = DRAPE_COLUMNS;
  const rows = Math.ceil((top - bottom) / DRAPE_ROW) + 1;
  const push = new Float32Array(C * rows).fill(-Infinity);
  const radius = new Float32Array(C * rows).fill(-Infinity);
  const col = new Float32Array(count);
  const row = new Float32Array(count);
  const ux = new Float32Array(count);
  const uz = new Float32Array(count);
  const pushed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (!weight[i]) continue;
    const rx = before[i * 3] - cx;
    const rz = before[i * 3 + 2] - cz;
    const len = Math.hypot(rx, rz);
    if (len < 1e-6) { weight[i] = 0; continue; }
    ux[i] = rx / len;
    uz[i] = rz / len;
    pushed[i] =
      (cloth[i * 3] - before[i * 3]) * ux[i] +
      (cloth[i * 3 + 2] - before[i * 3 + 2]) * uz[i];
    col[i] = ((Math.atan2(rz, rx) + Math.PI) / (2 * Math.PI)) * C;
    row[i] = (top - before[i * 3 + 1]) / DRAPE_ROW;
    const cell = (Math.floor(col[i]) % C) * rows + Math.floor(row[i]);
    push[cell] = Math.max(push[cell], pushed[i]);
    radius[cell] = Math.max(radius[cell], len + pushed[i]);
  }

  // 2) quanto cada coluna foi empurrada decide o modelo: pouco (corpo perto
  // do tamanho) só não deixa o empurrão voltar para dentro e a peça mantém a
  // forma do molde; muito (quadril ou barriga bem maior que a peça) estica a
  // lateral inteira em linha reta da axila até o ponto mais largo
  const tension = new Float32Array(C);
  for (let c = 0; c < C; c++) {
    let m = 0;
    for (let r = 0; r < rows; r++) m = Math.max(m, push[c * rows + r]);
    tension[c] = Math.min(1, Math.max(0, (m - DRAPE_TENSION[0]) / (DRAPE_TENSION[1] - DRAPE_TENSION[0])));
  }
  for (let pass = 0; pass < 2; pass++) {
    const prev = tension.slice();
    for (let c = 0; c < C; c++)
      tension[c] = (prev[(c + C - 1) % C] + 2 * prev[c] + prev[(c + 1) % C]) / 4;
  }
  const hangPush = hang(push, C, rows);
  const filled = fillColumns(radius, C, rows);
  const hangRadius = hang(radius, C, rows);
  const taut = new Float32Array(C * rows);
  for (let k = 0; k < taut.length; k++) taut[k] = Math.max(0, hangRadius[k] - filled[k]);
  smoothColumns(hangPush, C, rows);
  smoothColumns(taut, C, rows);

  // 3) leva cada vértice até o caimento da coluna dele
  let moved = 0;
  for (let i = 0; i < count; i++) {
    if (!weight[i]) continue;
    const fc = col[i] - 0.5;
    const fr = Math.min(Math.max(row[i] - 0.5, 0), rows - 1);
    const c0 = Math.floor(fc), r0 = Math.max(0, Math.min(Math.floor(fr), rows - 2));
    const tc = fc - c0, tr = Math.min(1, Math.max(0, fr - r0));
    const a = ((c0 % C) + C) % C, b = (a + 1) % C;
    const r1 = Math.min(r0 + 1, rows - 1);
    const at = (g: Float32Array) =>
      (g[a * rows + r0] * (1 - tr) + g[a * rows + r1] * tr) * (1 - tc) +
      (g[b * rows + r0] * (1 - tr) + g[b * rows + r1] * tr) * tc;
    const t = tension[a] * (1 - tc) + tension[b] * tc;
    const extra =
      (t * at(taut) + (1 - t) * Math.max(0, at(hangPush) - pushed[i])) * weight[i];
    if (extra <= 1e-4) continue;
    cloth[i * 3] += ux[i] * extra;
    cloth[i * 3 + 2] += uz[i] * extra;
    moved++;
  }
  return moved;
}

/**
 * Cada coluna (de cima para baixo) nunca volta para dentro depois do ponto
 * mais largo (máximo acumulado) e fica esticada entre apoios (envoltória
 * côncava). Células vazias (-Infinity) ficam com a reta entre as vizinhas.
 */
function hang(grid: Float32Array, C: number, rows: number): Float32Array {
  const out = new Float32Array(grid.length);
  const xs: number[] = [];
  const vs: number[] = [];
  for (let c = 0; c < C; c++) {
    const g = c * rows;
    xs.length = vs.length = 0;
    // embaixo do braço a coluna só começa mais abaixo: o tecido parte da axila
    const first = grid.subarray(g, g + rows).findIndex((v) => v !== -Infinity);
    if (first < 0) continue;
    if (first > 0) {
      xs.push(0);
      vs.push(grid[g + first]);
    }
    let run = -Infinity;
    for (let r = first; r < rows; r++) {
      if (grid[g + r] === -Infinity) continue;
      run = Math.max(run, grid[g + r]);
      // envoltória superior (monotone chain): tira quem ficou abaixo da reta
      while (xs.length >= 2) {
        const k = xs.length;
        const cross =
          (xs[k - 1] - xs[k - 2]) * (run - vs[k - 2]) -
          (vs[k - 1] - vs[k - 2]) * (r - xs[k - 2]);
        if (cross < 0) break;
        xs.pop();
        vs.pop();
      }
      xs.push(r);
      vs.push(run);
    }
    for (let r = 0, k = 0; r < rows; r++) {
      while (k < xs.length - 1 && xs[k + 1] <= r) k++;
      if (r <= xs[0]) out[g + r] = vs[0];
      else if (k >= xs.length - 1) out[g + r] = vs[xs.length - 1];
      else out[g + r] = vs[k] + ((vs[k + 1] - vs[k]) * (r - xs[k])) / (xs[k + 1] - xs[k]);
    }
  }
  return out;
}

/** Copia de cada coluna com as células vazias iguais à vizinha mais próxima. */
function fillColumns(grid: Float32Array, C: number, rows: number): Float32Array {
  const out = grid.slice();
  for (let c = 0; c < C; c++) {
    const g = c * rows;
    let last = -Infinity;
    for (let r = 0; r < rows; r++) {
      if (out[g + r] === -Infinity) out[g + r] = last;
      else last = out[g + r];
    }
    last = -Infinity;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[g + r] !== -Infinity) last = grid[g + r];
      else if (out[g + r] === -Infinity) out[g + r] = last;
    }
    for (let r = 0; r < rows; r++) if (out[g + r] === -Infinity) out[g + r] = 0;
  }
  return out;
}

/** Suaviza entre colunas vizinhas (a volta é fechada), sem baixar nada. */
function smoothColumns(grid: Float32Array, C: number, rows: number) {
  for (let pass = 0; pass < 2; pass++) {
    const prev = grid.slice();
    for (let c = 0; c < C; c++) {
      const l = ((c + C - 1) % C) * rows;
      const m = c * rows;
      const rr = ((c + 1) % C) * rows;
      for (let r = 0; r < rows; r++) {
        const b = (prev[l + r] + 2 * prev[m + r] + prev[rr + r]) / 4;
        grid[m + r] = Math.max(prev[m + r], b);
      }
    }
  }
}

/**
 * Escala da peça por tamanho, a partir da tabela de medidas do produto: o
 * molde (a peça encaixada no Blender) é o tamanho M; os outros tamanhos
 * crescem/encolhem na proporção do peito da tabela. Sem tabela (ou sem M),
 * usa uma progressão padrão.
 */
export const MOLDE_SIZE = "M";

const DEFAULT_SIZE_SCALE: Record<string, number> = {
  PP: 0.88,
  P: 0.94,
  M: 1,
  G: 1.06,
  GG: 1.12,
  XG: 1.18,
};

export function sizeScale(
  size: string | null,
  chart: { size: string; chestMinCm: number | null; chestMaxCm: number | null }[],
): number {
  if (!size) return 1;
  const mid = (r: { chestMinCm: number | null; chestMaxCm: number | null }) =>
    r.chestMinCm != null && r.chestMaxCm != null
      ? (r.chestMinCm + r.chestMaxCm) / 2
      : null;
  const row = chart.find((r) => r.size === size);
  const ref = chart.find((r) => r.size === MOLDE_SIZE);
  const a = row && mid(row);
  const b = ref && mid(ref);
  if (a && b) return a / b;
  return DEFAULT_SIZE_SCALE[size.toUpperCase()] ?? 1;
}
