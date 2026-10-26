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
 * O comprimento também: perna do tamanho menos a perna do cliente. Calça
 * mais longa que a perna desce até o chão; mais curta, a barra sobe.
 *
 * Conta pura sobre arrays (x, y, z intercalados, em metros, Y para cima),
 * sem three.js.
 */

/** Tamanho do molde das peças de baixo (o encaixe do Blender). */
export const BOTTOM_MOLDE_SIZE = "40";

const BIND_RADIUS = 0.05; // pele que segura cada ponto do tecido (m)
const BIND_SIGMA = 0.02; // peso cai com a distância (m)
const MIN_GAP = 0.003; // tecido nunca entra na pele (m)
const BULGE_RADIUS = 0.015; // pele "embaixo" do ponto do tecido (m)
const BULGE_MAX = 0.008; // m
const BULGE_TOP = 0.2; // m acima do entrepernas do molde (o cós fica de fora)
const BULGE_MID = 0.01; // m do meio do corpo: daí para fora, só pele do mesmo lado
const BULGE_CHEST_Y = 1.05; // m no molde: daqui para cima (só o corpete do vestido) volta a valer
const BULGE_NECK_Y = 1.235; // m no molde: até 2 cm abaixo do decote (borda e alcinhas serrilhavam)
const MAX_EASE = 0.04; // folga a mais, no máximo (m)
// Tamanho apertado: o tecido chega no máximo a 3/4 da distância do molde
// (no gancho e no vinco dos glúteos o tecido passa por cima de uma reentrância
// e a pele em volta fica mais perto do que o ponto médio indica). Só aperta
// do entrepernas para cima: na perna reta o bolso cargo entraria no tecido.
const TIGHT_KEEP = 0.75;
const TIGHT_LEG_BLEND = 0.05; // m abaixo do entrepernas até parar de apertar
// Folga a mais no lado de dentro da perna: só essa fração (senão as duas
// pernas se cruzam no meio num tamanho bem maior que o corpo). Perto do
// entrepernas, nenhuma: as pernas ali quase se tocam e, encostando, fechavam
// um buraco no gancho por onde aparecia o fundo. A fração volta aos poucos
// de INNER_FULL_FROM até INNER_FULL_AT abaixo do entrepernas.
const INNER_EASE = 0.25;
const INNER_START = 0.03; // m acima do entrepernas
const INNER_FULL_FROM = 0.05; // m abaixo do entrepernas
const INNER_FULL_AT = 0.15; // m abaixo do entrepernas
const FAR_SPREAD = 0.04; // longe da pele: pele até essa distância além da mais perto (m)
// Sem tabela: quadril cresce 4 cm por tamanho (38, 40, 42...).
const GRADE_HIP_CM = 4;
// Debaixo da peça de cima o tecido fica rente (fica "por dentro" da camiseta),
// a partir de TUCK_START acima da barra dela: perto da barra (e do gancho) a
// peça de baixo mantém a forma. A barra é a da peça já vestida, em volta do
// corpo (`TopHem`): no corpo baixo ela desce, e nas costas a camiseta larga
// cai mais que na frente; com a do molde o quadril e o bolso da calça
// vazavam por cima da camiseta nesse trecho.
const TUCK_GAP = 0.004;
const TUCK_START = 0.03; // m
const TUCK_BLEND = 0.03; // m
// Até lá, a peça de baixo não passa do lado de dentro da de cima (`TopHem.r`),
// com essa folga (m); começa de leve meio centímetro abaixo da barra. No corpo
// magro o quadril e o bolso da calça saíam pela lateral da camiseta ali.
const UNDER_GAP = 0.003;
const UNDER_BLEND = 0.01; // m
// Comprimento: só abaixo do entrepernas do molde (m), até a barra.
const MOLDE_CROTCH_Y = 0.776;
const MAX_LONGER = 0.05; // m a mais, no máximo (a barra para no chão)
const MAX_SHORTER = 0.1; // m a menos, no máximo
const FLOOR_Y = 0.005; // m
// Gravidade no tamanho maior: a folga a mais cresce do entrepernas para baixo
// (até HANG vezes mais a HANG_SPAN dele) e o tecido cai reto da coxa, em vez
// de seguir a perna. Sem isso o G parecia o P inflado por igual.
const HANG = 1.5;
const HANG_SPAN = 0.7; // m
// Calça mais curta ou mais longa que a perna: o tecido sobe ou desce, mas a
// perna não é reta (joelho e panturrilha mais grossos que a canela, e as pernas
// fecham em direção aos pés). O tecido acompanha o centro da perna na altura
// nova e, onde a pele lá é mais grossa que onde ele estava, abre o mesmo tanto.
// Sem isso o joelho aparecia pela calça curta (corpo alto) e a panturrilha
// furava atrás do joelho na longa (corpo baixo).
const LEG_MAX_X = 0.3; // m do meio, no molde: perna (as mãos ficam além de 0,37)
const LEG_MIN_Y = 0.1; // m no molde: do tornozelo para cima (o pé fica de fora)
const SLICE = 0.01; // m: distância entre os cortes da perna
const SLICE_ANGLES = 24;
const SLICE_MIN_POINTS = 12; // menos que isso no corte: não é o contorno inteiro

