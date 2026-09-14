import { readFile, writeFile } from "node:fs/promises";
import { optimizeGlb } from "../src/lib/model-optimizer";

/**
 * Roda o pipeline de compressão (item 3D-01, `src/lib/model-optimizer.ts`) em
 * arquivos `.glb` locais que nunca passaram por upload/otimização — caso do
 * `hoodie_core.glb` e `tech_vest.glb`, seedados direto em `public/models/`.
 *
 * Uso: npx tsx scripts/recompress-model.ts public/models/arquivo1.glb public/models/arquivo2.glb
 */

function fmtMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error("Uso: npx tsx scripts/recompress-model.ts <arquivo.glb> [...]");
    process.exit(1);
  }

  for (const path of paths) {
    const input = await readFile(path);
    const result = await optimizeGlb(new Uint8Array(input));

    if (!result.optimized) {
      console.log(`${path}: sem ganho, mantido (${fmtMb(result.originalBytes)})`);
      continue;
    }

    await writeFile(path, result.data);
    console.log(
      `${path}: ${fmtMb(result.originalBytes)} -> ${fmtMb(result.optimizedBytes)} ` +
        `(-${(result.ratio * 100).toFixed(1)}%)`,
    );
  }
}

main();
