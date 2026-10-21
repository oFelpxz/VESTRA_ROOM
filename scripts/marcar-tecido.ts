import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// Marca o tecido de cada peça do provador na cena do .glb (`vestra_tecido`),
// lido por src/lib/fabric.ts para escolher a trama e o brilho. Sem a marca, o
// provador usa o nome do material ("Cetim", "Trico", "Tecido" = sarja) ou
// algodão.
//
// Uso: npx tsx scripts/marcar-tecido.ts   (rodar de novo depois de gerar um molde)

const TECIDO: Record<string, string> = {
  "boxy_tee_01.glb": "algodao",
  "relugar-t-shirt-v1.glb": "algodao",
  "oversized_shirt.glb": "algodao",
  "hoodie-core-v3.glb": "moletom",
  "cargo_pant_02.glb": "sarja",
  "bermuda_utility.glb": "sarja",
  "saia_midi_plissada.glb": "sarja",
  "wide_denim.glb": "denim",
  "vestido_slip.glb": "cetim",
  "knit_beanie.glb": "trico",
};

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  for (const [file, tecido] of Object.entries(TECIDO)) {
    const path = `public/models/${file}`;
    const doc = await io.read(path);
    for (const scene of doc.getRoot().listScenes())
      scene.setExtras({ ...scene.getExtras(), vestra_tecido: tecido });
    await io.write(path, doc);
    console.log(`${file}: ${tecido}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
