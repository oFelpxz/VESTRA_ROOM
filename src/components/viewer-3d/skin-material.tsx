"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import * as THREE from "three";
import { skinTone, type SkinTone } from "@/lib/skin-tones";

/**
 * Pele do avatar (provador e prévia).
 *
 * Antes era um "manequim de gesso" (fosco e cinza). Agora: tom mais quente,
 * um pouco de brilho (pele tem oleosidade) e um sheen avermelhado nas bordas
 * contra a luz. A cor e o brilho vêm do tom de pele escolhido
 * (`SkinToneContext`).
 *
 * Lista 11, item 3 — pele sem cara de plástico, tudo no shader (o corpo não
 * tem UV nem textura):
 * - a luz "dobra" a borda da sombra mais no vermelho que no azul, como a luz
 *   que entra na pele e volta (subsurface) — a sombra fica quente, não cinza;
 * - manchas pequenas e fracas de cor e aspereza, para a pele não ser uma tinta
 *   única nem brilhar por igual;
 * - nas dobras (`folds`: canto do olho, narina, orelha, entre os dedos) menos
 *   luz ambiente, mais vermelho e nenhum brilho — atributo `skinCavity` da
 *   malha, calculado por `surfaceCavity`.
 *
 * Lista 12, item 3 — rosto: sobrancelha, cor da boca e linha da pálpebra
 * (atributo `skinFace`, de `faceCoords` em lib/face-marks).
 *
 * Item 5 — cabelo: com `hair`, a pele pinta o couro cabeludo (atributo
 * `hairAbove`, de `hairEdge` em lib/hair) com borda irregular; `HairMaterial`
 * é a casca do corte curto, com a mesma borda.
 */

/** Tom de pele de quem prova (lista 11); fora do provador, o padrão. */
export const SkinToneContext = createContext<SkinTone>(skinTone(null));

/**
 * Manequim da página do produto: o mesmo corpo, com acabamento de manequim de
 * loja (fibra de vidro cinza, verniz leve) — com pele, sem roupa embaixo,
 * parecia uma pessoa pelada.
 */
export const MannequinFinish = createContext(false);

const VERTEX_DECL = /* glsl */ `
varying vec3 vSkinPos;
#ifdef SKIN_FOLDS
attribute float skinCavity;
varying float vSkinCavity;
#endif
#ifdef SKIN_HAIR
attribute float hairAbove;
varying float vHairAbove;
#endif
#ifdef SKIN_FACE
attribute vec3 skinFace;
varying vec3 vSkinFace;
#endif
`;

const FRAGMENT_DECL = /* glsl */ `
uniform vec3 skinWrap;
uniform vec3 skinBlush;
uniform vec3 hairColor;
uniform vec3 skinLip;
varying vec3 vSkinPos;
#ifdef SKIN_FOLDS
varying float vSkinCavity;
#endif
#ifdef SKIN_HAIR
varying float vHairAbove;
#endif
#ifdef SKIN_FACE
varying vec3 vSkinFace;
#endif
float skinHash( vec3 p ) {
  p = fract( p * 0.3183099 + 0.1 );
  p *= 17.0;
  return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float skinNoise( vec3 x ) {
  vec3 i = floor( x );
  vec3 f = fract( x );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( mix( skinHash( i ), skinHash( i + vec3( 1, 0, 0 ) ), f.x ),
         mix( skinHash( i + vec3( 0, 1, 0 ) ), skinHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
    mix( mix( skinHash( i + vec3( 0, 0, 1 ) ), skinHash( i + vec3( 1, 0, 1 ) ), f.x ),
         mix( skinHash( i + vec3( 0, 1, 1 ) ), skinHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
    f.z );
}
// Quanto do ponto é cabelo, pela altura acima da linha (m, hairEdge): a
// borda ganha bicos de ~3 mm e tufos de ~1 cm, não segue os triângulos.
float hairAmount( vec3 root, float above ) {
  float edge = skinNoise( root * 320.0 ) * 0.6 + skinNoise( root * 90.0 ) * 0.4;
  return smoothstep( -0.0012, 0.0012, above + ( edge - 0.5 ) * 0.007 );
}
// Fios: grão fino, mais longo na vertical.
float hairGrain( vec3 root ) {
  return skinNoise( root * vec3( 1400.0, 380.0, 1400.0 ) ) * 0.7 + skinNoise( root * 600.0 ) * 0.3;
}
`;

