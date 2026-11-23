import { NodeIO, type Document, type Material, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Camisa Studio a partir da Oversized Shirt (mesmo molde, mesmo corte folgado
// e as mesmas correções de peito e barra): ganha gola, carcela e botões.
//
// - Gola: sai da borda de cima da ribana (que vira o pé da gola), vira para
//   fora e desce sobre os ombros; na frente fica mais comprida e termina em
//   ponta, com uma folga no meio. Nunca chega a menos de 4 mm do tecido.
// - Carcela: faixa de 3,2 cm no meio da frente, 3 mm acima do tecido, do pé
//   da gola até perto da barra, com uma borda descendo até o tecido (de lado
//   não aparece fresta).
// - Botões: discos de 11 mm sobre a carcela, no material "Botao", que o
//   provador não pinta com a cor escolhida (src/lib/garment-color.ts).
//
// Tudo entra como malha nova com o material do tronco (gola e carcela) e
// `_BRACO` = 0; o provador veste junto com o resto.
//
// Uso: npx tsx scripts/derivar-camisa.ts public/models/oversized_shirt.glb public/models/camisa_studio.glb

const CELL_A = 5; // graus: fatias em volta do pescoço
const CELL_Y = 0.01; // m
const CLEAR = 0.004; // m: a gola fica pelo menos isso fora do tecido
const COLLAR_BACK = 0.042; // m: largura da gola atrás e dos lados...
const COLLAR_TIP = 0.07; // ...e na ponta da frente
const COLLAR_GAP = 7; // graus: folga entre as pontas, no meio da frente
const COLLAR_DROP = 55; // graus abaixo da horizontal
const COLLAR_STEP = 3; // graus entre as colunas da gola
const COLLAR_ROWS = 12;
const TIP_PULL = 50; // graus por metro: a ponta da frente puxa para o meio sem cruzar a outra
const EDGE_AVG = 2; // fatias de cada lado na média da borda da ribana
const SURF_AVG = 2; // fatias de cada lado na média do tecido
const COL_AVG = 3; // colunas de cada lado na média da gola
const PLACKET_W = 0.032; // m
const PLACKET_LIFT = 0.003; // m
const PLACKET_STEP = 0.005; // m
const BUTTON_R = 0.0055; // m
const BUTTON_T = 0.0018; // m
const BUTTON_GAP = 0.1; // m entre botões
const BUTTON_SEG = 20;
const BUTTON_COLOR = [0.93, 0.91, 0.87, 1] as const; // perolado

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

type Mesh = { pos: number[]; uv: number[]; index: number[] };
const newMesh = (): Mesh => ({ pos: [], uv: [], index: [] });

/** Pontos de todas as malhas do tronco (material que não é de manga). */
function torsoPoints(prims: Primitive[]) {
  const out: number[] = [];
  for (const p of prims) out.push(...(p.getAttribute("POSITION")!.getArray() as Float32Array));
  return out;
}

/** Ribana da gola: as malhas do tronco que ficam todas acima do ombro. */
const isRib = (p: Primitive) => p.getAttribute("POSITION")!.getMin([0, 0, 0])[1] > 1.3;

function collar(rib: number[], torso: number[]): Mesh {
  // Meio do pescoço em z: entre a frente e as costas da ribana.
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < rib.length; i += 3) {
    zMin = Math.min(zMin, rib[i]);
    zMax = Math.max(zMax, rib[i]);
  }
  const cz = (zMin + zMax) / 2;
  const angle = (x: number, z: number) => (Math.atan2(x, z - cz) * 180) / Math.PI;

  // Borda de cima da ribana, por fatia: o ponto mais alto (o de fora, se empatar).
  const sectors = 360 / CELL_A;
  const top: { y: number; r: number }[] = Array.from({ length: sectors }, () => ({ y: -Infinity, r: 0 }));
  const secOf = (a: number) => Math.floor((((a % 360) + 360) % 360) / CELL_A) % sectors;
  for (let i = 0; i < rib.length; i += 3) {
    const [x, y, z] = [rib[i], rib[i + 1], rib[i + 2]];
    const s = top[secOf(angle(x, z))];
    const r = Math.hypot(x, z - cz);
    if (y > s.y + 0.002 || (y > s.y - 0.002 && r > s.r)) {
      s.y = Math.max(y, s.y);
      s.r = r;
    }
  }
  // média com as fatias vizinhas: a borda da malha é serrilhada
  const avg = (k: number, key: "y" | "r") => {
    let sum = 0;
    for (let d = -EDGE_AVG; d <= EDGE_AVG; d++) sum += top[(k + d + sectors) % sectors][key];
    return sum / (2 * EDGE_AVG + 1);
  };
  const smoothTop = top.map((_, k) => ({ y: avg(k, "y"), r: avg(k, "r") }));
  top.splice(0, sectors, ...smoothTop);
  const edgeAt = (a: number) => {
    const f = (((a % 360) + 360) % 360) / CELL_A - 0.5;
    const k0 = ((Math.floor(f) % sectors) + sectors) % sectors;
    const k1 = (k0 + 1) % sectors;
    const t = f - Math.floor(f);
    return { y: top[k0].y * (1 - t) + top[k1].y * t, r: top[k0].r * (1 - t) + top[k1].r * t };
  };

  // Tecido em volta do pescoço: o maior raio por fatia × faixa.
  const yLo = 1.2;
  const rows = 40;
  const surf = Array.from({ length: rows }, () => new Float64Array(sectors));
  for (let i = 0; i < torso.length; i += 3) {
    const [x, y, z] = [torso[i], torso[i + 1], torso[i + 2]];
    const row = Math.floor((y - yLo) / CELL_Y);
    if (row < 0 || row >= rows) continue;
    const s = secOf(angle(x, z));
    surf[row][s] = Math.max(surf[row][s], Math.hypot(x, z - cz));
  }
  // Fatia sem ponto fica com a vizinha; depois, média em volta e com as faixas
  // de cima e de baixo (o contorno do tecido varia aos saltos de uma fatia
  // para outra, e a gola copiaria os saltos).
  for (const row of surf)
    for (let pass = 0; pass < sectors && row.includes(0); pass++)
      row.forEach((v, s) => {
        if (!v) row[s] = Math.max(row[(s + 1) % sectors], row[(s + sectors - 1) % sectors]);
      });
  const even = surf.map((_, r) =>
    Float64Array.from({ length: sectors }, (_, s) => {
      let sum = 0;
      let n = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let ds = -SURF_AVG; ds <= SURF_AVG; ds++) {
          const v = surf[r + dr]?.[(s + ds + sectors) % sectors];
          if (v) {
            sum += v;
            n++;
          }
        }
      return n ? sum / n : 0;
    }),
  );
  const surfAt = (a: number, y: number) => {
    const f = Math.min(Math.max((y - yLo) / CELL_Y - 0.5, 0), rows - 1);
    const r0 = Math.floor(f);
    const r1 = Math.min(r0 + 1, rows - 1);
    const s = secOf(a);
    return even[r0][s] * (1 - (f - r0)) + even[r1][s] * (f - r0);
  };

  const cols = Math.round((360 - 2 * COLLAR_GAP) / COLLAR_STEP) + 1;
  const ring: { r: number; y: number; at: number }[][] = [];
  const drop = (COLLAR_DROP * Math.PI) / 180;
  for (let c = 0; c < cols; c++) {
    // de uma ponta (frente, +X) passando pelas costas até a outra
    const a = COLLAR_GAP + ((360 - 2 * COLLAR_GAP) * c) / (cols - 1);
    const signed = a > 180 ? a - 360 : a;
    const front = 1 - smooth(COLLAR_GAP, 50, Math.abs(signed));
    const len = COLLAR_BACK + (COLLAR_TIP - COLLAR_BACK) * front;
    const edge = edgeAt(a);
    for (let k = 0; k < COLLAR_ROWS; k++) {
      const s = (len * k) / (COLLAR_ROWS - 1);
      // a dobra: começa subindo 4 mm acima da ribana e vira para baixo
      const bend = Math.min(s / 0.01, 1);
      let r = edge.r + 0.002 + s * Math.cos(drop) * bend + 0.004 * (1 - bend);
      const y = edge.y + 0.004 * (1 - bend) - s * Math.sin(drop) * bend;
      // a ponta da frente puxa para o meio
      const at = a - Math.sign(signed) * front * s * TIP_PULL;
      r = Math.max(r, surfAt(at, y) + CLEAR);
      // a gola só abre para fora, nunca volta para dentro
      if (k) r = Math.max(r, ring[c][k - 1].r);
      (ring[c] ??= []).push({ r, y, at });
    }
  }
  // média com as colunas vizinhas (sem passar das pontas), para a borda sair lisa
  const m = newMesh();
  for (let c = 0; c < cols; c++)
    for (let k = 0; k < COLLAR_ROWS; k++) {
      let r = 0;
      let n = 0;
      for (let d = -COL_AVG; d <= COL_AVG; d++) {
        const p = ring[c + d]?.[k];
        if (p) {
          r += p.r;
          n++;
        }
      }
      // sem descer do tecido por causa da média
      r = Math.max(r / n, ring[c][k].r - 0.002);
      const { y, at } = ring[c][k];
      const rad = (at * Math.PI) / 180;
      m.pos.push(r * Math.sin(rad), y, cz + r * Math.cos(rad));
      m.uv.push(c / (cols - 1), k / (COLLAR_ROWS - 1));
    }
  grid(m, 0, cols, COLLAR_ROWS);
  return m;
}