/**
 * Barra da peça de cima vestida no cliente, em fatias iguais em volta de
 * (cx, cz), a partir de +X (no sentido de atan2(z, x)): a altura mais baixa
 * do tronco (`y`) e o raio do lado de dentro dele logo acima da barra (`r`).
 */
export type TopHem = { cx: number; cz: number; y: Float32Array; r: Float32Array };

/** Valor de uma fatia da barra na direção de (x, z), entre as vizinhas. */
export function hemAt(hem: TopHem, x: number, z: number, of: Float32Array = hem.y) {
  const n = of.length;
  const f = (Math.atan2(z - hem.cz, x - hem.cx) / (2 * Math.PI) + 1) * n - 0.5;
  const k = Math.floor(f);
  const a = f - k;
  return of[((k % n) + n) % n] * (1 - a) + of[(k + 1) % n] * a;
}

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
  /** Lado de cada ponto no molde (x, m). */
  refX: Float32Array;
  /** Altura da barra no molde (m). */
  hemY: number;
  /**
   * Arestas da pele das pernas, do tornozelo ao entrepernas (pares de pontos).
   * Vazio sem os triângulos do corpo: aí o comprimento só sobe ou desce.
   */
  legEdges: Int32Array;
};

/**
 * Prende cada ponto da peça (`cloth`) à pele do corpo de referência (`base`,
 * triângulos em `index`).
 */
export function bindBottom(
  cloth: Float32Array,
  base: Float32Array,
  index: ArrayLike<number> = [],
): BottomBinding {
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
  const refX = new Float32Array(n);
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
    refX[i] = x;
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
    refX,
    hemY: refY.reduce((m, y) => Math.min(m, y), Infinity),
    legEdges: legEdges(base, index),
  };
}

/** Arestas dos triângulos com as duas pontas na perna (ver LEG_MAX_X). */
function legEdges(base: Float32Array, index: ArrayLike<number>): Int32Array {
  const isLeg = (j: number) =>
    Math.abs(base[j * 3]) < LEG_MAX_X &&
    base[j * 3 + 1] > LEG_MIN_Y &&
    base[j * 3 + 1] < MOLDE_CROTCH_Y;
  const seen = new Set<number>();
  const out: number[] = [];
  for (let f = 0; f + 2 < index.length; f += 3)
    for (let e = 0; e < 3; e++) {
      const a = Math.min(index[f + e], index[f + ((e + 1) % 3)]);
      const b = Math.max(index[f + e], index[f + ((e + 1) % 3)]);
      const key = a * 4194304 + b;
      if (seen.has(key) || !isLeg(a) || !isLeg(b)) continue;
      seen.add(key);
      out.push(a, b);
    }
  return Int32Array.from(out);
}

/**
 * Uma perna do cliente (`side` = lado de x) cortada a cada SLICE de altura
 * pelas arestas da pele: o centro de cada corte e o raio do contorno em volta
 * dele, em SLICE_ANGLES direções. Fora dos cortes (acima do entrepernas, no
 * pé) vale o da ponta.
 */