// Rosto (lista 12, item 3), em metros a partir dos olhos (`faceCoords`):
// x = distância do meio do rosto, y = altura acima dos olhos, z = distância
// até o globo. Sobrancelha em arco ~2 cm acima do olho, mais alta a 2/3 e
// afinando na ponta, com fios; boca com o lábio de cima mais fino que o de
// baixo e o arco do cupido; a linha da pálpebra escurece a borda do olho.
const FACE_COLOR = /* glsl */ `
vec3 skinF = vSkinFace;
float browT = ( skinF.x - 0.013 ) / 0.039;
float browY = 0.0185 + 0.0055 * sin( 3.14159 * clamp( browT * 0.85, 0.0, 1.0 ) ) - 0.003 * smoothstep( 0.7, 1.0, browT );
float browH = mix( 0.0042, 0.0017, smoothstep( 0.15, 1.0, browT ) );
float browAmt = ( 1.0 - smoothstep( browH * 0.5, browH, abs( skinF.y - browY ) ) )
  * smoothstep( -0.06, 0.12, browT ) * ( 1.0 - smoothstep( 0.9, 1.02, browT ) );
// Fios deitados para fora: grão fino na vertical, longo na horizontal.
float browHairs = skinNoise( vec3( skinF.x * 380.0, ( skinF.y - skinF.x * 0.25 ) * 2600.0, 3.0 ) );
browAmt *= 0.55 + 0.45 * browHairs;
diffuseColor.rgb = mix( diffuseColor.rgb, min( hairColor * 1.6, diffuseColor.rgb * 0.4 ), browAmt * 0.95 );
float lipDy = skinF.y + 0.0663;
float lipE = 1.0 - ( skinF.x / 0.0235 ) * ( skinF.x / 0.0235 );
float lipBow = 0.0012 * ( smoothstep( 0.002, 0.006, skinF.x ) - smoothstep( 0.008, 0.016, skinF.x ) );
float lipTop = lipE > 0.0 ? 0.0075 * sqrt( lipE ) + lipBow : 0.0;
float lipBot = lipE > 0.0 ? 0.0125 * sqrt( lipE ) : 0.0;
float lipAmt = lipDy > 0.0 ? 1.0 - smoothstep( lipTop - 0.0015, lipTop + 0.0004, lipDy )
                           : 1.0 - smoothstep( lipBot - 0.004, lipBot + 0.0005, -lipDy );
lipAmt *= smoothstep( -0.05, 0.15, lipE );
diffuseColor.rgb *= mix( vec3( 1.0 ), skinLip, lipAmt );
// Fenda da boca: risco escuro de ~1 mm.
diffuseColor.rgb *= 1.0 - 0.6 * ( 1.0 - smoothstep( 0.0004, 0.0012, abs( lipDy ) ) ) * smoothstep( 0.0, 0.08, lipE );
float lidAmt = ( 1.0 - smoothstep( 0.0006, 0.0022, skinF.z ) ) * ( 0.35 + 0.65 * smoothstep( -0.006, 0.002, skinF.y ) );
diffuseColor.rgb = mix( diffuseColor.rgb, min( hairColor * 1.2, diffuseColor.rgb * 0.35 ), lidAmt * 0.75 );
`;

// Manchas de ~5 cm e ~2 cm, bem fracas: onde escurece, puxa para o vermelho.
// Maiores que isso viravam uma "assadura" na nuca.
const COLOR_BODY = /* glsl */ `
float skinSpot = skinNoise( vSkinPos * 19.0 ) * 0.6 + skinNoise( vSkinPos * 43.0 ) * 0.4;
diffuseColor.rgb *= 1.0 + ( skinSpot - 0.5 ) * 0.05;
diffuseColor.rgb *= mix( vec3( 1.0 ), skinBlush, ( 1.0 - skinSpot ) * 0.08 );
#ifdef SKIN_FOLDS
diffuseColor.rgb *= mix( vec3( 1.0 ), skinBlush, vSkinCavity * 0.7 );
#endif
#ifdef SKIN_FACE
${FACE_COLOR}
#endif
#ifdef SKIN_HAIR
// Raspado: a pele aparece entre os fios (SKIN_HAIR < 1).
float skinHairAmt = hairAmount( vSkinPos, vHairAbove ) * SKIN_HAIR * ( 0.8 + 0.4 * hairGrain( vSkinPos ) );
diffuseColor.rgb = mix( diffuseColor.rgb, hairColor, min( skinHairAmt, 1.0 ) );
#endif
`;

