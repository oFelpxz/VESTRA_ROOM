import * as THREE from "three";
import { applyTint, keepsOwnColor, meanLuminance } from "./garment-color";
import { WEAVE_SIZE, isFabricName, makeWeave, type FabricName } from "./fabric-weave";
import { EDGE_CAP, fabricEdgeAttribute } from "./fabric-edge";

/**
 * Material de tecido das peças do provador (tira a "cara de massinha").
 *
 * - Trama de cada tecido (`fabric-weave.ts`) projetada pelos 3 eixos
 *   (triplanar), em metros: funciona nas peças sem UV (saia, vestido, gorro) e
 *   os fios ficam na vertical/horizontal como numa roupa vestida.
 * - Brilho de tecido (sheen): a borda da peça clareia contra a luz, como
 *   algodão de verdade; o reflexo "de plástico" (specular) fica bem fraco,
 *   menos no cetim — lá ele estica atravessado ao fio (anisotropia, lista 12).
 * - Mancha grande e suave na cor e na aspereza, e o avesso (gola, barra,
 *   cava) mais escuro.
 * - Acabamento perto da borda do tecido (`addFabricEdge`): vinco da barra
 *   dobrada e pesponto tracejado — dourado no jeans.
 * - Dobras de caimento (`Wrinkle`): só na luz (a malha não muda) — em pé na
 *   camiseta, saia e vestido; deitadas na calça, juntando na barra.
 * - Estampas (`PrintDecal`): imagem ou faixa de manga presa na posição
 *   original do pano (`addFabricRest`), então acompanha a peça em qualquer
 *   corpo.
 *
 * A cor escolhida entra como no `tintMaterial` (`garment-color.ts`).
 */

type FabricLook = {
  /** Tamanho do quadrado da trama (m). */
  tile: number;
  roughness: number;
  /** Força do reflexo direto (1 = plástico/verniz). */
  specular: number;
  sheen: number;
  sheenRoughness: number;
  /** Quanto o brilho de tecido puxa para o branco (0 = cor da peça). */
  sheenWhite: number;
  /** Força do relevo da trama na luz. */
  relief: number;
  /** Força do tom dos fios na cor. */
  threads: number;
  /** Força da mancha grande (cor). */
  mottle: number;
  /** Mancha esticada na vertical (listras de desbotado do jeans); 1 = redonda. */
  streak?: number;
  /** Largura da barra dobrada (m): vinco a essa distância da borda; 0 = sem. */
  hem: number;
  /** Linhas de pesponto (m da borda); vazio = sem pesponto. */
  stitches: number[];
  /** Cor da linha do pesponto; sem ela, a cor da peça um pouco mais clara. */
  thread?: string;
  /** Força das dobras de caimento (0 = sem). */
  wrinkle: number;
  /**
   * Brilho esticado atravessado ao fio (0 = redondo). No cetim o fio corre em
   * pé e o reflexo vira uma faixa larga e macia, não o ponto duro do látex.
   */
  anisotropy?: number;
};

/**
 * Jeito das dobras: "caimento" = em pé, pendendo do peito/cintura (camiseta,
 * saia, vestido); "calca" = deitadas, juntando no tornozelo, joelho e cós.
 */
export type Wrinkle = "caimento" | "calca";

