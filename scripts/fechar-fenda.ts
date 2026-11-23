import { NodeIO, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Fecha costuras abertas: na track jacket, a costura de trás de cada manga
// ficou aberta no arquivo (fenda de ~2 mm do ombro ao punho) e aparecia como
// um risco claro nas costas. Acha os laços de borda da malha; o laço comprido
// e fino (as duas beiradas quase encostadas) é fenda. As aberturas de verdade
// (punho, barra, gola) são largas e ficam como estão. Cada ponto da fenda vai
// para o meio entre ele e a beirada da frente, e as duas beiradas são
// costuradas com triângulos: só encostar deixava frestas quando a peça se
// ajusta ao corpo (os pontos de um lado não batem com os do outro).
//
// Uso: npx tsx scripts/fechar-fenda.ts entrada.glb saida.glb

const MIN_LOOP = 80; // vértices no laço: fenda vai do ombro ao punho
const SLIT_GAP = 0.004; // m: 3/4 dos pontos com a outra beirada a até 4 mm
const MAX_GAP = 0.006; // m: ponto mais longe que isso da outra beirada fica
const SKIP = 3; // vizinhos no próprio laço que não contam como "outra beirada"

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("uso: fechar-fenda.ts entrada.glb saida.glb");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) closeSlits(mesh.getName(), prim);
  await io.write(output, doc);
}

type V3 = [number, number, number];

function closeSlits(name: string, prim: Primitive) {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return;
  const count = pos.getCount();
  const index = prim.getIndices()?.getArray() ?? Array.from({ length: count }, (_, i) => i);
  const at = (i: number) => pos.getElement(i, [0, 0, 0]) as V3;

  // Solda pela posição: as costuras de UV repetem o vértice no mesmo lugar.
  const weld = new Map<string, number>();
  const id = new Int32Array(count);
  const rest: V3[] = [];
  for (let i = 0; i < count; i++) {
    const p = at(i);
    const key = p.map((c) => Math.round(c * 1e5)).join(",");
    let w = weld.get(key);
    if (w === undefined) {
      w = rest.length;
      weld.set(key, w);
      rest.push(p);
    }
    id[i] = w;
  }

  // Borda = aresta usada por um triângulo só.
  const uses = new Map<string, number>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < index.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(id[index[t + k]], id[index[t + ((k + 1) % 3)]]);
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  const adj = new Map<number, number[]>();
  const edges: [number, number][] = [];
  for (const [key, n] of uses) {
    if (n !== 1) continue;
    const [a, b] = key.split("_").map(Number);
    edges.push([a, b]);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }

  const seen = new Set<number>();
  const target = new Map<number, V3>();
  const seams: number[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    for (const stack = [start]; stack.length; ) {
      const v = stack.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      loop.push(v);
      stack.push(...adj.get(v)!);
    }
    if (loop.length < MIN_LOOP) continue;
    const inLoop = new Set(loop);
    const loopEdges = edges.filter(([a]) => inLoop.has(a));

    const moves: [number, V3, number][] = [];
    for (const v of loop) {
      const near = new Set([v]);
      let front = [v];
      for (let s = 0; s < SKIP; s++) {
        front = front.flatMap((f) => adj.get(f)!).filter((n) => !near.has(n));
        front.forEach((n) => near.add(n));
      }
      let best: V3 | null = null;
      let bestD = Infinity;
      for (const [a, b] of loopEdges) {
        if (near.has(a) || near.has(b)) continue;
        const q = closestOnSegment(rest[v], rest[a], rest[b]);
        const d = dist(rest[v], q);
        if (d < bestD) [best, bestD] = [q, d];
      }
      if (best) moves.push([v, best, bestD]);
    }
    const gaps = moves.map((m) => m[2]).sort((a, b) => a - b);
    // As pontas da fenda abrem (ombro, punho): conta só 3/4 dos pontos.
    if ((gaps[Math.floor(gaps.length * 0.75)] ?? Infinity) > SLIT_GAP) continue;
    let moved = 0;
    for (const [v, q, d] of moves) {
      if (d > MAX_GAP) continue;
      target.set(v, rest[v].map((c, k) => (c + q[k]) / 2) as V3);
      moved++;
    }
    const seam = stitch(loopEdges, (v) => target.get(v) ?? rest[v]);
    seams.push(...seam);
    console.log(
      `${name}: fenda de ${loop.length} pontos (abertura mediana ${(gaps[gaps.length >> 1] * 1000).toFixed(1)} mm) → ${moved} fechados, ${seam.length} triângulos de costura`,
    );
  }

  for (let i = 0; i < count; i++) {
    const p = target.get(id[i]);
    if (p) pos.setElement(i, p);
  }

  // Triângulos novos com um vértice do arquivo por ponto, virados para fora
  // (o mesmo lado das normais dos pontos).
  const indices = prim.getIndices();
  if (!seams.length || !indices) return;
  const rep = new Int32Array(rest.length).fill(-1);
  for (let i = count - 1; i >= 0; i--) rep[id[i]] = i;
  const normal = prim.getAttribute("NORMAL");
  const added: number[] = [];
  for (const [a, b, c] of seams) {
    const [pa, pb, pc] = [a, b, c].map((v) => at(rep[v]));
    const face = cross(sub(pb, pa), sub(pc, pa));
    const n = [a, b, c]
      .map((v) => (normal ? (normal.getElement(rep[v], [0, 0, 0]) as V3) : face))
      .reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]]);
    const out = face[0] * n[0] + face[1] * n[1] + face[2] * n[2] >= 0;
    added.push(...(out ? [rep[a], rep[b], rep[c]] : [rep[a], rep[c], rep[b]]));
  }
  const old = indices.getArray()!;
  const Arr = old.constructor as new (n: number) => typeof old;
  const next = new Arr(old.length + added.length);
  next.set(old);
  next.set(added, old.length);
  indices.setArray(next);
}