/** Triângulos de uma grade (colunas × linhas), já na malha. */
function grid(m: Mesh, first: number, cols: number, rows: number) {
  for (let c = 0; c < cols - 1; c++)
    for (let k = 0; k < rows - 1; k++) {
      const p = first + c * rows + k;
      m.index.push(p, p + 1, p + rows, p + 1, p + rows + 1, p + rows);
    }
}

/** Frente do tronco: o maior z por célula de 5 mm × 1 cm, perto do meio. */
function frontSurface(torso: number[]) {
  const half = PLACKET_W;
  const cell = 0.005;
  const cols = Math.round((2 * half) / cell);
  const yLo = 0.6;
  const rows = 100;
  const z = Array.from({ length: rows }, () => new Float64Array(cols).fill(-Infinity));
  for (let i = 0; i < torso.length; i += 3) {
    const [x, y, zz] = [torso[i], torso[i + 1], torso[i + 2]];
    if (Math.abs(x) >= half || zz < 0.05) continue;
    const r = Math.floor((y - yLo) / CELL_Y);
    if (r < 0 || r >= rows) continue;
    const c = Math.floor((x + half) / cell);
    z[r][c] = Math.max(z[r][c], zz);
  }
  // altura da barra no meio da frente (antes de preencher)
  let hem = Infinity;
  for (let r = 0; r < rows && hem === Infinity; r++) if (z[r].some((v) => v > -Infinity)) hem = yLo + r * CELL_Y;
  // Célula sem ponto (a malha é esparsa): média das vizinhas, crescendo.
  for (let pass = 0; pass < 20; pass++) {
    const prev = z.map((row) => row.slice());
    let empty = 0;
    for (let r = Math.floor((hem - yLo) / CELL_Y); r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (prev[r][c] > -Infinity) continue;
        const near = [prev[r - 1]?.[c], prev[r + 1]?.[c], prev[r][c - 1], prev[r][c + 1]].filter(
          (v): v is number => v !== undefined && v > -Infinity,
        );
        if (near.length) z[r][c] = near.reduce((s, v) => s + v, 0) / near.length;
        else empty++;
      }
    if (!empty) break;
  }
  const at = (x: number, y: number) => {
    const fr = Math.min(Math.max((y - yLo) / CELL_Y - 0.5, 0), rows - 1);
    const fc = Math.min(Math.max((x + half) / cell - 0.5, 0), cols - 1);
    let sum = 0;
    let got = 0;
    for (const r of [Math.floor(fr), Math.ceil(fr)])
      for (const c of [Math.floor(fc), Math.ceil(fc)]) {
        const w = (1 - Math.abs(fr - r)) * (1 - Math.abs(fc - c));
        if (z[r][c] > -Infinity && w > 0) {
          sum += z[r][c] * w;
          got += w;
        }
      }
    return got ? sum / got : NaN;
  };
  return { at, hem };
}

