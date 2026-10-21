import * as THREE from "three";
import { applyTint, meanLuminance } from "./garment-color";
import { FABRICS, WEAVE_SIZE, makeWeave, type FabricName } from "./fabric-weave";
import { EDGE_CAP, edgeDistance } from "./fabric-edge";

/**
 * Material de tecido das peças do provador (tira a "cara de massinha").
 *
 * - Trama de cada tecido (`fabric-weave.ts`) projetada pelos 3 eixos
 *   (triplanar), em metros: funciona nas peças sem UV (saia, vestido, gorro) e
 *   os fios ficam na vertical/horizontal como numa roupa vestida.
 * - Brilho de tecido (sheen): a borda da peça clareia contra a luz, como
 *   algodão de verdade; o reflexo "de plástico" (specular) fica bem fraco,
 *   menos no cetim.
 * - Mancha grande e suave na cor e na aspereza, e o avesso (gola, barra,
 *   cava) mais escuro.
 * - Acabamento perto da borda do tecido (`addFabricEdge`): vinco da barra
 *   dobrada e pesponto tracejado — dourado no jeans.
 * - Dobras de caimento (`Wrinkle`): só na luz (a malha não muda) — em pé na
 *   camiseta, saia e vestido; deitadas na calça, juntando na barra.
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
  cetim: { tile: 0.06, roughness: 0.2, specular: 1, sheen: 0.6, sheenRoughness: 0.3, sheenWhite: 0.6, relief: 0.25, threads: 1, mottle: 0.03, hem: 0.005, stitches: [], wrinkle: 0.5 },
  moletom: { tile: 0.03, roughness: 0.92, specular: 0.25, sheen: 0.8, sheenRoughness: 0.85, sheenWhite: 0.35, relief: 0.4, threads: 1, mottle: 0.05, hem: 0.02, stitches: [0.009], wrinkle: 1 },
};

/** Tamanho da mancha grande (m): ela se repete a cada ~0,7 m. */
const MOTTLE_TILE = 0.7;
/** Avesso: quanto da luz ele recebe em relação ao lado de fora. */
const INSIDE = 0.8;
/** Menor brilho (linear) da cor do tecido. */
const BLACK_FLOOR = 0.045;

const isFabric = (v: unknown): v is FabricName =>
  typeof v === "string" && (FABRICS as string[]).includes(v);

/**
 * Tecido da peça: a marca `vestra_tecido` da cena (gravada no .glb por
 * `scripts/marcar-tecido.ts`) ou, sem ela, o nome do material do arquivo.
 */
export function fabricOf(scene: THREE.Object3D, material?: THREE.Material): FabricName {
  let marked: FabricName | null = null;
  scene.traverse((o) => {
    const v = o.userData?.vestra_tecido;
    if (!marked && isFabric(v)) marked = v;
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

const VERTEX_DECL = /* glsl */ `
attribute vec2 fabricEdge;
varying vec3 vFabricPos;
varying vec3 vFabricNormal;
varying vec2 vFabricEdge;`;

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
  vec4 tX = texture2D( fabricMap, fp.zy );
  vec4 tY = texture2D( fabricMap, fp.xz );
  vec4 tZ = texture2D( fabricMap, fp.xy );
  vec2 nX = tX.rg * 2.0 - 1.0;
  vec2 nY = tY.rg * 2.0 - 1.0;
  vec2 nZ = tZ.rg * 2.0 - 1.0;
  vec3 fabricBump = vec3( 0.0, nX.y, nX.x ) * fw.x + vec3( nY.x, 0.0, nY.y ) * fw.y + vec3( nZ.x, nZ.y, 0.0 ) * fw.z;
  normal = normalize( normal + faceDirection * ( normalMatrix * fabricBump ) * fabricRelief );

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
      wamp = 0.05 + 0.32 * near
        + 0.1 * ( 1.0 - smoothstep( 0.0, 0.08, abs( wp.y - 0.5 ) ) )
        + 0.1 * ( 1.0 - smoothstep( 0.0, 0.05, abs( wp.y - 1.0 ) ) );
    }
    float patchy = texture2D( fabricMap, wp.xy * 1.9 + wp.zy * 1.3 ).b;
    wamp *= fabricWrinkle.y * ( 0.35 + 1.3 * patchy );
    // Crista mais estreita que o vale, como pano de verdade.
    float wc = cos( wphase * 6.2832 );
    vec3 wtilt = wdir * ( - wamp * sign( wc ) * pow( abs( wc ), 0.6 ) );
    wtilt -= fn * dot( wtilt, fn );
    normal = normalize( normal + faceDirection * ( normalMatrix * wtilt ) );
  }

  float fabricTone = tX.a * fw.x + tY.a * fw.y + tZ.a * fw.z + 0.5;
  diffuseColor.rgb *= mix( 1.0, fabricTone, fabricThreads );

  vec3 mp = vFabricPos * fabricMottleScale;
  float mottle = texture2D( fabricMap, mp.zy ).b * fw.x + texture2D( fabricMap, mp.xz ).b * fw.y + texture2D( fabricMap, mp.xy ).b * fw.z;
  diffuseColor.rgb *= 1.0 + ( mottle - 0.5 ) * 2.0 * fabricMottle;
  roughnessFactor = clamp( roughnessFactor + ( mottle - 0.5 ) * 0.12, 0.05, 1.0 );

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

  if ( ! gl_FrontFacing ) diffuseColor.rgb *= fabricInside;
}`;

/**
 * Material de tecido na cor escolhida, a partir do material do arquivo.
 * Quem chama libera com `dispose()` (a textura da trama é dividida e fica).
 */
export function clothMaterial(
  source: THREE.Material,
  color: string | undefined,
  fabric: FabricName,
  wrinkle: Wrinkle | null = null,
): THREE.MeshPhysicalMaterial {
  const look = FABRIC_LOOK[fabric];
  const m = toPhysical(source);
  if (color) m.color.set(color);
  // Tecido preto de verdade ainda devolve ~4% da luz: sem esse piso a peça
  // vira um recorte chapado e some a trama e as dobras.
  const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
  if (lum < BLACK_FLOOR) m.color.addScalar(BLACK_FLOOR - lum);
  const mean = color && m.map ? meanLuminance(m.map) : null;

  // Com mapa de aspereza (moletom), ele manda; senão, a do tecido.
  if (!m.roughnessMap) m.roughness = look.roughness;
  m.metalness = 0;
  m.specularIntensity = look.specular;
  m.sheen = look.sheen;
  m.sheenRoughness = look.sheenRoughness;
  m.sheenColor.copy(m.color).lerp(new THREE.Color(1, 1, 1), look.sheenWhite);

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
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>${VERTEX_DECL}`)
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vFabricPos = transformed;\n  vFabricNormal = objectNormal;\n  vFabricEdge = fabricEdge;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>${FRAGMENT_DECL}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>${FRAGMENT_BODY}`);
  };
  // O código do shader muda só com o ajuste da cor; o resto são uniforms.
  m.customProgramCacheKey = () => `vestra-fabric-${mean != null ? 1 : 0}`;
  return m;
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
  const e = edgeDistance(g.getAttribute("position").array, g.getIndex()?.array ?? null);
  let near = 0;
  for (let i = 0; i < e.length; i += 2) if (e[i] < 0.02) near++;
  const strip = near > 0.6 * (e.length / 2);
  for (let i = 0; i < e.length; i += 2) e[i] = strip ? 0 : EDGE_CAP - e[i];
  g.setAttribute("fabricEdge", new THREE.BufferAttribute(e, 2));
  return g;
}
