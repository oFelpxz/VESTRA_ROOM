import { NodeIO, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { type Body, makeBody } from "../src/lib/garment-fit";
import { duplicateLayers } from "../src/lib/garment-layers";

// Alisa o peito e as costas das camisetas do provador: o molde trazia
// calombos e um vinco na altura do peito (vinham do arquivo, não do encaixe).
// Suavização de Taubin (alisa sem encolher) só no tronco — entre a barra e os
// ombros, fora das mangas (_BRACO) e com as bordas de cada painel paradas, para
// as costuras continuarem fechadas. No tronco, o tecido fica a pelo menos
// MIN_GAP da pele do avatar_base (medida como no `pushOut` do provador): com
// menos, o provador empurrava ponto a ponto e o peito voltava manchado. Só
// POSITION e NORMAL mudam; marcas da cena, UV e _BRACO ficam.
//
// As camisetas têm duas camadas (tecido e avesso, a 0,5 mm) e faixas de
// costura por cima. Só os painéis grandes de fora são alisados (o provador
// joga o avesso fora com `duplicateLayers`; alisando o avesso, a camada que
// aparece só acompanhava e saía serrilhada); cada camada e faixa anda o mesmo
// que os pontos do painel alisado mais perto, então as camadas continuam juntas.
//
// Uso: npx tsx scripts/alisar-peito.ts entrada.glb saida.glb [avatar_base.glb]

const FROM_Y = 0.95; // m: abaixo daqui fica como está (barra com a queda)
const TO_Y = 1.42; // m: acima daqui também (gola)
const FADE = 0.04; // m: transição nas duas pontas
// Peso do braço (_BRACO, com o sinal do lado): o peito todo tem 5–50% (vaza
// do braço na transferência), manga de verdade quase 100%. Com corte em 2% o
// peito ficava sem alisar (e só o esquerdo: o direito é negativo).
const ARM_FROM = 0.25;
const ARM_TO = 0.5;
const PANEL = 3000; // pontos: painel grande (alisado); menor só acompanha
const LAYER = 0.001; // m: painel a menos disso de um já alisado é a outra camada
const FOLLOW = 0.005; // m: raio da média para quem acompanha (avesso a 0,5 mm)
const REACH = 0.012; // m: sem ninguém no raio, o ponto mais perto até aqui
const MIN_GAP = 0.009; // m: folga mínima até a pele (o pushOut empurra abaixo de 8 mm)
const ROUNDS = 400; // com 40 o vinco sumia mas os calombos de 3–5 cm ficavam
const LAMBDA = 0.5;
const MU = -0.53;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Grade de pontos para achar vizinhos perto. */
function makeGrid(pts: Float32Array, cell: number) {
  const key = (x: number, y: number, z: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, number[]>();
  for (let i = 0; i < pts.length / 3; i++) {
    const k = key(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  }
  /** Índices dos pontos nas 27 células em volta. */
  return function* around(x: number, y: number, z: number) {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -1; c <= 1; c++) yield* grid.get(`${cx + a},${cy + b},${cz + c}`) ?? [];
  };
}

async function main() {
  const [input, output, avatarPath = "public/models/avatar_base.glb"] = process.argv.slice(2);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  // Pele do corpo de referência, no espaço do mundo.
  const avatar = await io.read(avatarPath);
  const node = avatar.getRoot().listNodes().find((n) => n.getMesh())!;
  const skinPrim = node.getMesh()!.listPrimitives()[0];
  const skinPos = new Float32Array(skinPrim.getAttribute("POSITION")!.getArray()!);
  const m = node.getWorldMatrix();
  for (let i = 0; i < skinPos.length; i += 3) {
    const [x, y, z] = [skinPos[i], skinPos[i + 1], skinPos[i + 2]];
    skinPos[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    skinPos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    skinPos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  const skin = makeBody(skinPos, skinPrim.getIndices()!.getArray()!);

  const doc = await io.read(input);
  const prims = doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  const before = prims.map((p) => new Float32Array(p.getAttribute("POSITION")!.getArray()!));
  const after = before.map((a) => new Float32Array(a));

  // Painéis grandes de fora, maiores primeiro; a outra camada de um já
  // alisado só acompanha.
  const inner = duplicateLayers(before);
  const panels: number[] = [];
  const order = prims
    .map((_, i) => i)
    .filter((i) => !inner.has(i))
    .sort((a, b) => before[b].length - before[a].length);
  for (const i of order) {
    if (before[i].length / 3 < PANEL) continue;
    const layerOf = panels.find((j) => medianDistance(before[i], before[j]) < LAYER);
    if (layerOf === undefined) panels.push(i);
  }

  let worst = 0;
  for (const i of panels) {
    const moved = smoothPanel(prims[i], before[i], after[i], skin);
    worst = Math.max(worst, moved);
  }

  // O resto (avesso, faixas, gola, mangas) anda como o painel alisado mais perto.
  const source = new Float32Array(panels.flatMap((i) => [...before[i]]));
  const shift = new Float32Array(panels.flatMap((i) => [...after[i]].map((v, k) => v - before[i][k])));
  const aroundSource = makeGrid(source, REACH);
  for (let i = 0; i < prims.length; i++) {
    if (panels.includes(i)) continue;
    const pos = after[i];
    for (let v = 0; v < pos.length / 3; v++) {
      const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
      let total = 0;
      let nearest = -1;
      let nearestD = REACH;
      const move = [0, 0, 0];
      for (const j of aroundSource(x, y, z)) {
        const d = Math.hypot(source[j * 3] - x, source[j * 3 + 1] - y, source[j * 3 + 2] - z);
        if (d < nearestD) {
          nearestD = d;
          nearest = j;
        }
        if (d > FOLLOW) continue;
        const w = 1 - d / FOLLOW + 1e-3;
        for (let k = 0; k < 3; k++) move[k] += w * shift[j * 3 + k];
        total += w;
      }
      if (total > 0) for (let k = 0; k < 3; k++) pos[v * 3 + k] += move[k] / total;
      else if (nearest >= 0) for (let k = 0; k < 3; k++) pos[v * 3 + k] += shift[nearest * 3 + k];
    }
  }

  for (let i = 0; i < prims.length; i++) {
    prims[i].getAttribute("POSITION")!.setArray(after[i]);
    const normal = prims[i].getAttribute("NORMAL");
    const index = prims[i].getIndices()?.getArray();
    if (normal && index) normal.setArray(vertexNormals(after[i], index));
  }
  await io.write(output, doc);
  console.log(
    `${output}: ${panels.length} painéis alisados (${panels.join(", ")}), ` +
      `maior movimento ${(worst * 1000).toFixed(1)} mm`,
  );
}

/** Mediana da distância de cada ponto de `a` ao ponto mais perto de `b`. */
function medianDistance(a: Float32Array, b: Float32Array) {
  const around = makeGrid(b, 0.01);
  const ds: number[] = [];
  for (let i = 0; i < a.length / 3; i += 7) {
    const [x, y, z] = [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
    let best = Infinity;
    for (const j of around(x, y, z))
      best = Math.min(best, Math.hypot(b[j * 3] - x, b[j * 3 + 1] - y, b[j * 3 + 2] - z));
    ds.push(best);
  }
  ds.sort((p, q) => p - q);
  return ds[Math.floor(ds.length / 2)];
}

/** Taubin no tronco de um painel; devolve o maior movimento (m). */
function smoothPanel(
  prim: Primitive,
  rest: Float32Array,
  out: Float32Array,
  skin: Body,
) {
  const n = rest.length / 3;
  // Pontos repetidos na mesma posição (costura de UV) viram um só.
  const ids = new Map<string, number>();
  const node = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    const k = `${rest[v * 3].toFixed(6)},${rest[v * 3 + 1].toFixed(6)},${rest[v * 3 + 2].toFixed(6)}`;
    if (!ids.has(k)) ids.set(k, ids.size);
    node[v] = ids.get(k)!;
  }
  const m = ids.size;
  const p = new Float64Array(m * 3);
  for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) p[node[v] * 3 + k] = rest[v * 3 + k];

  // Vizinhos e bordas (aresta com uma face só).
  const index = prim.getIndices()!.getArray()!;
  const edges = new Map<string, number>();
  const neighbors: Set<number>[] = Array.from({ length: m }, () => new Set());
  for (let f = 0; f < index.length; f += 3) {
    const t = [node[index[f]], node[index[f + 1]], node[index[f + 2]]];
    for (let e = 0; e < 3; e++) {
      const [a, b] = [t[e], t[(e + 1) % 3]];
      if (a === b) continue;
      neighbors[a].add(b);
      neighbors[b].add(a);
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  const weight = new Float64Array(m).fill(Infinity);
  const first = new Int32Array(m);
  for (let v = n - 1; v >= 0; v--) first[node[v]] = v;
  const braco = prim.getAttribute("_BRACO")?.getArray();
  for (let v = 0; v < n; v++) {
    const y = rest[v * 3 + 1];
    let w = smooth(FROM_Y, FROM_Y + FADE, y) * (1 - smooth(TO_Y - FADE, TO_Y, y));
    if (braco) w *= 1 - smooth(ARM_FROM, ARM_TO, Math.abs(braco[v]));
    weight[node[v]] = Math.min(weight[node[v]], w);
  }
  for (const [k, c] of edges)
    if (c === 1) for (const a of k.split(",").map(Number)) weight[a] = 0;

  const step = (factor: number) => {
    const next = new Float64Array(p);
    for (let a = 0; a < m; a++) {
      if (weight[a] === 0 || neighbors[a].size === 0) continue;
      const mean = [0, 0, 0];
      for (const b of neighbors[a]) for (let k = 0; k < 3; k++) mean[k] += p[b * 3 + k];
      for (let k = 0; k < 3; k++)
        next[a * 3 + k] += weight[a] * factor * (mean[k] / neighbors[a].size - p[a * 3 + k]);
    }
    p.set(next);
  };
  // Abaixo de MIN_GAP, sai pela normal da pele (a cada rodada, para a
  // suavização espalhar o empurrão em vez de deixar um degrau).
  const keepOut = () => {
    for (let a = 0; a < m; a++) {
      if (weight[a] === 0) continue;
      const [x, y, z] = [p[a * 3], p[a * 3 + 1], p[a * 3 + 2]];
      const j = skin.grid.nearest(x, y, z, 2);
      if (j < 0) continue;
      const n = [skin.normals[j * 3], skin.normals[j * 3 + 1], skin.normals[j * 3 + 2]];
      const gap =
        (x - skin.positions[j * 3]) * n[0] +
        (y - skin.positions[j * 3 + 1]) * n[1] +
        (z - skin.positions[j * 3 + 2]) * n[2];
      if (gap < MIN_GAP) for (let k = 0; k < 3; k++) p[a * 3 + k] += n[k] * (MIN_GAP - gap) * weight[a];
    }
  };
  for (let r = 0; r < ROUNDS; r++) {
    step(LAMBDA);
    step(MU);
    keepOut();
  }

  let worst = 0;
  for (let a = 0; a < m; a++) {
    const v = first[a];
    worst = Math.max(
      worst,
      Math.hypot(p[a * 3] - rest[v * 3], p[a * 3 + 1] - rest[v * 3 + 1], p[a * 3 + 2] - rest[v * 3 + 2]),
    );
  }
  for (let v = 0; v < n; v++) for (let k = 0; k < 3; k++) out[v * 3 + k] = p[node[v] * 3 + k];
  return worst;
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