export const FABRIC_LOOK: Record<FabricName, FabricLook> = {
  algodao: { tile: 0.036, roughness: 0.9, specular: 0.3, sheen: 0.7, sheenRoughness: 0.75, sheenWhite: 0.35, relief: 0.6, threads: 1, mottle: 0.06, hem: 0.022, stitches: [0.015], wrinkle: 1 },
  sarja: { tile: 0.028, roughness: 0.88, specular: 0.3, sheen: 0.45, sheenRoughness: 0.7, sheenWhite: 0.3, relief: 0.7, threads: 1, mottle: 0.08, hem: 0.025, stitches: [0.009], wrinkle: 1 },
  denim: { tile: 0.05, roughness: 0.92, specular: 0.25, sheen: 0.5, sheenRoughness: 0.8, sheenWhite: 0.45, relief: 1, threads: 1.3, mottle: 0.22, streak: 6, hem: 0.02, stitches: [0.006, 0.013], thread: "#c8923e", wrinkle: 1.2 },
  trico: { tile: 0.05, roughness: 0.95, specular: 0.2, sheen: 0.9, sheenRoughness: 0.85, sheenWhite: 0.3, relief: 1, threads: 1, mottle: 0.05, hem: 0, stitches: [], wrinkle: 0 },
  cetim: { tile: 0.06, roughness: 0.34, specular: 0.55, sheen: 0.85, sheenRoughness: 0.35, sheenWhite: 0.45, relief: 0.25, threads: 1, mottle: 0.03, hem: 0.005, stitches: [], wrinkle: 0.5, anisotropy: 0.75 },
  moletom: { tile: 0.03, roughness: 0.92, specular: 0.25, sheen: 0.8, sheenRoughness: 0.85, sheenWhite: 0.35, relief: 0.4, threads: 1, mottle: 0.05, hem: 0.02, stitches: [0.009], wrinkle: 1 },
};

/** Tamanho da mancha grande (m): ela se repete a cada ~0,7 m. */
const MOTTLE_TILE = 0.7;
/** Avesso: quanto da luz ele recebe em relação ao lado de fora. */
const INSIDE = 0.8;
/** Menor brilho (linear) da cor do tecido. */
const BLACK_FLOOR = 0.045;

/**
 * Tecido da peça: a marca `vestra_tecido` da cena (gravada no .glb por
 * `scripts/marcar-tecido.ts` ou pelo upload do admin) ou, sem ela, o nome do material do arquivo.
 */
export function fabricOf(scene: THREE.Object3D, material?: THREE.Material): FabricName {
  let marked: FabricName | null = null;
  scene.traverse((o) => {
    const v = o.userData?.vestra_tecido;
    if (!marked && isFabricName(v)) marked = v;
  });
  if (marked) return marked;
  const name = (material?.name ?? "").toLowerCase();
  if (name.includes("cetim") || name.includes("satin")) return "cetim";
  if (name.includes("trico")) return "trico";
  if (name.includes("denim") || name.includes("jeans")) return "denim";
  if (name.includes("tecido")) return "sarja";
  return "algodao";
}

const weaves = new Map<FabricName, THREE.DataTexture>();