function legSlices(pos: Float32Array, edges: Int32Array, side: number) {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const j of edges)
    if (pos[j * 3] * side > 0) {
      y0 = Math.min(y0, pos[j * 3 + 1]);
      y1 = Math.max(y1, pos[j * 3 + 1]);
    }
  if (y1 - y0 < SLICE) return null;
  const rows = Math.floor((y1 - y0) / SLICE) + 1;
  // Onde cada aresta atravessa os cortes (y = y0 + k·SLICE).
  const cuts: number[][] = Array.from({ length: rows }, () => []);
  for (let e = 0; e < edges.length; e += 2) {
    const [a, b] = [edges[e], edges[e + 1]];
    const [ya, yb] = [pos[a * 3 + 1], pos[b * 3 + 1]];
    const lo = Math.ceil((Math.min(ya, yb) - y0) / SLICE);
    const hi = Math.floor((Math.max(ya, yb) - y0) / SLICE);
    for (let k = Math.max(lo, 0); k <= Math.min(hi, rows - 1); k++) {
      const t = ya === yb ? 0 : (y0 + k * SLICE - ya) / (yb - ya);
      const x = pos[a * 3] + (pos[b * 3] - pos[a * 3]) * t;
      if (x * side <= 0) continue;
      cuts[k].push(x, pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * t);
    }
  }
  // Corte sem o contorno inteiro (a ponta de cima ou de baixo) fica com o
  // mais perto que tem.
  const near = (k: number) => {
    for (let d = 0; d < rows; d++)
      for (const r of [k - d, k + d]) if ((cuts[r]?.length ?? 0) >= 2 * SLICE_MIN_POINTS) return cuts[r];
    return [];
  };
  const cx = new Float32Array(rows);
  const cz = new Float32Array(rows);
  const radius = new Float32Array(rows * SLICE_ANGLES);
  const angle = (dx: number, dz: number) =>
    (Math.atan2(dz, dx) / (2 * Math.PI) + 1) * SLICE_ANGLES - 0.5;
  for (let k = 0; k < rows; k++) {
    const pts = near(k);
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let p = 0; p < pts.length; p += 2) {
      x0 = Math.min(x0, pts[p]);
      x1 = Math.max(x1, pts[p]);
      z0 = Math.min(z0, pts[p + 1]);
      z1 = Math.max(z1, pts[p + 1]);
    }
    cx[k] = (x0 + x1) / 2;
    cz[k] = (z0 + z1) / 2;
    const ring = new Float32Array(SLICE_ANGLES).fill(-1);
    for (let p = 0; p < pts.length; p += 2) {
      const dx = pts[p] - cx[k];
      const dz = pts[p + 1] - cz[k];
      const a = (Math.round(angle(dx, dz)) + SLICE_ANGLES) % SLICE_ANGLES;
      ring[a] = Math.max(ring[a], Math.hypot(dx, dz));
    }
    // Direção sem pele fica com a vizinha mais perto.
    for (let a = 0; a < SLICE_ANGLES; a++) {
      let v = ring[a];
      for (let d = 1; v < 0 && d <= SLICE_ANGLES / 2; d++)
        v = Math.max(ring[(a + d) % SLICE_ANGLES], ring[(a - d + SLICE_ANGLES) % SLICE_ANGLES]);
      radius[k * SLICE_ANGLES + a] = Math.max(v, 0);
    }
  }
  // Entre os cortes e as direções, a média dos vizinhos (sem degrau).
  const at = (y: number) => {
    const f = Math.min(Math.max((y - y0) / SLICE, 0), rows - 1);
    const r = Math.min(Math.floor(f), rows - 1);
    return { r, r1: Math.min(r + 1, rows - 1), a: f - r };
  };
  return {
    center(y: number): [number, number] {
      const { r, r1, a } = at(y);
      return [cx[r] * (1 - a) + cx[r1] * a, cz[r] * (1 - a) + cz[r1] * a];
    },
    radius(y: number, dx: number, dz: number) {
      const { r, r1, a } = at(y);
      const f = angle(dx, dz);
      const k0 = ((Math.floor(f) % SLICE_ANGLES) + SLICE_ANGLES) % SLICE_ANGLES;
      const k1 = (k0 + 1) % SLICE_ANGLES;
      const b = f - Math.floor(f);
      const ring = (rr: number) =>
        radius[rr * SLICE_ANGLES + k0] * (1 - b) + radius[rr * SLICE_ANGLES + k1] * b;
      return ring(r) * (1 - a) + ring(r1) * a;
    },
  };
}

