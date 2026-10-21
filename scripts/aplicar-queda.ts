import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Aplica a queda com gravidade (`scripts/molde/cair.py`) num .glb do
// provador: cada ponto da peça anda o mesmo que os pontos da simulação que
// estavam no mesmo lugar antes da queda. Só POSITION e NORMAL mudam; marcas da
// cena (vestra_fit, vestra_peca, vestra_tecido), UV e _BRACO ficam.
//
// Uso: npx tsx scripts/aplicar-queda.ts peca.glb queda.bin saida.glb [raio_mm]
// raio_mm: raio da média dos pontos da simulação (padrão 0,2 mm; a camiseta,
// que a simulação une a 3 mm, usa 12: com menos, a manga da oversized
// atravessava a camada de baixo).

const MATCH = (Number(process.argv[5]) || 0.2) / 1000; // m

async function main() {
  const [input, bin, output] = process.argv.slice(2);
  const raw = readFileSync(bin);
  const n = raw.readInt32LE(0);
  const floats = new Float32Array(raw.buffer.slice(raw.byteOffset + 4, raw.byteOffset + 4 + n * 24));
  const rest = floats.subarray(0, n * 3);
  const done = floats.subarray(n * 3);

  const cell = MATCH * 4;
  const key = (x: number, y: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const k = key(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  // Média dos pontos da simulação dentro do raio (os mais perto pesam mais):
  // pontos vizinhos do .glb andam quase igual e o tecido não rasga onde a
  // simulação uniu camadas e costuras.
  const near = (x: number, y: number, z: number, out: number[]) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    let total = 0;
    out[0] = out[1] = out[2] = 0;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -1; c <= 1; c++)
          for (const j of grid.get(`${cx + a},${cy + b},${cz + c}`) ?? []) {
            const d = Math.hypot(rest[j * 3] - x, rest[j * 3 + 1] - y, rest[j * 3 + 2] - z);
            if (d > MATCH) continue;
            const w = 1 - d / MATCH + 1e-3;
            for (let k = 0; k < 3; k++) out[k] += w * (done[j * 3 + k] - rest[j * 3 + k]);
            total += w;
          }
    if (total === 0) return false;
    for (let k = 0; k < 3; k++) out[k] /= total;
    return true;
  };

  const nearestAny = (x: number, y: number, z: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < n; j++) {
      const d = (rest[j * 3] - x) ** 2 + (rest[j * 3 + 1] - y) ** 2 + (rest[j * 3 + 2] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best;
  };

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);
  let moved = 0;
  let missing = 0;
  const move = [0, 0, 0];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute("POSITION")!;
      const pos = new Float32Array(posAttr.getArray()!);
      for (let i = 0; i < pos.length / 3; i++) {
        if (!near(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], move)) {
          // Fora do raio (ponto que a simulação uniu longe): o mais perto de todos.
          const j = nearestAny(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          for (let k = 0; k < 3; k++) move[k] = done[j * 3 + k] - rest[j * 3 + k];
          missing++;
        }
        for (let k = 0; k < 3; k++) pos[i * 3 + k] += move[k];
        moved++;
      }
      posAttr.setArray(pos);
      const normal = prim.getAttribute("NORMAL");
      const index = prim.getIndices()?.getArray();
      if (normal && index) normal.setArray(vertexNormals(pos, index));
    }
  await io.write(output, doc);
  console.log(`${output}: ${moved} pontos com queda (${missing} pelo ponto mais perto, fora do raio)`);
}

/** Normais por ponto (média das faces em volta, pesada pela área). */
function vertexNormals(pos: Float32Array, index: ArrayLike<number>): Float32Array<ArrayBuffer> {
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
