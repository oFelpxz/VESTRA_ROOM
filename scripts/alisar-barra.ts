import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Tira o "bico" do meio da frente e o vinco do meio das costas das camisetas,
// entre a barra e a barriga. O caimento com gravidade deixou uma dobra vertical
// de 3–4 cm saindo da frente (e um sulco de ~1 cm na linha da coluna); de
// baixo, os dois parecem a barra abrindo. O `alisar-peito.ts` para em 0,95 m e
// prende as bordas (a barra é borda), então não alcança isso.
//
// Para cada lado (frente +Z, costas −Z), mede a superfície de fora em faixas de
// 1 cm de altura e leva o meio até a reta que liga os dois lados dele (como o
// tecido de verdade, que passa reto por cima do sulco da coluna). A correção é um campo no espaço (x, y): todas as camadas
// (tecido, avesso, faixa da barra) andam juntas e a barra continua fechada.
// Só POSITION e NORMAL mudam.
//
// Uso: npx tsx scripts/alisar-barra.ts entrada.glb saida.glb

const CELL = 0.01; // m: altura de cada faixa medida
const FIT_FROM = 0.045; // m de |x|: a reta usa os pontos daqui...
const FIT_TO = 0.075; // m de |x|: ...até aqui
const MID = 0.04; // m de |x|: até aqui corrige tudo...
const MID_FADE = 0.03; // m: ...e some depois disso
const TO_Y = 1.04; // m: corrige abaixo daqui (acima, o `alisar-peito.ts` já alisou)
const FADE_Y = 0.06;
const PANEL = 0.03; // m de |z|: só o tecido de frente/costas, não a lateral

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** z = a + b·x pelos mínimos quadrados. */
function fitLine(xs: number[], zs: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const mz = zs.reduce((a, b) => a + b, 0) / n;
  let sxz = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxz += (xs[i] - mx) * (zs[i] - mz);
    sxx += (xs[i] - mx) ** 2;
  }
  const b = sxx > 0 ? sxz / sxx : 0;
  return (x: number) => mz + b * (x - mx);
}

/**
 * Correção em z (para fora do lado `side`) por faixa de altura, já suavizada
 * entre faixas vizinhas; `at(x, y)` dá a correção num ponto.
 */
function correction(all: Float32Array[], side: number) {
  let yMin = Infinity;
  for (const pos of all)
    for (let v = 0; v < pos.length / 3; v++)
      if (side * pos[v * 3 + 2] > PANEL) yMin = Math.min(yMin, pos[v * 3 + 1]);
  const rows = Math.ceil((TO_Y - yMin) / CELL) + 1;
  // Superfície de fora: o maior |z| em cada célula de 1 cm × 1 cm.
  const cols = Math.round((2 * FIT_TO) / CELL);
  const top = Array.from({ length: rows }, () => new Float64Array(cols).fill(-Infinity));
  for (const pos of all)
    for (let v = 0; v < pos.length / 3; v++) {
      const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], side * pos[v * 3 + 2]];
      if (z < PANEL || y > TO_Y + CELL || Math.abs(x) >= FIT_TO) continue;
      const r = Math.min(Math.max(Math.floor((y - yMin) / CELL), 0), rows - 1);
      const c = Math.floor((x + FIT_TO) / CELL);
      top[r][c] = Math.max(top[r][c], z);
    }
  // Célula sem ponto: média das vizinhas medidas da mesma faixa.
  for (const row of top)
    for (let c = 0; c < cols; c++) {
      if (row[c] > -Infinity) continue;
      const near = [row[c - 1], row[c + 1]].filter((v) => v !== undefined && v > -Infinity);
      if (near.length) row[c] = near.reduce((a, b) => a + b, 0) / near.length;
    }
  const raw = top.map((row) => {
    const xs: number[] = [];
    const zs: number[] = [];
    for (let c = 0; c < cols; c++) {
      const x = -FIT_TO + (c + 0.5) * CELL;
      if (Math.abs(x) >= FIT_FROM && row[c] > -Infinity) {
        xs.push(x);
        zs.push(row[c]);
      }
    }
    // os dois lados do meio precisam ter tecido medido
    if (!xs.some((x) => x < 0) || !xs.some((x) => x > 0)) return null;
    const base = fitLine(xs, zs);
    const out = new Float64Array(cols);
    for (let c = 0; c < cols; c++)
      if (row[c] > -Infinity) out[c] = base(-FIT_TO + (c + 0.5) * CELL) - row[c];
    return out;
  });
  // Faixa sem medida (a barra não é reta) fica com a mais perto que tem.
  const filled = raw.map((row, r) => {
    for (let d = 0; d < rows; d++) {
      const near = raw[r - d] ?? raw[r + d];
      if (near) return near;
    }
    return new Float64Array(cols);
  });
  // Média com as faixas de cima e de baixo, para não sair degrau.
  const fix = filled.map((row, r) =>
    row.map((_, c) => {
      const near = [filled[r - 1], row, filled[r + 1]].filter(Boolean);
      return near.reduce((a, b) => a + b[c], 0) / near.length;
    }),
  );

  return (x: number, y: number) => {
    const w = (1 - smooth(MID, MID + MID_FADE, Math.abs(x))) * (1 - smooth(TO_Y - FADE_Y, TO_Y, y));
    if (w === 0) return 0;
    const fr = Math.min(Math.max((y - yMin) / CELL - 0.5, 0), rows - 1);
    const fc = Math.min(Math.max((x + FIT_TO) / CELL - 0.5, 0), cols - 1);
    const [r0, c0] = [Math.floor(fr), Math.floor(fc)];
    const [r1, c1] = [Math.min(r0 + 1, rows - 1), Math.min(c0 + 1, cols - 1)];
    const [a, b] = [fr - r0, fc - c0];
    const v =
      (fix[r0][c0] * (1 - b) + fix[r0][c1] * b) * (1 - a) + (fix[r1][c0] * (1 - b) + fix[r1][c1] * b) * a;
    return v * w;
  };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);
  const prims = doc.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  const before = prims.map((p) => new Float32Array(p.getAttribute("POSITION")!.getArray()!));

  let worst = 0;
  const fixes = [1, -1].map((side) => ({ side, at: correction(before, side) }));
  prims.forEach((prim, i) => {
    const pos = new Float32Array(before[i]);
    let moved = false;
    for (let v = 0; v < pos.length / 3; v++) {
      const [x, y, z] = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
      for (const { side, at } of fixes) {
        if (side * z <= PANEL) continue;
        const d = at(x, y);
        if (d === 0) continue;
        pos[v * 3 + 2] += side * d;
        worst = Math.max(worst, Math.abs(d));
        moved = true;
      }
    }
    if (!moved) return;
    prim.getAttribute("POSITION")!.setArray(pos);
    prim.getAttribute("NORMAL")?.setArray(vertexNormals(pos, prim.getIndices()!.getArray()!));
  });
  await io.write(output, doc);
  console.log(`${input} → ${output}: maior correção ${(worst * 100).toFixed(1)} cm`);
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