// O brilho (sempre fosco, nunca verniz) varia em pedaços de ~2 cm e some
// dentro das dobras.
const ROUGHNESS_BODY = /* glsl */ `
roughnessFactor = clamp( roughnessFactor + ( skinNoise( vSkinPos * 45.0 ) - 0.5 ) * 0.14, 0.5, 1.0 );
#ifdef SKIN_FOLDS
roughnessFactor = mix( roughnessFactor, 1.0, vSkinCavity * 0.7 );
#endif
#ifdef SKIN_HAIR
roughnessFactor = mix( roughnessFactor, 0.85, min( skinHairAmt, 1.0 ) );
#endif
#ifdef SKIN_FACE
// Lábio um pouco úmido, sobrancelha fosca.
roughnessFactor = mix( roughnessFactor, 0.5, lipAmt );
roughnessFactor = mix( roughnessFactor, 0.85, browAmt );
#endif
`;

const AO_BODY = /* glsl */ `
#ifdef SKIN_FOLDS
float skinAo = 1.0 - vSkinCavity * 0.6;
reflectedLight.indirectDiffuse *= skinAo;
reflectedLight.indirectSpecular *= skinAo;
#endif
`;

const LAMBERT = "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );";
const WRAPPED_LAMBERT = /* glsl */ `
vec3 skinLit = saturate( ( dot( geometryNormal, directLight.direction ) + skinWrap ) / ( 1.0 + skinWrap ) );
reflectedLight.directDiffuse += skinLit * directLight.color * BRDF_Lambert( material.diffuseContribution );`;

/** Quanto a luz contorna a borda da sombra em cada canal (R entra mais na pele). */
const WRAP = new THREE.Vector3(0.32, 0.14, 0.07);
/** Cor que a pele puxa onde tem mais sangue perto (dobras, manchas). */
const BLUSH = new THREE.Color(1, 0.8, 0.74);
/** Quanto o lábio escurece e avermelha a pele (multiplica o tom). */
const LIP = new THREE.Color(0.87, 0.64, 0.62);
/** Castanho bem escuro, quase preto (linear). */
const HAIR = new THREE.Color("#1e1712");

function patchSkin(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.skinWrap = { value: WRAP };
  shader.uniforms.skinBlush = { value: BLUSH };
  shader.uniforms.hairColor = { value: HAIR };
  shader.uniforms.skinLip = { value: LIP };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${VERTEX_DECL}`)
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vSkinPos = transformed;\n#ifdef SKIN_FOLDS\n  vSkinCavity = skinCavity;\n#endif\n#ifdef SKIN_HAIR\n  vHairAbove = hairAbove;\n#endif\n#ifdef SKIN_FACE\n  vSkinFace = skinFace;\n#endif",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>${FRAGMENT_DECL}`)
    .replace(
      "#include <lights_physical_pars_fragment>",
      THREE.ShaderChunk.lights_physical_pars_fragment.replace(LAMBERT, WRAPPED_LAMBERT),
    )
    .replace("#include <color_fragment>", `#include <color_fragment>${COLOR_BODY}`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>${ROUGHNESS_BODY}`)
    .replace("#include <aomap_fragment>", `#include <aomap_fragment>${AO_BODY}`);
}

const skinKey = () => "vestra-skin";

/**
 * `folds`: a malha traz o atributo `skinCavity` (só o corpo do provador).
 * `hair`: a malha traz `hairAbove`; quanto o cabelo cobre a pele (1 = tudo).
 * `face`: a malha traz `skinFace` (sobrancelha, boca e pálpebra).
 */
