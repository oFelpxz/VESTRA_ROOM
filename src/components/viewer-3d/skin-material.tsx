"use client";

import { createContext, useContext } from "react";
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
 * Item 5 — cabelo: com `hair`, a pele pinta o couro cabeludo (atributo
 * `hairMask`, de `hairMask` em lib/hair) com borda irregular; `HairMaterial`
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
attribute float hairMask;
varying float vHairMask;
#endif
`;

const FRAGMENT_DECL = /* glsl */ `
uniform vec3 skinWrap;
uniform vec3 skinBlush;
uniform vec3 hairColor;
varying vec3 vSkinPos;
#ifdef SKIN_FOLDS
varying float vSkinCavity;
#endif
#ifdef SKIN_HAIR
varying float vHairMask;
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
// Quanto do ponto é cabelo: a borda ganha bicos de ~3 mm, não segue os triângulos.
float hairAmount( vec3 root, float mask ) {
  float edge = skinNoise( root * 320.0 ) * 0.6 + skinNoise( root * 90.0 ) * 0.4;
  return smoothstep( 0.42, 0.58, mask + ( edge - 0.5 ) * 0.45 );
}
// Fios: grão fino, mais longo na vertical.
float hairGrain( vec3 root ) {
  return skinNoise( root * vec3( 1400.0, 380.0, 1400.0 ) ) * 0.7 + skinNoise( root * 600.0 ) * 0.3;
}
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
#ifdef SKIN_HAIR
// Raspado: a pele aparece entre os fios (SKIN_HAIR < 1).
float skinHairAmt = hairAmount( vSkinPos, vHairMask ) * SKIN_HAIR * ( 0.8 + 0.4 * hairGrain( vSkinPos ) );
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
/** Castanho bem escuro, quase preto (linear). */
const HAIR = new THREE.Color("#1e1712");

function patchSkin(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.skinWrap = { value: WRAP };
  shader.uniforms.skinBlush = { value: BLUSH };
  shader.uniforms.hairColor = { value: HAIR };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${VERTEX_DECL}`)
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n  vSkinPos = transformed;\n#ifdef SKIN_FOLDS\n  vSkinCavity = skinCavity;\n#endif\n#ifdef SKIN_HAIR\n  vHairMask = hairMask;\n#endif",
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
 * `hair`: a malha traz `hairMask`; quanto o cabelo cobre a pele (1 = tudo).
 */
export function SkinMaterial({
  color,
  folds = false,
  hair = 0,
}: {
  color?: string;
  folds?: boolean;
  hair?: number;
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
attribute float hairMask;
varying vec3 vHairRoot;
varying float vHairMask;
`;
const HAIR_FRAGMENT_DECL = /* glsl */ `
uniform vec3 hairColor;
varying vec3 vHairRoot;
varying float vHairMask;
${FRAGMENT_DECL.slice(FRAGMENT_DECL.indexOf("float skinHash"))}
`;
// Some onde a pele já mostra a pele (mesma borda irregular da pintura).
const HAIR_COLOR_BODY = /* glsl */ `
if ( hairAmount( vHairRoot, vHairMask ) < 0.5 ) discard;
float grain = hairGrain( vHairRoot );
diffuseColor.rgb = hairColor * ( 0.8 + 0.9 * grain );
`;
const HAIR_ROUGHNESS_BODY = /* glsl */ `
roughnessFactor = clamp( roughnessFactor + ( grain - 0.5 ) * 0.3, 0.35, 1.0 );
`;

function patchHair(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.hairColor = { value: HAIR };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>${HAIR_VERTEX_DECL}`)
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vHairRoot = hairRoot;\n  vHairMask = hairMask;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>${HAIR_FRAGMENT_DECL}`)
    .replace("#include <color_fragment>", `#include <color_fragment>${HAIR_COLOR_BODY}`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>${HAIR_ROUGHNESS_BODY}`);
}
const hairKey = () => "vestra-hair";

/**
 * Casca do corte curto: fosca, com brilho de borda castanho (fio contra a
 * luz). A malha traz `hairRoot` (pele embaixo) e `hairMask`.
 */
export function HairMaterial() {
  return (
    <meshPhysicalMaterial
      roughness={0.6}
      specularIntensity={0.3}
      sheen={0.7}
      sheenRoughness={0.45}
      sheenColor="#6a5040"
      onBeforeCompile={patchHair}
      customProgramCacheKey={hairKey}
    />
  );
}
