import { NodeIO, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";

// Apaga a etiqueta branca da textura de cor. No hoodie ela fica do lado de
// dentro do punho direito e aparecia como uma tira branca na abertura da manga.
// Acha os pixels quase brancos, pega a caixa deles (com folga) e pinta de
// tecido: a mediana dos pixels de tecido logo em volta. Só a textura de cor muda.
//
// Uso: npx tsx scripts/tirar-etiqueta.ts entrada.glb saida.glb

const WHITE = 0.8; // brilho (0–1) acima disso é etiqueta
const PAD = 6; // px de folga em volta da etiqueta (pega o texto e a borda)
const RING = 40; // px em volta da caixa onde se mede o tecido
const FABRIC = [0.15, 0.7]; // brilho de tecido (fora disso é fundo preto ou etiqueta)

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("uso: tirar-etiqueta.ts entrada.glb saida.glb");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(input);
  const textures = new Set(doc.getRoot().listMaterials().map((m) => m.getBaseColorTexture()));
  for (const tex of textures) await eraseLabel(tex);
  await io.write(output, doc);
}

async function eraseLabel(tex: Texture | null) {
  const bytes = tex?.getImage();
  if (!tex || !bytes) return;
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const lum = (i: number) => (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;

  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (lum((y * W + x) * C) > WHITE) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  if (x1 < 0) {
    console.log(`${tex.getName()}: sem etiqueta`);
    return;
  }
  x0 = Math.max(x0 - PAD, 0); y0 = Math.max(y0 - PAD, 0);
  x1 = Math.min(x1 + PAD, W - 1); y1 = Math.min(y1 + PAD, H - 1);

  // Mediana de cada canal do tecido no anel em volta da caixa.
  const samples: number[][] = [[], [], []];
  for (let y = Math.max(y0 - RING, 0); y <= Math.min(y1 + RING, H - 1); y++)
    for (let x = Math.max(x0 - RING, 0); x <= Math.min(x1 + RING, W - 1); x++) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      const i = (y * W + x) * C;
      const l = lum(i);
      if (l < FABRIC[0] || l > FABRIC[1]) continue;
      for (let c = 0; c < 3; c++) samples[c].push(data[i + c]);
    }
  const fill = samples.map((s) => s.sort((a, b) => a - b)[s.length >> 1]);

  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * C;
      for (let c = 0; c < 3; c++) data[i + c] = fill[c];
    }
  const mime = tex.getMimeType();
  const raw = sharp(data, { raw: { width: W, height: H, channels: C } });
  const out = mime === "image/png" ? raw.png() : raw.jpeg({ quality: 95 });
  tex.setImage(new Uint8Array(await out.toBuffer()));
  console.log(`${tex.getName()}: etiqueta ${x1 - x0 + 1}×${y1 - y0 + 1} px em (${x0}, ${y0}) → rgb(${fill})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