function placket(front: ReturnType<typeof frontSurface>, yTop: number): Mesh {
  const m = newMesh();
  // da direita (+X) para a esquerda: assim a face da faixa olha para fora
  const xs = [0.5, 0.5, 0.375, 0.25, 0.125, 0, -0.125, -0.25, -0.375, -0.5, -0.5].map((t) => t * PLACKET_W);
  const yBottom = front.hem + 0.012;
  const rows = Math.round((yTop - yBottom) / PLACKET_STEP) + 1;
  xs.forEach((x, c) => {
    // a primeira e a última coluna descem até o tecido (a borda da faixa)
    const lift = c === 0 || c === xs.length - 1 ? -0.001 : PLACKET_LIFT;
    for (let k = 0; k < rows; k++) {
      const y = yBottom + ((yTop - yBottom) * k) / (rows - 1);
      m.pos.push(x, y, front.at(x, y) + lift);
      m.uv.push(0.5 - x / PLACKET_W, k / (rows - 1));
    }
  });
  grid(m, 0, xs.length, rows);
  return m;
}

function buttons(front: ReturnType<typeof frontSurface>, yTop: number): Mesh {
  const m = newMesh();
  for (let y = yTop - 0.025; y > front.hem + 0.08; y -= BUTTON_GAP) {
    const z = front.at(0, y) + PLACKET_LIFT;
    // inclinação da frente: o botão deita na carcela
    const dz = (front.at(0, y + 0.01) - front.at(0, y - 0.01)) / 0.02;
    const n = [0, -dz, 1].map((v) => v / Math.hypot(dz, 1));
    const up = [0, 1, dz].map((v) => v / Math.hypot(dz, 1));
    const put = (u: number, v: number, h: number) =>
      m.pos.push(u, y + v * up[1] + h * n[1], z + v * up[2] + h * n[2]);
    const first = m.pos.length / 3;
    // miolo um pouco mais baixo que a borda (pega luz e aparece)
    put(0, 0, BUTTON_T * 0.6);
    m.uv.push(0.5, 0.5);
    for (const [r, h] of [
      [BUTTON_R * 0.8, BUTTON_T],
      [BUTTON_R, BUTTON_T * 0.8],
      [BUTTON_R, 0],
    ])
      for (let s = 0; s < BUTTON_SEG; s++) {
        const t = (s / BUTTON_SEG) * 2 * Math.PI;
        put(r * Math.cos(t), r * Math.sin(t), h);
        m.uv.push(0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t));
      }
    for (let s = 0; s < BUTTON_SEG; s++) {
      const s1 = (s + 1) % BUTTON_SEG;
      m.index.push(first, first + 1 + s, first + 1 + s1);
      for (let ring = 0; ring < 2; ring++) {
        const a = first + 1 + ring * BUTTON_SEG;
        const b = a + BUTTON_SEG;
        m.index.push(a + s, b + s, b + s1, a + s, b + s1, a + s1);
      }
    }
  }
  return m;
}

