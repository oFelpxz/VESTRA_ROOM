import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Dá espessura de tecido às bordas das peças de baixo do provador. Saia,
// vestido, calças e bermuda são uma folha só: de perto, a barra e o cós viram
// uma linha fina como papel. Aqui cada borda (barra, cós, cava, alça) ganha
// uma faixa dobrada para dentro, da largura da espessura do tecido, e a
// barra passa a ter "corpo" quando a câmera chega perto.
//
// A faixa usa pontos novos (cópias dos da borda, com UV e tudo), então a
// superfície de fora não muda e o sombreado da barra continua o mesmo. A
// borda da peça passa a ser a ponta de dentro da faixa: a barra dobrada e o
// pesponto (`src/lib/fabric-edge.ts`) andam só a espessura, nada visível.
//
// Espessura pelo tecido da cena (`vestra_tecido`). Grava `vestra_espessura`
// (mm) na cena e não faz de novo numa peça que já tem.
//
// Uso: npx tsx scripts/espessura.ts peca.glb [saida.glb]   (sem saída, grava por cima)

const MM: Record<string, number> = { sarja: 2.5, cetim: 1.2, denim: 3 };

async function main() {
  const [input, output = input] = process.argv.slice(2);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);
  const scene = doc.getRoot().listScenes()[0];
  const extras = scene.getExtras() as Record<string, unknown>;
  if (extras.vestra_espessura) {
    console.log(`${input}: já tem espessura (${extras.vestra_espessura} mm)`);
    return;
  }
  const mm = MM[String(extras.vestra_tecido)];
  if (!mm) throw new Error(`${input}: tecido sem espessura (${extras.vestra_tecido})`);
  const t = mm / 1000;

  let rim = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      if (prim.listTargets().length) throw new Error(`${mesh.getName()}: peça com shape keys`);
      const indices = prim.getIndices()!;
      const index = indices.getArray()!;
      const posAttr = prim.getAttribute("POSITION")!;
      const pos = posAttr.getArray()!;
      const n = pos.length / 3;

      // Mesma junção do fabric-edge.ts: pontos na mesma posição são um só.
      const weld = new Int32Array(n);
      const seen = new Map<string, number>();
      for (let v = 0; v < n; v++) {
        const key = `${Math.round(pos[3 * v] * 1e5)},${Math.round(pos[3 * v + 1] * 1e5)},${Math.round(pos[3 * v + 2] * 1e5)}`;
        let id = seen.get(key);
        if (id === undefined) seen.set(key, (id = seen.size));
        weld[v] = id;
      }
      const m = seen.size;

      // Arestas usadas por um triângulo só, na ordem do triângulo (a → b).
      const uses = new Map<number, number>();
      const first = new Map<number, [number, number]>();
      for (let f = 0; f < index.length; f += 3)
        for (let e = 0; e < 3; e++) {
          const a = index[f + e];
          const b = index[f + ((e + 1) % 3)];
          const wa = weld[a];
          const wb = weld[b];
          if (wa === wb) continue;
          const key = wa < wb ? wa * m + wb : wb * m + wa;
          uses.set(key, (uses.get(key) ?? 0) + 1);
          if (!first.has(key)) first.set(key, [a, b]);
        }
      const sewn = sewnOn(pos, index, weld, m);
      const border: [number, number][] = [];
      for (const [key, c] of uses) if (c === 1 && !sewn[weld[first.get(key)![0]]]) border.push(first.get(key)!);
      if (!border.length) continue;

      // Normal de cada ponto juntado: as cópias de uma costura de UV na barra
      // vão para o mesmo lugar e a faixa não abre.
      const faceN = vertexNormals(pos, index);
      const wn = new Float32Array(m * 3);
      for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) wn[weld[v] * 3 + k] += faceN[v * 3 + k];

      // Dois pontos novos por ponto da borda: um em cima da borda e um para dentro.
      const outer = new Map<number, number>();
      const inner = new Map<number, number>();
      const copyOf: number[] = [];
      for (const edge of border)
        for (const v of edge)
          if (!outer.has(v)) {
            outer.set(v, n + copyOf.length);
            copyOf.push(v);
            inner.set(v, n + copyOf.length);
            copyOf.push(v);
          }

      for (const semantic of prim.listSemantics()) {
        const attr = prim.getAttribute(semantic)!;
        const src = attr.getArray()!;
        const size = attr.getElementSize();
        const out = new (src.constructor as new (length: number) => typeof src)((n + copyOf.length) * size);
        out.set(src);
        copyOf.forEach((v, i) => out.set(src.subarray(v * size, v * size + size), (n + i) * size));
        attr.setArray(out);
      }
      const next = posAttr.getArray()!;
      for (const [v, i] of inner) {
        const w = weld[v];
        const len = Math.hypot(wn[w * 3], wn[w * 3 + 1], wn[w * 3 + 2]) || 1;
        for (let k = 0; k < 3; k++) next[i * 3 + k] -= (wn[w * 3 + k] / len) * t;
      }

      // A faixa continua o tecido dobrando para dentro: b → a no sentido
      // contrário ao do triângulo da borda, então a frente dela fica para fora
      // (para baixo na barra, para cima no cós).
      const total = n + copyOf.length;
      const tris = new (total > 65535 ? Uint32Array : Uint16Array)(index.length + border.length * 6);
      tris.set(index);
      let f = index.length;
      for (const [a, b] of border) {
        const [ao, bo, ai, bi] = [outer.get(a)!, outer.get(b)!, inner.get(a)!, inner.get(b)!];
        tris.set([bo, ao, ai, bo, ai, bi], f);
        f += 6;
      }
      indices.setArray(tris);

      // Normais: as da peça ficam como estavam; as da faixa saem da faixa.
      const normal = prim.getAttribute("NORMAL");
      if (normal) {
        const fresh = vertexNormals(next, tris);
        const keep = normal.getArray()!;
        keep.set(fresh.subarray(n * 3), n * 3);
      }
      rim += border.length;
    }

  scene.setExtras({ ...extras, vestra_espessura: mm });
  await io.write(output, doc);
  console.log(`${output}: ${rim} arestas de borda com ${mm} mm de espessura`);
}