/** Textura da trama (gerada uma vez por tecido e dividida entre as peças). */
function weaveTexture(fabric: FabricName) {
  let t = weaves.get(fabric);
  if (!t) {
    t = new THREE.DataTexture(makeWeave(fabric), WEAVE_SIZE, WEAVE_SIZE, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8; // o three limita ao máximo da placa
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    weaves.set(fabric, t);
  }
  return t;
}

/** Cópia do material do arquivo como MeshPhysicalMaterial (tem sheen). */
function toPhysical(source: THREE.Material): THREE.MeshPhysicalMaterial {
  if ((source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial)
    return (source as THREE.MeshPhysicalMaterial).clone();
  const p = new THREE.MeshPhysicalMaterial();
  if ((source as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    THREE.MeshStandardMaterial.prototype.copy.call(p, source as THREE.MeshStandardMaterial);
    p.defines = { STANDARD: "", PHYSICAL: "" };
  } else {
    THREE.Material.prototype.copy.call(p, source);
    const c = (source as THREE.MeshBasicMaterial).color;
    if (c) p.color.copy(c);
  }
  return p;
}

/** Pesponto: largura da linha e comprimento de cada ponto (m). */
const STITCH_WIDTH = 0.0011;
const STITCH_LENGTH = 0.0045;

/**
 * Estampa na peça: imagem com fundo transparente, posicionada no corpo de
 * referência (avatar_base, em metros; frente = +z). Vista de frente, o lado
 * direito da tela é +x; nas costas a imagem é espelhada para ler certo.
 */
export type ImageDecal = {
  image: THREE.Texture;
  /** Centro da estampa (x, y), em metros. */
  center: [number, number];
  /** Largura e altura (m). */
  size: [number, number];
  side: "frente" | "costas";
};

/**
 * Faixa reta pelo lado de fora das duas mangas (track jacket). `from`→`to` é
 * a linha de fora da manga do lado +x, do ombro ao punho, no corpo de
 * referência; a outra manga é o espelho.
 */
export type SleeveStripe = {
  color: string;
  from: [number, number, number];
  to: [number, number, number];
  /** Largura da faixa (m). */
  width: number;
};

export type PrintDecal = ImageDecal | SleeveStripe;

// Lado de fora da manga: o lado de dentro e o corpo ficam a mais que isso
// para dentro da linha da faixa (m).
const STRIPE_DEPTH = 0.04;

/** Quantas estampas cabem numa parte da peça (frente + costas). */
const PRINT_SLOTS = 2;

let blankPrint: THREE.DataTexture | null = null;

/** Imagem vazia para a vaga sem estampa (o shader sempre lê as duas). */
function blankPrintTexture() {
  if (!blankPrint) {
    blankPrint = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    blankPrint.needsUpdate = true;
  }
  return blankPrint;
}

const VERTEX_DECL = /* glsl */ `
attribute vec2 fabricEdge;
varying vec3 vFabricPos;
varying vec3 vFabricNormal;
varying vec2 vFabricEdge;
#ifdef FABRIC_PRINT
attribute vec3 fabricRest;
varying vec3 vFabricRest;
#endif`;

const FRAGMENT_DECL = /* glsl */ `
uniform sampler2D fabricMap;
uniform float fabricScale;
uniform float fabricRelief;
uniform float fabricThreads;
uniform vec3 fabricMottleScale;
uniform float fabricMottle;
uniform float fabricInside;
uniform float fabricHem;
uniform vec2 fabricStitches;
uniform vec3 fabricThread;
uniform vec2 fabricWrinkle;
uniform mat3 normalMatrix;
varying vec3 vFabricPos;
varying vec3 vFabricNormal;
varying vec2 vFabricEdge;
#ifdef FABRIC_PRINT
uniform sampler2D printMap0;
uniform sampler2D printMap1;
uniform vec4 printRect0;
uniform vec4 printRect1;
uniform float printSide0;
uniform float printSide1;
varying vec3 vFabricRest;

// Tinta de uma estampa neste ponto (rgb linear, alpha = cobertura). O lado
// vem da normal de agora: a frente não vaza para as costas nem para a manga.
vec4 fabricPrint( sampler2D map, vec4 rect, float side, vec3 fn ) {
  vec2 uv = ( vFabricRest.xy - rect.xy ) / ( 2.0 * rect.zw ) + 0.5;
  uv.x = side > 0.0 ? uv.x : 1.0 - uv.x;
  if ( any( lessThan( uv, vec2( 0.0 ) ) ) || any( greaterThan( uv, vec2( 1.0 ) ) ) ) return vec4( 0.0 );
  vec4 ink = texture2D( map, uv );
  ink.a *= smoothstep( 0.15, 0.45, side * fn.z );
  return ink;
}
#endif

#ifdef FABRIC_STRIPE
uniform vec3 stripeFrom;
uniform vec3 stripeAlong;
uniform vec3 stripeAcross;
uniform vec3 stripeOut;
uniform vec3 stripeColor;
uniform float stripeHalf;

// Cobertura da faixa da manga: fatia fina em volta da linha de fora da
// manga, só perto dela (o lado de dentro e o corpo ficam mais para dentro).
float fabricStripe() {
  vec3 v = vec3( abs( vFabricRest.x ), vFabricRest.yz ) - stripeFrom;
  float t = dot( v, stripeAlong );
  float across = abs( dot( v, stripeAcross ) );
  float aa = fwidth( across ) + 1e-5;
  float band = 1.0 - smoothstep( stripeHalf - aa, stripeHalf + aa, across );
  float outer = smoothstep( -${STRIPE_DEPTH.toFixed(3)}, -${(STRIPE_DEPTH * 0.6).toFixed(3)}, dot( v, stripeOut ) );
  float along = smoothstep( 0.0, 0.02, t ) * ( 1.0 - smoothstep( 0.98, 1.0, t ) );
  return band * outer * along;
}
#endif

// Linha fina a "at" da borda, sem serrilhar: de longe some aos poucos.
float fabricLine( float d, float at, float width ) {
  float aa = fwidth( d ) + 1e-6;
  float cover = 1.0 - smoothstep( width * 0.5, width * 0.5 + aa, abs( d - at ) );
  return at > 0.0 ? cover * clamp( width / aa, 0.0, 1.0 ) : 0.0;
}`;

// Depois da normal do arquivo: relevo dos fios, tom, mancha e avesso.
const FRAGMENT_BODY = /* glsl */ `
{
  vec3 fn = normalize( vFabricNormal );
  vec3 fw = pow( abs( fn ), vec3( 4.0 ) );
  fw /= fw.x + fw.y + fw.z + 1e-5;
  vec3 fp = vFabricPos * fabricScale;
  // De longe o fio fica menor que um pixel e bate com a grade da tela (moiré
  // em anéis na calça): relevo e tom dos fios somem aos poucos.
  float fabricFine = 1.0 - smoothstep( 0.015, 0.045, length( fwidth( fp ) ) );
  vec4 tX = texture2D( fabricMap, fp.zy );
  vec4 tY = texture2D( fabricMap, fp.xz );
  vec4 tZ = texture2D( fabricMap, fp.xy );
  vec2 nX = tX.rg * 2.0 - 1.0;
  vec2 nY = tY.rg * 2.0 - 1.0;
  vec2 nZ = tZ.rg * 2.0 - 1.0;
  vec3 fabricBump = vec3( 0.0, nX.y, nX.x ) * fw.x + vec3( nY.x, 0.0, nY.y ) * fw.y + vec3( nZ.x, nZ.y, 0.0 ) * fw.z;
  normal = normalize( normal + faceDirection * ( normalMatrix * fabricBump ) * fabricRelief * fabricFine );

#ifndef FABRIC_LITE
  // Dobras de caimento: ondas que inclinam a normal (a malha não muda).
  // O desenho vem da mancha da trama, então cada dobra tem largura e força
  // diferentes, sem virar sanfona.
  if ( fabricWrinkle.x > 0.5 ) {
    vec3 wp = vFabricPos;
    vec3 wdir;
    float wphase;
    float wamp;
    if ( fabricWrinkle.x < 1.5 ) {
      // Em pé: em volta do corpo, mais forte do peito para baixo.
      float wl = length( wp.xz ) + 1e-4;
      float ws = atan( wp.z, wp.x ) * 0.17;
      wdir = vec3( - wp.z, 0.0, wp.x ) / wl;
      float warp = texture2D( fabricMap, vec2( ws * 1.7, wp.y * 0.3 ) ).b;
      wphase = ws / 0.055 + ( warp - 0.5 ) * 1.6;
      wamp = 0.2 * smoothstep( 1.32, 1.02, wp.y );
    } else {
      // Deitadas: barra (acumula no sapato), joelho e cós.
      wdir = vec3( 0.0, 1.0, 0.0 );
      float warp = texture2D( fabricMap, vec2( ( wp.x + wp.z ) * 1.4, wp.y * 0.35 ) ).b;
      float near = 1.0 - smoothstep( 0.06, 0.26, wp.y );
      wphase = wp.y / mix( 0.06, 0.04, near ) + ( warp - 0.5 ) * 4.0;
      // Fora da barra, só em manchas: senão vira listra.
      float spot = smoothstep( 0.45, 0.75, texture2D( fabricMap, vec2( wp.x + wp.z, wp.y ) * 2.3 ).b );
      wamp = 0.32 * near
        + spot * ( 0.03
          + 0.08 * ( 1.0 - smoothstep( 0.0, 0.08, abs( wp.y - 0.5 ) ) )
          + 0.08 * ( 1.0 - smoothstep( 0.0, 0.05, abs( wp.y - 1.0 ) ) ) );
    }
    float patchy = texture2D( fabricMap, wp.xy * 1.9 + wp.zy * 1.3 ).b;
    wamp *= fabricWrinkle.y * ( 0.35 + 1.3 * patchy );
    // Crista mais estreita que o vale, como pano de verdade.
    float wc = cos( wphase * 6.2832 );
    vec3 wtilt = wdir * ( - wamp * sign( wc ) * pow( abs( wc ), 0.6 ) );
    wtilt -= fn * dot( wtilt, fn );
    normal = normalize( normal + faceDirection * ( normalMatrix * wtilt ) );
  }
#endif

#ifdef FABRIC_PRINT
  // Estampa (silk): cobre a cor do pano, mas a trama, a mancha e a luz das
  // dobras continuam por cima. No avesso não aparece.
  if ( gl_FrontFacing ) {
    vec4 ink0 = fabricPrint( printMap0, printRect0, printSide0, fn );
    vec4 ink1 = fabricPrint( printMap1, printRect1, printSide1, fn );
    diffuseColor.rgb = mix( diffuseColor.rgb, ink0.rgb, ink0.a * 0.95 );
    diffuseColor.rgb = mix( diffuseColor.rgb, ink1.rgb, ink1.a * 0.95 );
#ifdef FABRIC_STRIPE
    diffuseColor.rgb = mix( diffuseColor.rgb, stripeColor, fabricStripe() * 0.95 );
#endif
  }
#endif

  float fabricTone = tX.a * fw.x + tY.a * fw.y + tZ.a * fw.z + 0.5;
  diffuseColor.rgb *= mix( 1.0, fabricTone, fabricThreads * fabricFine );

  vec3 mp = vFabricPos * fabricMottleScale;
  float mottle = texture2D( fabricMap, mp.zy ).b * fw.x + texture2D( fabricMap, mp.xz ).b * fw.y + texture2D( fabricMap, mp.xy ).b * fw.z;
  diffuseColor.rgb *= 1.0 + ( mottle - 0.5 ) * 2.0 * fabricMottle;
  roughnessFactor = clamp( roughnessFactor + ( mottle - 0.5 ) * 0.12, 0.05, 1.0 );

#ifndef FABRIC_LITE
  // Acabamento: o atributo guarda "limite - distância" (sem ele = longe).
  float edgeD = ${EDGE_CAP.toFixed(4)} - vFabricEdge.x;
  // Borda e vinco da barra dobrada.
  diffuseColor.rgb *= 1.0 - 0.15 * fabricLine( edgeD, 0.0012, 0.0024 );
  diffuseColor.rgb *= 1.0 - 0.12 * fabricLine( edgeD, fabricHem, 0.0016 );
  // Pesponto: tracejado ao longo da borda.
  float ph = vFabricEdge.y / ${STITCH_LENGTH.toFixed(4)};
  float pw = fwidth( ph );
  float dash = mix( smoothstep( 0.18 - pw, 0.18 + pw, fract( ph ) ) * ( 1.0 - smoothstep( 0.92 - pw, 0.92 + pw, fract( ph ) ) ), 0.74, clamp( pw * 2.0 - 0.5, 0.0, 1.0 ) );
  float stitch = max( fabricLine( edgeD, fabricStitches.x, ${STITCH_WIDTH} ), fabricLine( edgeD, fabricStitches.y, ${STITCH_WIDTH} ) ) * dash;
  // Furinho da agulha: um vinco escuro dos dois lados do ponto.
  diffuseColor.rgb *= 1.0 - 0.1 * max( fabricLine( edgeD, fabricStitches.x, ${STITCH_WIDTH * 2.6} ), fabricLine( edgeD, fabricStitches.y, ${STITCH_WIDTH * 2.6} ) ) * ( 1.0 - stitch );
  diffuseColor.rgb = mix( diffuseColor.rgb, fabricThread, stitch * 0.9 );
#endif

  // Reflexo sem pisca-pisca: onde a normal vira muito dentro de um pixel
  // (alça fina, crista de dobra, trama vista de longe), o brilho espalha.
  vec3 nDx = dFdx( normal );
  vec3 nDy = dFdy( normal );
  float nVar = 0.25 * ( dot( nDx, nDx ) + dot( nDy, nDy ) );
  roughnessFactor = sqrt( clamp( roughnessFactor * roughnessFactor + min( 2.0 * nVar, 0.18 ), 0.0, 1.0 ) );

  if ( ! gl_FrontFacing ) diffuseColor.rgb *= fabricInside;
}`;

// Direção do brilho do cetim: o fio corre em pé na peça (urdume) e o reflexo
// estica atravessado a ele. A peça não tem UV, então a direção vem daqui e
// não da tangente do arquivo.
const ANISO_BODY = /* glsl */ `
{
  vec3 fiber = normalMatrix * vec3( 0.0, 1.0, 0.0 );
  fiber = fiber - normal * dot( fiber, normal );
  vec3 across = cross( normal, fiber );
  if ( dot( across, across ) > 1e-8 ) {
    material.anisotropyT = normalize( across );
    material.anisotropyB = cross( normal, material.anisotropyT );
  }
}`;

/**
 * Material de tecido na cor escolhida, a partir do material do arquivo.
 * Quem chama libera com `dispose()` (a textura da trama é dividida e fica).
 * `lite` (modo leve, `render-quality.ts`): sem dobras, barra e pesponto.
 * `prints`: até 2 imagens e uma faixa de manga; a malha precisa do
 * `addFabricRest`.
 */
export function clothMaterial(
  source: THREE.Material,
  color: string | undefined,
  fabric: FabricName,
  wrinkle: Wrinkle | null = null,
  lite = false,
  prints: PrintDecal[] = [],
): THREE.MeshPhysicalMaterial {
  const m = toPhysical(source);
  if (keepsOwnColor(source)) {
    // botão: liso e com um pouco de brilho, sem trama nem dobra
    m.roughness = 0.35;
    m.metalness = 0;
    return m;
  }
  const look = FABRIC_LOOK[fabric];
  const images = prints.filter((p): p is ImageDecal => "image" in p);
  const stripe = prints.find((p): p is SleeveStripe => !("image" in p));
  if (color) m.color.set(color);
  // Tecido preto de verdade ainda devolve ~4% da luz: sem esse piso a peça
  // vira um recorte chapado e some a trama e as dobras.
  const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
  if (lum < BLACK_FLOOR) m.color.addScalar(BLACK_FLOOR - lum);
  const mean = color && m.map ? meanLuminance(m.map) : null;

  // Com mapa de aspereza (moletom), ele manda; senão, a do tecido. Nos outros
  // o mapa do arquivo deixava faixas lisas brilhando (barra da track jacket).
  if (fabric !== "moletom") m.roughnessMap = null;
  if (!m.roughnessMap) m.roughness = look.roughness;
  m.metalness = 0;
  m.specularIntensity = look.specular;
  m.sheen = look.sheen;
  m.sheenRoughness = look.sheenRoughness;
  m.sheenColor.copy(m.color).lerp(new THREE.Color(1, 1, 1), look.sheenWhite);
  m.anisotropy = look.anisotropy ?? 0;
  m.anisotropyMap = null;

  m.onBeforeCompile = (shader) => {
    if (mean != null) applyTint(shader, mean);
    Object.assign(shader.uniforms, {
      fabricMap: { value: weaveTexture(fabric) },
      fabricScale: { value: 1 / look.tile },
      fabricRelief: { value: look.relief },
      fabricThreads: { value: look.threads },
      fabricMottleScale: {
        value: new THREE.Vector3(look.streak ?? 1, 1, look.streak ?? 1).multiplyScalar(1 / MOTTLE_TILE),
      },
      fabricMottle: { value: look.mottle },
      fabricInside: { value: INSIDE },
      fabricHem: { value: look.hem },
      fabricStitches: { value: new THREE.Vector2(look.stitches[0] ?? 0, look.stitches[1] ?? 0) },
      fabricWrinkle: { value: new THREE.Vector2(wrinkle === "calca" ? 2 : wrinkle ? 1 : 0, look.wrinkle) },
      fabricThread: {
        value: look.thread
          ? new THREE.Color(look.thread)
          : m.color.clone().multiplyScalar(1.25).addScalar(0.035),
      },
    });
    for (let i = 0; i < PRINT_SLOTS; i++) {
      const p = images[i];
      Object.assign(shader.uniforms, {
        [`printMap${i}`]: { value: p?.image ?? blankPrintTexture() },
        [`printRect${i}`]: {
          value: p
            ? new THREE.Vector4(p.center[0], p.center[1], p.size[0] / 2, p.size[1] / 2)
            : new THREE.Vector4(0, -10, 0.001, 0.001),
        },
        [`printSide${i}`]: { value: p?.side === "costas" ? -1 : 1 },
      });
    }
    if (stripe) Object.assign(shader.uniforms, stripeUniforms(stripe));
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${VERTEX_DECL}`)
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vFabricPos = transformed;\n  vFabricNormal = objectNormal;\n  vFabricEdge = fabricEdge;\n#ifdef FABRIC_PRINT\n  vFabricRest = fabricRest;\n#endif",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>${FRAGMENT_DECL}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>${FRAGMENT_BODY}`);
    if (m.anisotropy > 0)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>${ANISO_BODY}`,
      );
  };
  // O código do shader muda só com o ajuste da cor, o modo leve e ter ou não
  // estampa e faixa; o resto são uniforms.
  if (lite) m.defines = { ...m.defines, FABRIC_LITE: "" };
  const printed = prints.length > 0;
  if (printed) m.defines = { ...m.defines, FABRIC_PRINT: "" };
  if (stripe) m.defines = { ...m.defines, FABRIC_STRIPE: "" };
  m.customProgramCacheKey = () =>
    `vestra-fabric-${mean != null ? 1 : 0}${lite ? "-lite" : ""}${printed ? "-print" : ""}${stripe ? "-stripe" : ""}${m.anisotropy > 0 ? "-aniso" : ""}`;
  return m;
}

/**
 * Eixos da faixa: `stripeAlong` dá 0 no ombro e 1 no punho; `stripeOut`
 * aponta para fora da manga (perpendicular a ela, do lado do ombro);
 * `stripeAcross` mede a largura.
 */
function stripeUniforms(s: SleeveStripe) {
  const from = new THREE.Vector3(...s.from);
  const d = new THREE.Vector3(...s.to).sub(from);
  const out = new THREE.Vector3(-d.y, d.x, 0);
  if (out.x < 0) out.negate();
  out.addScaledVector(d, -out.dot(d) / d.lengthSq()).normalize();
  return {
    stripeFrom: { value: from },
    stripeAlong: { value: d.clone().divideScalar(d.lengthSq()) },
    stripeAcross: { value: new THREE.Vector3().crossVectors(d, out).normalize() },
    stripeOut: { value: out },
    stripeColor: { value: new THREE.Color(s.color) },
    stripeHalf: { value: s.width / 2 },
  };
}

/**
 * Grava na parte da peça a distância até a borda do tecido (para a barra e o
 * pesponto do `clothMaterial`), como "limite - distância": parte sem o
 * atributo fica sem acabamento em vez de toda riscada.
 *
 * Tiras estreitas (ribana da gola/punho, quase toda perto da borda) e malhas
 * retalhadas ficam sem — o pesponto viraria rabisco.
 */
export function addFabricEdge(g: THREE.BufferGeometry) {
  const e = fabricEdgeAttribute(g.getAttribute("position").array, g.getIndex()?.array ?? null);
  g.setAttribute("fabricEdge", new THREE.BufferAttribute(e, 2));
  return g;
}

/**
 * Guarda a posição original do pano (antes de vestir no corpo), onde as
 * estampas ficam presas. Chamar antes de trocar a `position` pelo caimento;
 * as cópias da geometria (`clone`) levam junto.
 */
export function addFabricRest(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position");
  g.setAttribute("fabricRest", new THREE.BufferAttribute(new Float32Array(p.array as ArrayLike<number>), 3));
  return g;
}