export function SkinMaterial({
  color,
  folds = false,
  hair = 0,
  face = false,
}: {
  color?: string;
  folds?: boolean;
  hair?: number;
  face?: boolean;
}) {
  const mannequin = useContext(MannequinFinish);
  const tone = useContext(SkinToneContext);
  if (mannequin) {
    return (
      <meshPhysicalMaterial
        color="#9d9994"
        roughness={0.42}
        clearcoat={0.35}
        clearcoatRoughness={0.3}
      />
    );
  }
  const defines: Record<string, string> = {};
  if (folds) defines.SKIN_FOLDS = "";
  if (hair > 0) defines.SKIN_HAIR = hair.toFixed(2);
  if (face) defines.SKIN_FACE = "";
  const variant = Object.entries(defines).join(";");
  return (
    <meshPhysicalMaterial
      key={variant}
      color={color ?? tone.color}
      roughness={0.64}
      specularIntensity={0.22}
      sheen={0.35}
      sheenRoughness={0.6}
      sheenColor={tone.sheen}
      defines={defines}
      onBeforeCompile={patchSkin}
      customProgramCacheKey={skinKey}
    />
  );
}

const HAIR_VERTEX_DECL = /* glsl */ `
attribute vec3 hairRoot;
attribute float hairAbove;
attribute vec3 hairFlow;
varying vec3 vHairRoot;
varying float vHairAbove;
varying vec3 vHairFlow;
`;
const HAIR_FRAGMENT_DECL = /* glsl */ `
uniform vec3 hairColor;
varying vec3 vHairRoot;
varying float vHairAbove;
varying vec3 vHairFlow;
${FRAGMENT_DECL.slice(FRAGMENT_DECL.indexOf("float skinHash"))}
`;
// Some onde a pele já mostra a pele (mesma borda irregular da pintura).
const HAIR_COLOR_BODY = /* glsl */ `
if ( hairAmount( vHairRoot, vHairAbove ) < 0.5 ) discard;
// Fios (lista 12, item 4): ruído fino em volta do redemoinho e longo ao longo
// do fio (hairFlow), mais tufos largos. De longe o fino some (sem chiado).
vec3 flowP = vec3( vHairFlow.xy * 230.0, vHairFlow.z * 220.0 );
float fineW = 1.0 - smoothstep( 0.4, 1.2, length( fwidth( flowP ) ) );
float grain = mix( 0.5, skinNoise( flowP ), fineW ) * 0.6 + skinNoise( flowP * vec3( 0.22, 0.22, 0.15 ) ) * 0.4;
diffuseColor.rgb = hairColor * ( 0.7 + 0.9 * grain );
`;
const HAIR_ROUGHNESS_BODY = /* glsl */ `
roughnessFactor = clamp( roughnessFactor + ( grain - 0.5 ) * 0.25, 0.25, 1.0 );
`;

