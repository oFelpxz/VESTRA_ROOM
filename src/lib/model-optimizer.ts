import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  join,
  prune,
  quantize,
  resample,
  weld,
} from "@gltf-transform/functions";

/**
 * Compressão / otimização automática de modelos `.glb` no upload (item 3D-01).
 *
 * Pipeline puramente geométrico, sem dependência de decoder no cliente nem de
 * binários nativos (sharp) no servidor:
 * - dedup / prune / flatten / join  -> remove duplicatas e reduz draw calls
 * - weld                            -> solda vértices coincidentes
 * - resample                        -> enxuga tracks de animação
 * - quantize (KHR_mesh_quantization)-> menos bits por atributo (o three.js lê nativo)
 *
 * Fora de escopo por ora: recompressão de texturas (WebP/KTX2) e Draco/Meshopt —
 * exigiriam sharp no build e/ou configurar o decoder no viewer.
 */

export type OptimizeResult = {
  data: Uint8Array;
  originalBytes: number;
  optimizedBytes: number;
  /** Fração reduzida (0–1). Negativo se o resultado ficou maior. */
  ratio: number;
  /** `false` quando a otimização falhou e devolvemos o arquivo original. */
  optimized: boolean;
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export async function optimizeGlb(input: Uint8Array): Promise<OptimizeResult> {
  const originalBytes = input.byteLength;

  try {
    const doc = await io.readBinary(input);

    await doc.transform(
      dedup(),
      flatten(),
      join(),
      weld(),
      resample(),
      prune({ keepLeaves: false }),
      quantize(),
    );

    const out = await io.writeBinary(doc);

    // Se por acaso ficou maior (modelos já enxutos), mantém o original.
    if (out.byteLength >= originalBytes) {
      return {
        data: input,
        originalBytes,
        optimizedBytes: originalBytes,
        ratio: 0,
        optimized: false,
      };
    }

    return {
      data: out,
      originalBytes,
      optimizedBytes: out.byteLength,
      ratio: 1 - out.byteLength / originalBytes,
      optimized: true,
    };
  } catch (e) {
    console.error("optimizeGlb falhou, mantendo arquivo original:", e);
    return {
      data: input,
      originalBytes,
      optimizedBytes: originalBytes,
      ratio: 0,
      optimized: false,
    };
  }
}