/**
 * Pontos de pedaços costurados por cima da peça (bolso, lapela, passante):
 * pedaços soltos que ficam, na mediana, a menos de SEWN da parte maior. A
 * borda deles não ganha faixa: dobrada para dentro, ela encostava na perna e
 * desenhava uma linha escura em volta do bolso da cargo.
 */
const SEWN = 0.012; // m
function sewnOn(pos: ArrayLike<number>, index: ArrayLike<number>, weld: Int32Array, m: number): Uint8Array {
  const parent = Array.from({ length: m }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let f = 0; f < index.length; f += 3) {
    parent[find(weld[index[f + 1]])] = find(weld[index[f]]);
    parent[find(weld[index[f + 2]])] = find(weld[index[f]]);
  }
  const at = new Int32Array(m);
  for (let v = 0; v < weld.length; v++) at[weld[v]] = v;
  const pieces = new Map<number, number[]>();
  for (let w = 0; w < m; w++) {
    const list = pieces.get(find(w));
    if (list) list.push(w);
    else pieces.set(find(w), [w]);
  }
  const sorted = [...pieces.values()].sort((a, b) => b.length - a.length);
  const out = new Uint8Array(m);
  for (const piece of sorted.slice(1)) {
    const dist = piece.map((w) => {
      let best = Infinity;
      for (const u of sorted[0]) {
        const [a, b] = [at[w] * 3, at[u] * 3];
        best = Math.min(best, (pos[a] - pos[b]) ** 2 + (pos[a + 1] - pos[b + 1]) ** 2 + (pos[a + 2] - pos[b + 2]) ** 2);
      }
      return Math.sqrt(best);
    });
    if (dist.sort((a, b) => a - b)[dist.length >> 1] < SEWN) for (const w of piece) out[w] = 1;
  }
  return out;
}

/** Normais por ponto (média das faces em volta, pesada pela área). */
function vertexNormals(pos: ArrayLike<number>, index: ArrayLike<number>): Float32Array<ArrayBuffer> {
  const out = new Float32Array(pos.length);
  for (let f = 0; f < index.length; f += 3) {
    const [a, b, c] = [index[f], index[f + 1], index[f + 2]];
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3];
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      out[v * 3] += nx;
      out[v * 3 + 1] += ny;
      out[v * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const len = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    out[i] /= len;
    out[i + 1] /= len;
    out[i + 2] /= len;
  }
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