/** Normais por ponto (média das faces em volta, pesada pela área). */
function vertexNormals(pos: number[], index: number[]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(pos.length);
  for (let f = 0; f < index.length; f += 3) {
    const [a, b, c] = [index[f], index[f + 1], index[f + 2]];
    const u = [0, 1, 2].map((k) => pos[b * 3 + k] - pos[a * 3 + k]);
    const v = [0, 1, 2].map((k) => pos[c * 3 + k] - pos[a * 3 + k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) out[p * 3 + k] += n[k];
  }
  for (let i = 0; i < out.length; i += 3) {
    const len = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    for (let k = 0; k < 3; k++) out[i + k] /= len;
  }
  return out;
}

function addMesh(doc: Document, name: string, m: Mesh, material: Material) {
  const buffer = doc.getRoot().listBuffers()[0];
  const acc = (type: "VEC3" | "VEC2" | "SCALAR", array: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>) =>
    doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", new Float32Array(m.pos)))
    .setAttribute("NORMAL", acc("VEC3", vertexNormals(m.pos, m.index)))
    .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(m.uv)))
    .setAttribute("_BRACO", acc("SCALAR", new Float32Array(m.pos.length / 3)))
    .setIndices(acc("SCALAR", new Uint32Array(m.index)))
    .setMaterial(material);
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
  doc.getRoot().listScenes()[0].addChild(node);
  console.log(`${name}: ${m.pos.length / 3} pontos, ${m.index.length / 3} triângulos`);
}

async function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) throw new Error("uso: derivar-camisa.ts <oversized.glb> <saída.glb>");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  if (doc.getRoot().listScenes()[0]?.getExtras().vestra_fit !== "avatar_base") {
    throw new Error("A entrada precisa ser um molde do provador (vestra_fit = avatar_base)");
  }

  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const body = prims.filter((p) => !/sleeve/i.test(p.getMaterial()?.getName() ?? ""));
  const rib = torsoPoints(body.filter(isRib));
  const torso = torsoPoints(body);
  const cloth = body[0].getMaterial()!;

  // Pé da gola na frente: a parte mais baixa da ribana no meio.
  let yTop = Infinity;
  for (let i = 0; i < rib.length; i += 3)
    if (Math.abs(rib[i]) < 0.01 && rib[i + 2] > 0.05) yTop = Math.min(yTop, rib[i + 1]);
  const front = frontSurface(torso);

  const button = doc
    .createMaterial("Botao")
    .setBaseColorFactor([...BUTTON_COLOR])
    .setRoughnessFactor(0.35)
    .setMetallicFactor(0);
  addMesh(doc, "Gola", collar(rib, torso), cloth);
  addMesh(doc, "Carcela", placket(front, yTop), cloth);
  addMesh(doc, "Botoes", buttons(front, yTop), button);

  await io.write(dst, doc);
  console.log(`Camisa: ${dst} (pé da gola em ${yTop.toFixed(3)} m, barra em ${front.hem.toFixed(3)} m)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
