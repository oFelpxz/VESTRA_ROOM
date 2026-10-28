/**
 * Sombra macia de estúdio (lista 12, item 8): a sombra da luz principal fica
 * nítida onde encosta (barra da camiseta sobre a calça, braço no tronco) e
 * abre conforme a peça se afasta, como sob um softbox. Antes era o mesmo
 * borrão em tudo: a barra parecia flutuar e a sombra do braço tinha recorte.
 *
 * É o PCSS (sombra com penumbra pela distância) reescrito para o three 0.184:
 * o mapa de sombra agora só responde "luz ou sombra" (`sampler2DShadow`) e não
 * entrega a profundidade, então o `SoftShadows` do drei não compila. Aqui a
 * distância de quem faz sombra sai de perguntas em degraus ("há algo mais de
 * 1 cm na frente? 4 cm? 12 cm?") e vira o raio do borrão.
 */

import * as THREE from "three";

/** Câmera da sombra da luz principal (`StudioLights`), em metros. */
export const SHADOW_CAMERA = { half: 1.6, near: 1, far: 14 } as const;
/** Resolução do mapa de sombra da luz principal. */
export const SHADOW_MAP_SIZE = 2048;

/** Raio do borrão por metro entre a peça e a sombra (softbox de 4 m a 7 m). */
const PENUMBRA = 0.25;
/** Maior raio do borrão, em metros (o corpo no chão já fica bem aberto). */
const MAX_RADIUS = 0.06;
/** Degraus da busca, em metros. O primeiro ignora a curva da própria peça. */
const STEPS = [0.005, 0.01, 0.04, 0.12] as const;

const num = (v: number) => v.toFixed(6);

function pcssFunction() {
  const depth = SHADOW_CAMERA.far - SHADOW_CAMERA.near;
  const toUv = 1 / (2 * SHADOW_CAMERA.half);
  const [d0, d1, d2, d3] = STEPS.map((d) => num(d / depth));
  return /* glsl */ `
		float vestraBlocked( sampler2DShadow shadowMap, vec2 uv, float z ) {

			return 1.0 - texture( shadowMap, vec3( uv, z ) );

		}

		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;

				// Quem faz sombra, e a que distância (em degraus de profundidade).
				float search = ${num(MAX_RADIUS * toUv)};
				float b0 = 0.0, b1 = 0.0, b2 = 0.0, b3 = 0.0;
				for ( int i = 0; i < 8; i ++ ) {
					vec2 uv = shadowCoord.xy + vogelDiskSample( i, 8, phi ) * search;
					b0 += vestraBlocked( shadowMap, uv, shadowCoord.z - ${d0} );
					b1 += vestraBlocked( shadowMap, uv, shadowCoord.z - ${d1} );
					b2 += vestraBlocked( shadowMap, uv, shadowCoord.z - ${d2} );
					b3 += vestraBlocked( shadowMap, uv, shadowCoord.z - ${d3} );
				}

				// Encostado (ou nada na frente): o raio mínimo, \`shadow-radius\` da luz.
				float radius = shadowRadius * texelSize.x;
				if ( b0 > 0.0 ) {
					float dist = ( ( b0 - b1 ) * ${num((STEPS[0] + STEPS[1]) / 2)} + ( b1 - b2 ) * ${num((STEPS[1] + STEPS[2]) / 2)}
						+ ( b2 - b3 ) * ${num((STEPS[2] + STEPS[3]) / 2)} + b3 * ${num(STEPS[3] * 2)} ) / b0;
					radius = clamp( dist * ${num(PENUMBRA * toUv)}, radius, search );
				}

				shadow = 0.0;
				for ( int i = 0; i < 16; i ++ ) {
					shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 16, phi ) * radius, shadowCoord.z ) );
				}
				shadow /= 16.0;

			}

			return mix( 1.0, shadow, shadowIntensity );

		}
`;
}

const PCF_START = "float getShadow( sampler2DShadow shadowMap";
const PCF_END = "#elif defined( SHADOWMAP_TYPE_VSM )";

/** O trecho de sombra do three com a função PCF trocada pelo PCSS. */
export function withSoftShadows(chunk: string): string {
  const start = chunk.indexOf(PCF_START);
  const end = chunk.indexOf(PCF_END, start);
  if (start < 0 || end < 0 || chunk.indexOf(PCF_START, start + 1) >= 0)
    throw new Error("sombra macia: o trecho de sombra do three mudou");
  return chunk.slice(0, start) + pcssFunction().trim() + "\n\n\t" + chunk.slice(end);
}

let installed = false;

/** Troca a sombra de todos os materiais (uma vez, antes de compilar o primeiro). */
export function installSoftShadows() {
  if (installed) return;
  installed = true;
  THREE.ShaderChunk.shadowmap_pars_fragment = withSoftShadows(THREE.ShaderChunk.shadowmap_pars_fragment);
}
