import * as THREE from "three";

/**
 * Cor escolhida pelo cliente aplicada na peça 3D.
 *
 * Multiplicar a cor pela textura (o padrão do three.js) não clareia: um
 * moletom com textura preta continuava preto com "Branco" selecionado. Aqui o
 * tom vem da cor escolhida e a textura entra só com o relevo dela (tricô,
 * dobras, sombras): cada ponto da textura é dividido pelo brilho médio dela,
 * então a média vira 1 e sobra o desenho. Estampas coloridas viram tons da
 * cor escolhida.
 */

// Quanto do desenho da textura aparece (0 = cor lisa, 1 = contraste original).
const DETAIL = 1;
// Limite de clareamento de um ponto em relação à média (evita estourar ruído).
const MAX_GAIN = 2.5;
// Resolução da amostra usada para medir o brilho médio.
const SAMPLE = 64;

const meanCache = new WeakMap<THREE.Texture, number>();

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Brilho médio da textura em espaço linear (o mesmo que o shader vê). */
function meanLuminance(texture: THREE.Texture): number | null {
  const cached = meanCache.get(texture);
  if (cached !== undefined) return cached;
  const image = texture.image as CanvasImageSource & { width?: number };
  if (!image || !image.width || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
  const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const srgb = texture.colorSpace === THREE.SRGBColorSpace;
  const lin = (v: number) => (srgb ? toLinear(v / 255) : v / 255);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4)
    sum += 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
  const mean = Math.max(sum / (data.length / 4), 1e-4);
  meanCache.set(texture, mean);
  return mean;
}

/**
 * Cópia do material na cor escolhida. Sem cor, devolve só a cópia (a peça
 * aparece como veio do arquivo). Quem chama libera a cópia com `dispose()`.
 */
export function tintMaterial(
  source: THREE.Material,
  color: string | undefined,
): THREE.Material {
  const material = source.clone();
  const m = material as THREE.MeshStandardMaterial;
  if (!color || !m.color) return material;
  m.color.set(color);
  const mean = m.map ? meanLuminance(m.map) : null;
  if (mean == null) return material; // sem textura: a cor lisa já basta

  m.onBeforeCompile = (shader) => {
    shader.uniforms.vestraMapMean = { value: mean };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform float vestraMapMean;\nvoid main() {")
      .replace(
        "#include <map_fragment>",
        /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float vestraLum = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  float vestraGain = clamp( vestraLum / vestraMapMean, 0.0, ${MAX_GAIN.toFixed(2)} );
  diffuseColor.rgb *= mix( 1.0, vestraGain, ${DETAIL.toFixed(2)} );
  diffuseColor.a *= sampledDiffuseColor.a;
#endif`,
      );
  };
  // Materiais com e sem esse ajuste não podem dividir o mesmo programa.
  m.customProgramCacheKey = () => "vestra-tint";
  return material;
}
