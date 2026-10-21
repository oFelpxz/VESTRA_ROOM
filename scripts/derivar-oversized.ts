import { NodeIO, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Oversized Shirt a partir do molde da Boxy Tee 01 (scripts/molde, molde M):
// mesmo tecido e mesmas marcas do provador (vestra_fit, _BRACO), mas com o
// corte maior — tronco mais largo dos ombros para baixo, mais comprido, manga
// mais longa e mais larga. Uma única deformação vale para o tronco e as mangas,
// então a costura entre eles continua fechada; o alongamento e o alargamento
// da manga começam em zero na cava pelo mesmo motivo.
//
// Uso: npx tsx scripts/derivar-oversized.ts public/models/boxy_tee_01.glb public/models/oversized_shirt.glb

const WIDTH = 1.1; // tronco: largura (x) dos ombros para baixo
const DEPTH = 1.08; // tronco: profundidade (z)
const AXIS_Z = 0.05; // m: meio do tronco, de frente para trás
const NECK_Y = 1.44; // m: na gola não alarga...
const SHOULDER_Y = 1.34; // ...e daqui para baixo alarga tudo
const STRETCH_FROM_Y = 1.1; // m: abaixo daqui o tronco alonga
const EXTRA_LENGTH = 0.06; // m: barra mais baixa
const HEM_Y = 0.783; // m: barra do molde
const SLEEVE_LENGTH = 1.3; // manga: comprimento (da cava ao punho)
const SLEEVE_WIDTH = 1.12; // manga: abertura

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const STRETCH = 1 + EXTRA_LENGTH / (STRETCH_FROM_Y - HEM_Y);

/** Deformação do corpo inteiro (tronco e mangas): devolve a escala local para as normais. */
function body(p: number[]): [number, number, number] {
  const w = smooth(NECK_Y, SHOULDER_Y, p[1]);
  const sx = 1 + (WIDTH - 1) * w;
  const sz = 1 + (DEPTH - 1) * w;
  p[0] *= sx;
  p[2] = AXIS_Z + (p[2] - AXIS_Z) * sz;
  let sy = 1;
  if (p[1] < STRETCH_FROM_Y) {
    p[1] = STRETCH_FROM_Y - (STRETCH_FROM_Y - p[1]) * STRETCH;
    sy = STRETCH;
  }
  return [sx, sy, sz];
}

const key = (x: number, y: number, z: number) =>
  `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`;

/** Pontos do tronco (2 mm), para achar a cava das mangas. */
function torsoPoints(prims: Primitive[]) {
  const set = new Set<string>();
  for (const prim of prims) {
    const pos = prim.getAttribute("POSITION")!.getArray()!;
    for (let i = 0; i < pos.length; i += 3) set.add(key(pos[i], pos[i + 1], pos[i + 2]));
  }
  return set;
}

function onTorso(torso: Set<string>, x: number, y: number, z: number) {
  for (const dx of [-0.002, 0, 0.002])
    for (const dy of [-0.002, 0, 0.002])
      for (const dz of [-0.002, 0, 0.002]) if (torso.has(key(x + dx, y + dy, z + dz))) return true;
  return false;
}

/**
 * Manga: o eixo vai do meio da cava (os pontos costurados no tronco) ao meio
 * do punho (os mais longe da cava). Da cava para dentro nada muda.
 */
function sleeve(prim: Primitive, torso: Set<string>) {
  const posAttr = prim.getAttribute("POSITION")!;
  const pos = posAttr.getArray() as Float32Array<ArrayBuffer>;
  const n = pos.length / 3;
  const seam = [...Array(n).keys()].filter((i) =>
    onTorso(torso, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]),
  );
  if (seam.length < 10) throw new Error("Não achei a cava da manga");
  const mean = (ids: number[]) => {
    const m = [0, 0, 0];
    for (const i of ids) for (let k = 0; k < 3; k++) m[k] += pos[i * 3 + k] / ids.length;
    return m;
  };
  const root = mean(seam);
  const dist = (i: number) =>
    Math.hypot(pos[i * 3] - root[0], pos[i * 3 + 1] - root[1], pos[i * 3 + 2] - root[2]);
  const far = [...Array(n).keys()].sort((a, b) => dist(b) - dist(a)).slice(0, Math.ceil(n * 0.05));
  const cuff = mean(far);
  const d = cuff.map((v, k) => v - root[k]);
  const len = Math.hypot(...d);
  const dir = d.map((v) => v / len);
  const tOf = (i: number) =>
    (pos[i * 3] - root[0]) * dir[0] + (pos[i * 3 + 1] - root[1]) * dir[1] + (pos[i * 3 + 2] - root[2]) * dir[2];
  const t0 = Math.max(...seam.map(tOf));

  for (let i = 0; i < n; i++) {
    const t = tOf(i);
    const rel = [pos[i * 3] - root[0], pos[i * 3 + 1] - root[1], pos[i * 3 + 2] - root[2]];
    const perp = rel.map((v, k) => v - t * dir[k]);
    // Depois da cava: até a metade da manga a abertura chega toda.
    const along = Math.max(t - t0, 0);
    const widen = 1 + (SLEEVE_WIDTH - 1) * smooth(0, (len - t0) * 0.5, along);
    const t2 = Math.min(t, t0) + along * SLEEVE_LENGTH;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = root[k] + t2 * dir[k] + perp[k] * widen;
  }
  posAttr.setArray(pos);
  console.log(`manga: ${seam.length} pontos na cava, ${(len * 100).toFixed(1)} cm de eixo`);
}

async function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) throw new Error("uso: derivar-oversized.ts <tee.glb> <saída.glb>");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  if (doc.getRoot().listScenes()[0]?.getExtras().vestra_fit !== "avatar_base") {
    throw new Error("A entrada precisa ser um molde do provador (vestra_fit = avatar_base)");
  }

  // As mangas usam o material "Sleeves" (o tronco, "Body").
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const isSleeve = (p: Primitive) => /sleeve/i.test(p.getMaterial()?.getName() ?? "");
  const torso = torsoPoints(prims.filter((p) => !isSleeve(p)));
  for (const prim of prims.filter(isSleeve)) sleeve(prim, torso);

  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {

      const posAttr = prim.getAttribute("POSITION")!;
      const pos = posAttr.getArray() as Float32Array<ArrayBuffer>;
      const normAttr = prim.getAttribute("NORMAL");
      const norm = normAttr?.getArray() as Float32Array<ArrayBuffer> | undefined;
      for (let i = 0; i < pos.length; i += 3) {
        const p = [pos[i], pos[i + 1], pos[i + 2]];
        const s = body(p);
        pos.set(p, i);
        if (norm) {
          // Escala não uniforme: a normal vai com o inverso.
          const n = [norm[i] / s[0], norm[i + 1] / s[1], norm[i + 2] / s[2]];
          const l = Math.hypot(...n) || 1;
          norm.set([n[0] / l, n[1] / l, n[2] / l], i);
        }
      }
      posAttr.setArray(pos);
      if (normAttr && norm) normAttr.setArray(norm);
    }
  }

  await io.write(dst, doc);
  console.log(`Oversized: ${dst}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