/**
 * Posições da peça no corpo do cliente (`pos`, mesmos vértices de `base`).
 * `ease` = folga a mais (ou a menos) que no molde, em m. `tuck` = barra da
 * peça de cima: a vestida no cliente (`TopHem`) ou, enquanto ela não chega
 * (ou sem molde), a altura dela no molde (m). Acima dela o tecido fica rente
 * à pele.
 * `length` = quanto a peça é mais longa (ou mais curta) que a perna, em m
 * (ver `bottomLength`): a perna estica ou encolhe do entrepernas à barra.
 */
export function fitBottom(
  binding: BottomBinding,
  pos: Float32Array,
  ease: number,
  tuck: TopHem | number | null = null,
  length = 0,
): Float32Array {
  const { start, skin, weights, dir, gap, refY, refX, hemY, legEdges } = binding;
  const legSpan = Math.max(MOLDE_CROTCH_Y - hemY, 1e-6);
  const legs = length !== 0 ? [-1, 1].map((side) => legSlices(pos, legEdges, side)) : [];
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
    const leg = Math.min(Math.max((MOLDE_CROTCH_Y - refY[i]) / TIGHT_LEG_BLEND, 0), 1);
    // Lado de dentro: o que olha para o meio (já meio de lado conta inteiro)
    // e o fundo do gancho, que olha para baixo (com a folga toda ele desceria
    // e fecharia um buraco entre ele e as pernas).
    const inner =
      Math.min(Math.max(-2 * dir[i * 3] * Math.sign(refX[i]), -dir[i * 3 + 1], 0), 1) *
      Math.min(Math.max((MOLDE_CROTCH_Y + INNER_START - refY[i]) / TIGHT_LEG_BLEND, 0), 1);
    const innerEase =
      INNER_EASE *
      Math.min(
        Math.max((MOLDE_CROTCH_Y - INNER_FULL_FROM - refY[i]) / (INNER_FULL_AT - INNER_FULL_FROM), 0),
        1,
      );
    const hang = 1 + HANG * Math.min(Math.max((MOLDE_CROTCH_Y - refY[i]) / HANG_SPAN, 0), 1);
    const e = ease < 0 ? ease * (1 - leg) : ease * hang * (1 - (1 - innerEase) * inner);
    let g = Math.max(gap[i] + e, gap[i] * TIGHT_KEEP, MIN_GAP);
    const above =
      tuck == null ? -Infinity : typeof tuck === "number" ? refY[i] - tuck : sy - hemAt(tuck, sx, sz);
    if (tuck != null) {
      const t = Math.min(Math.max((above - TUCK_START) / TUCK_BLEND, 0), 1);
      g += (Math.min(g, TUCK_GAP) - g) * t;
    }
    // A média da pele fica por dentro da curva (quadril e glúteo grandes, e o
    // gancho): o tecido não pode ficar atrás da pele logo embaixo dele, senão
    // a pele aparecia por cima (o "defeito branco" do entrepernas). Só a pele a
    // até BULGE_RADIUS da linha do ponto e do mesmo lado do meio: a da outra
    // perna rasgava o gancho.
    let bulge = -Infinity;
    const side = Math.abs(refX[i]) > BULGE_MID ? Math.sign(refX[i]) : 0;
    for (let k = start[i]; k < start[i + 1]; k++) {
      const j = skin[k];
      if (side !== 0 && Math.sign(pos[j * 3]) !== side) continue;
      const px = pos[j * 3] - sx;
      const py = pos[j * 3 + 1] - sy;
      const pz = pos[j * 3 + 2] - sz;
      const d = px * dir[i * 3] + py * dir[i * 3 + 1] + pz * dir[i * 3 + 2];
      if (d > bulge && px * px + py * py + pz * pz - d * d < BULGE_RADIUS * BULGE_RADIUS) bulge = d;
    }
    // No máximo BULGE_MAX a mais: no fundo do gancho a pele da coxa fica
    // "embaixo" e empurrava o tecido em pontas. Perto do cós, nada: a barriga
    // acima dele serrilhava a borda.
    // Sem pele embaixo (toda do outro lado), nada: -Infinity × 0 dava NaN e o
    // ponto ia para a origem, uma linha do gancho até o chão.
    // Acima do cós das calças só chega o corpete do vestido: ali o busto maior
    // do cliente furava o tecido no mamilo.
    const chest = Math.min(
      (refY[i] - BULGE_CHEST_Y) / TIGHT_LEG_BLEND,
      (BULGE_NECK_Y - refY[i]) / TUCK_BLEND,
    );
    const below = Math.min(
      Math.max((MOLDE_CROTCH_Y + BULGE_TOP - refY[i]) / TIGHT_LEG_BLEND, chest, 0),
      1,
    );
    if (bulge > -Infinity) g = Math.max(g, g + (Math.min(bulge + MIN_GAP, g + BULGE_MAX) - g) * below);
    out[i * 3] = sx + dir[i * 3] * g;
    out[i * 3 + 1] = sy + dir[i * 3 + 1] * g;
    out[i * 3 + 2] = sz + dir[i * 3 + 2] * g;
    if (tuck != null && typeof tuck !== "number") {
      const w = Math.min(Math.max((above + UNDER_BLEND / 2) / UNDER_BLEND, 0), 1);
      const dx = out[i * 3] - tuck.cx;
      const dz = out[i * 3 + 2] - tuck.cz;
      const r = Math.hypot(dx, dz);
      const limit = Math.max(
        hemAt(tuck, out[i * 3], out[i * 3 + 2], tuck.r) - UNDER_GAP,
        Math.hypot(sx - tuck.cx, sz - tuck.cz) + MIN_GAP,
      );
      if (w > 0 && r > limit) {
        const k = 1 - (1 - limit / r) * w;
        out[i * 3] = tuck.cx + dx * k;
        out[i * 3 + 2] = tuck.cz + dz * k;
      }
    }
    if (length !== 0) {
      const t = Math.min(Math.max((MOLDE_CROTCH_Y - refY[i]) / legSpan, 0), 1);
      const from = out[i * 3 + 1];
      const to = Math.max(from - length * t, FLOOR_Y);
      out[i * 3 + 1] = to;
      const leg = legs[refX[i] < 0 ? 0 : 1];
      if (leg && to !== from) {
        const [ax, az] = leg.center(from);
        const [bx, bz] = leg.center(to);
        const dx = out[i * 3] - ax;
        const dz = out[i * 3 + 2] - az;
        const r = Math.hypot(dx, dz);
        const grow = Math.max(leg.radius(to, dx, dz) - leg.radius(from, dx, dz), 0);
        const k = r > 1e-6 ? (r + grow) / r : 1;
        out[i * 3] = bx + dx * k;
        out[i * 3 + 2] = bz + dz * k;
      }
    }
  }
  return out;
}