/**
 * Costura as duas beiradas de uma fenda (laço de borda) com uma tira de
 * triângulos. Onde as beiradas já se tocam o laço se cruza; ele é partido ali
 * em laços simples. As pontas de cada um são o par de pontos mais distantes;
 * dali saem as duas beiradas, unidas em zíper (sempre a diagonal mais curta).
 */
function stitch(edges: [number, number][], at: (v: number) => V3): number[][] {
  const tris: number[][] = [];
  for (const cycle of simpleCycles(edges)) {
    if (cycle.length < 3) continue;
    let [i0, j0, far] = [0, 0, -1];
    for (let i = 0; i < cycle.length; i++)
      for (let j = i + 1; j < cycle.length; j++) {
        const d = dist(at(cycle[i]), at(cycle[j]));
        if (d > far) [i0, j0, far] = [i, j, d];
      }
    const sideA = cycle.slice(i0, j0 + 1);
    const sideB = [...cycle.slice(j0), ...cycle.slice(0, i0 + 1)].reverse();
    let a = 0;
    let b = 0;
    while (a < sideA.length - 1 || b < sideB.length - 1) {
      const stepA =
        b === sideB.length - 1 ||
        (a < sideA.length - 1 && dist(at(sideA[a + 1]), at(sideB[b])) <= dist(at(sideA[a]), at(sideB[b + 1])));
      const tri = stepA ? [sideA[a], sideA[a + 1], sideB[b]] : [sideA[a], sideB[b + 1], sideB[b]];
      if (stepA) a++;
      else b++;
      if (new Set(tri).size === 3) tris.push(tri);
    }
  }
  return tris;
}

/** Parte um laço que se cruza em laços simples (cada aresta entra em um). */
function simpleCycles(edges: [number, number][]): number[][] {
  const left = new Map<number, number[]>();
  for (const [a, b] of edges) {
    left.set(a, [...(left.get(a) ?? []), b]);
    left.set(b, [...(left.get(b) ?? []), a]);
  }
  const take = (v: number) => {
    const n = left.get(v)!.pop();
    if (n === undefined) return;
    const back = left.get(n)!;
    back.splice(back.indexOf(v), 1);
    return n;
  };
  const cycles: number[][] = [];
  for (const start of left.keys()) {
    const path = [start];
    for (let next = take(start); next !== undefined; next = take(path[path.length - 1])) {
      const k = path.indexOf(next);
      if (k < 0) path.push(next);
      else {
        cycles.push(path.slice(k));
        path.length = k + 1;
      }
    }
  }
  return cycles;
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function closestOnSegment(p: V3, a: V3, b: V3): V3 {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / len2)) : 0;
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}

function dist(a: V3, b: V3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
