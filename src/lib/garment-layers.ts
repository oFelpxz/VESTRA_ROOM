/**
 * Peças exportadas do programa de modelagem (Boxy Tee, Relugar, Oversized)
 * vêm com o tecido em duas camadas: a de fora e o avesso, quase no mesmo
 * lugar. No caimento cada camada anda sozinha e, em corpo maior, o avesso fura
 * a de fora (manchas cinza no peito e na barriga). Como o material já desenha
 * os dois lados, o avesso duplicado sai e fica só a camada de fora.
 *
 * O Hoodie Core vem numa malha só, com os painéis soltos lá dentro: aí o par
 * é procurado entre os pedaços soltos da malha (`dropInnerPieces`), e o de
 * dentro é o mais perto da pele do corpo de referência (no capuz, que fica
 * em pé longe do eixo, o raio errava o lado).
 */

import * as THREE from "three";
import type { PointGrid } from "./garment-fit";

// Mesma malha: quase o mesmo número de pontos e a mesma caixa (m).
const SAME_COUNT = 8;
const SAME_BOX = 0.005;
// Pedaço solto: as camadas ficam ~3 mm uma da outra. Com menos diferença de
// distância à pele, ou pedaço pequeno (pregas empilhadas, cordão), não dá
// para saber qual é a de dentro e o par fica inteiro.
const SKIN_GAP = 0.0015;
const MIN_PIECE = 150;
const SKIN_RINGS = 6;

function box(p: ArrayLike<number>) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  return { min, max };
}

/** Distância média ao eixo vertical (x, z). */
function meanRadius(p: ArrayLike<number>, cx: number, cz: number) {
  let s = 0;
  for (let i = 0; i < p.length; i += 3) s += Math.hypot(p[i] - cx, p[i + 2] - cz);
  return s / (p.length / 3);
}

/** Índices das malhas que são o avesso de outra (a de dentro do par). */
export function duplicateLayers(positions: ArrayLike<number>[]): Set<number> {
  const boxes = positions.map(box);
  // Eixo do corpo: centro da peça inteira (a caixa de um painel só, como a
  // frente, fica na frente do corpo e confundiria dentro e fora).
  const cx = (Math.min(...boxes.map((b) => b.min[0])) + Math.max(...boxes.map((b) => b.max[0]))) / 2;
  const cz = (Math.min(...boxes.map((b) => b.min[2])) + Math.max(...boxes.map((b) => b.max[2]))) / 2;
  return innerOfPairs(
    positions,
    () => SAME_COUNT * 3,
    (i, j) => (meanRadius(positions[i], cx, cz) < meanRadius(positions[j], cx, cz) ? i : j),
  );
}

/**
 * Pares de malhas iguais (`countTol`: folga no número de valores); `inner`
 * diz qual sai (ou -1 para deixar os dois).
 */
function innerOfPairs(
  positions: ArrayLike<number>[],
  countTol: (n: number) => number,
  inner: (i: number, j: number) => number,
): Set<number> {
  const boxes = positions.map(box);
  const drop = new Set<number>();
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (drop.has(i) || drop.has(j)) continue;
      if (Math.abs(positions[i].length - positions[j].length) > countTol(positions[i].length)) continue;
      const a = boxes[i];
      const b = boxes[j];
      const same = [0, 1, 2].every(
        (k) => Math.abs(a.min[k] - b.min[k]) < SAME_BOX && Math.abs(a.max[k] - b.max[k]) < SAME_BOX,
      );
      if (!same) continue;
      const k = inner(i, j);
      if (k >= 0) drop.add(k);
    }
  }
  return drop;
}

/** Pedaços soltos da malha: o número do pedaço de cada ponto. */
function looseParts(index: ArrayLike<number>, count: number): Int32Array {
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let t = 0; t < index.length; t += 3) {
    const a = find(index[t]);
    parent[find(index[t + 1])] = a;
    parent[find(index[t + 2])] = a;
  }
  for (let i = 0; i < count; i++) parent[i] = find(i);
  return parent;
}