function patchHair(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.hairColor = { value: HAIR };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${HAIR_VERTEX_DECL}`)
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vHairRoot = hairRoot;\n  vHairAbove = hairAbove;\n  vHairFlow = hairFlow;",
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>${HAIR_FRAGMENT_DECL}`)
    .replace("#include <color_fragment>", `#include <color_fragment>${HAIR_COLOR_BODY}`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>${HAIR_ROUGHNESS_BODY}`);
}
const hairKey = () => "vestra-hair";

const EYE_VERTEX_DECL = /* glsl */ `
varying vec3 vEyeDir;
`;
const EYE_FRAGMENT_DECL = /* glsl */ `
uniform vec3 irisColor;
varying vec3 vEyeDir;
${FRAGMENT_DECL.slice(FRAGMENT_DECL.indexOf("float skinHash"))}
`;
// Globo de raio 1 olhando para +z. r = distância do eixo do olhar (0 no
// centro da pupila, 1 na borda do globo vista de frente).
const EYE_COLOR_BODY = /* glsl */ `
vec3 eyeD = normalize( vEyeDir );
float eyeR = eyeD.z > 0.0 ? length( eyeD.xy ) : 1.0;
vec2 eyeA = eyeD.xy / max( eyeR, 1e-4 );
// Fibras da íris: riscos que saem da pupila (mudam rápido com o ângulo, devagar com o raio).
float eyeFiber = skinNoise( vec3( eyeA * 22.0, eyeR * 7.0 ) ) * 0.65 + skinNoise( vec3( eyeA * 60.0, eyeR * 18.0 ) ) * 0.35;
vec3 eyeIris = irisColor * ( 0.4 + 0.75 * eyeFiber );
// Anel claro em volta da pupila e anel escuro na borda (limbo).
eyeIris *= 1.0 + 0.45 * ( smoothstep( 0.15, 0.2, eyeR ) - smoothstep( 0.22, 0.3, eyeR ) );
eyeIris *= 1.0 - 0.55 * smoothstep( 0.34, 0.45, eyeR );
// Branco do olho: nunca branco puro, um pouco rosado nos cantos.
vec3 eyeSclera = vec3( 0.7, 0.63, 0.56 ) * mix( vec3( 1.0 ), vec3( 1.0, 0.82, 0.78 ), smoothstep( 0.6, 1.0, eyeR ) * 0.6 );
eyeSclera *= 1.0 + ( skinNoise( eyeD * 40.0 ) - 0.5 ) * 0.06;
diffuseColor.rgb = mix( eyeSclera, eyeIris, 1.0 - smoothstep( 0.44, 0.47, eyeR ) );
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.006 ), 1.0 - smoothstep( 0.135, 0.155, eyeR ) );
`;
// Catchlight: o reflexo do softbox perto da câmera, no alto à esquerda, só
// na córnea. As luzes do estúdio ficam de lado e quase não refletem de frente.
const EYE_EMISSIVE_BODY = /* glsl */ `
vec3 eyeRefl = reflect( -normalize( vViewPosition ), normal );
float eyeCatch = smoothstep( 0.991, 0.997, dot( eyeRefl, normalize( vec3( -0.2, 0.22, 1.0 ) ) ) );
totalEmissiveRadiance += vec3( 0.85 ) * eyeCatch * ( 1.0 - smoothstep( 0.42, 0.5, eyeR ) );
`;

function patchEye(shader: THREE.WebGLProgramParametersWithUniforms, iris: THREE.Color) {
  shader.uniforms.irisColor = { value: iris };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${EYE_VERTEX_DECL}`)
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vEyeDir = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>${EYE_FRAGMENT_DECL}`)
    .replace("#include <color_fragment>", `#include <color_fragment>${EYE_COLOR_BODY}`)
    .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>${EYE_EMISSIVE_BODY}`);
}
const eyeKey = () => "vestra-eye";

/**
 * Olho (lista 12, item 2), tudo no shader do globo (sem textura): branco do
 * olho levemente rosado, íris castanha com fibras e anel escuro na borda,
 * pupila, e a córnea molhada (verniz quase espelhado) que reflete as luzes do
 * estúdio — o brilhinho que faz o olho parecer vivo. A cor da íris vem do tom
 * de pele. No manequim, continua o globo liso do manequim.
 */
export function EyeMaterial() {
  const mannequin = useContext(MannequinFinish);
  const tone = useContext(SkinToneContext);
  const iris = useMemo(() => new THREE.Color(tone.iris), [tone.iris]);
  const onBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => patchEye(shader, iris),
    [iris],
  );
  if (mannequin) return <SkinMaterial />;
  return (
    <meshPhysicalMaterial
      key={tone.iris}
      roughness={0.5}
      specularIntensity={0.3}
      clearcoat={1}
      clearcoatRoughness={0.03}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={eyeKey}
    />
  );
}

/**
 * Casca do corte curto: brilho de borda castanho (fio contra a luz) e, na
 * lista 12 (item 4), o brilho esticado de cabelo — uma faixa que corre de
 * lado, atravessando os fios, como na foto. A malha traz `hairRoot` (pele
 * embaixo), `hairAbove`, `hairFlow` e a direção do fio em `tangent`.
 */
export function HairMaterial() {
  return (
    <meshPhysicalMaterial
      roughness={0.5}
      specularIntensity={0.45}
      anisotropy={0.8}
      anisotropyRotation={Math.PI / 2}
      sheen={0.7}
      sheenRoughness={0.45}
      sheenColor="#6a5040"
      onBeforeCompile={patchHair}
      customProgramCacheKey={hairKey}
    />
  );
}