type BottomSizeRow = {
  size: string;
  hipMinCm?: number | null;
  hipMaxCm?: number | null;
  legLengthMinCm?: number | null;
  legLengthMaxCm?: number | null;
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

/**
 * Quanto a peça do tamanho escolhido é mais longa que a perna do cliente (m;
 * negativo = mais curta), pela perna (entrepernas) da tabela. Sem perna na
 * tabela (bermuda, saia), o comprimento não muda.
 */
export function bottomLength(
  size: string | null,
  chart: BottomSizeRow[],
  clientLegCm: number | null,
): number {
  const row = chart.find((r) => r.size === size);
  const garment = mid(row?.legLengthMinCm, row?.legLengthMaxCm);
  if (garment == null || clientLegCm == null) return 0;
  const length = (garment - clientLegCm) / 100;
  return Math.min(Math.max(length, -MAX_SHORTER), MAX_LONGER);
}

/**
 * Calça ou saia? Na altura do joelho a calça tem um vão entre as pernas; a
 * saia (e o vestido) passa pelo meio. A bermuda nem chega lá: calça.
 * O material usa para escolher as dobras (`Wrinkle` em `fabric.ts`).
 */
export function bottomWrinkle(base: Float32Array): "caimento" | "calca" {
  for (let i = 0; i < base.length; i += 3)
    if (Math.abs(base[i]) < 0.015 && base[i + 1] > 0.42 && base[i + 1] < 0.55) return "caimento";
  return "calca";
}