/** Mediana da distância dos pontos à pele (`skin`: pontos da pele em grade). */
function skinDistance(p: ArrayLike<number>, skin: PointGrid, skinPoints: ArrayLike<number>) {
  const d: number[] = [];
  for (let i = 0; i < p.length; i += 3) {
    const s = skin.nearest(p[i], p[i + 1], p[i + 2], SKIN_RINGS);
    if (s < 0) continue;
    d.push(Math.hypot(p[i] - skinPoints[s * 3], p[i + 1] - skinPoints[s * 3 + 1], p[i + 2] - skinPoints[s * 3 + 2]));
  }
  if (d.length === 0) return NaN;
  d.sort((a, b) => a - b);
  return d[d.length >> 1];
}

export type Skin = { grid: PointGrid; positions: ArrayLike<number> };

/**
 * Pontos que ficam (1) quando a malha traz o avesso como pedaço solto
 * duplicado de cada painel; null se não há par nenhum.
 */
export function innerPieceMask(
  position: ArrayLike<number>,
  index: ArrayLike<number>,
  skin: Skin,
): Uint8Array | null {
  const count = position.length / 3;
  const part = looseParts(index, count);
  const roots = [...new Set(part)];
  if (roots.length < 2) return null;
  const slot = new Map(roots.map((r, k) => [r, k]));
  const points: number[][] = roots.map(() => []);
  for (let i = 0; i < count; i++) {
    const p = points[slot.get(part[i])!];
    p.push(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
  }
  // Painel grande perde ou ganha alguns pontos na exportação (~2%).
  const dist = new Map<number, number>();
  const at = (k: number) => {
    if (!dist.has(k)) dist.set(k, skinDistance(points[k], skin.grid, skin.positions));
    return dist.get(k)!;
  };
  const drop = innerOfPairs(
    points,
    (n) => Math.max(SAME_COUNT * 3, n * 0.03),
    (i, j) => {
      if (Math.min(points[i].length, points[j].length) < MIN_PIECE * 3) return -1;
      const di = at(i);
      const dj = at(j);
      if (!(Math.abs(di - dj) >= SKIN_GAP)) return -1;
      return di < dj ? i : j;
    },
  );
  if (drop.size === 0) return null;
  const keep = new Uint8Array(count);
  for (let i = 0; i < count; i++) keep[i] = drop.has(slot.get(part[i])!) ? 0 : 1;
  return keep;
}

/** Tira da malha os pedaços que são avesso duplicado (ver `innerPieceMask`). */
export function dropInnerPieces(geometry: THREE.BufferGeometry, skin: Skin) {
  const index = geometry.index;
  // Com grupos de material, os trechos do índice mudariam de lugar.
  if (!index || geometry.groups.length > 1) return;
  const keep = innerPieceMask(geometry.attributes.position.array, index.array, skin);
  if (!keep) return;
  const remap = new Int32Array(keep.length).fill(-1);
  let n = 0;
  for (let i = 0; i < keep.length; i++) if (keep[i]) remap[i] = n++;
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const { itemSize, normalized } = attr;
    const Arr = attr.array.constructor as new (n: number) => THREE.TypedArray;
    const out = new Arr(n * itemSize);
    for (let i = 0; i < keep.length; i++)
      if (keep[i]) for (let k = 0; k < itemSize; k++) out[remap[i] * itemSize + k] = attr.array[i * itemSize + k];
    geometry.setAttribute(name, new THREE.BufferAttribute(out, itemSize, normalized));
  }
  const tris: number[] = [];
  for (let t = 0; t < index.count; t += 3) {
    const a = index.array[t];
    if (keep[a]) tris.push(remap[a], remap[index.array[t + 1]], remap[index.array[t + 2]]);
  }
  geometry.setIndex(tris);
  geometry.clearGroups();
}
