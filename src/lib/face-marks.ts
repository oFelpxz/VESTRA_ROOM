/**
 * Marcas do rosto (lista 12, item 3): sobrancelha, boca e a linha da pálpebra
 * são pintadas no shader da pele, como o cabelo — o corpo não tem UV. Aqui
 * cada vértice ganha a sua posição no rosto, medida a partir dos olhos:
 *
 * - x: distância da linha do meio do rosto (os dois lados ficam iguais);
 * - y: altura acima do centro dos olhos (negativo = abaixo);
 * - z: distância até a superfície do globo mais perto (a borda da pálpebra).
 *
 * O provador mede uma vez, no corpo de referência: com as medidas do cliente
 * o vértice leva a marca junto (a boca do corpo "homem" fica mais baixa, e a
 * pintura vai com ela). Tudo dividido pelo tamanho do olho, para servir a
 * outro modelo de corpo. Fora do rosto (nuca, resto do corpo) o vértice vai
 * para longe de todas as marcas. Regras puras, sem three.
 */

import type { EyeBall } from "./eye-sockets";

/** Raio do globo no corpo de referência (m), o mesmo de `placeEyes`. */
const EYE_RADIUS = 0.0125;
/** Pedaço do rosto onde pode haver marca, em volta do centro dos olhos (m). */
const HALF_WIDTH = 0.075;
const ABOVE = 0.06;
const BELOW = 0.1;
/** Quanto atrás do globo o rosto ainda conta (as laterais da boca e da testa). */
const BEHIND = 0.04;

/** Posição de quem está fora do rosto: longe da sobrancelha, da boca e do olho. */
export const OFF_FACE: [number, number, number] = [1, 1, 1];

export function faceCoords(positions: ArrayLike<number>, eyes: EyeBall[]): Float32Array {
  const n = positions.length / 3;
  const out = new Float32Array(n * 3);
  if (eyes.length !== 2) {
    for (let i = 0; i < n; i++) out.set(OFF_FACE, i * 3);
    return out;
  }
  const s = (eyes[0].radius + eyes[1].radius) / 2 / EYE_RADIUS;
  const cx = (eyes[0].center[0] + eyes[1].center[0]) / 2;
  const cy = (eyes[0].center[1] + eyes[1].center[1]) / 2;
  const cz = (eyes[0].center[2] + eyes[1].center[2]) / 2;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const ax = Math.abs(x - cx) / s;
    const ay = (y - cy) / s;
    if (ax > HALF_WIDTH || ay > ABOVE || ay < -BELOW || z < cz - BEHIND * s) {
      out.set(OFF_FACE, i * 3);
      continue;
    }
    let lid = Infinity;
    for (const e of eyes) {
      const d = Math.hypot(x - e.center[0], y - e.center[1], z - e.center[2]) - e.radius;
      lid = Math.min(lid, d);
    }
    out[i * 3] = ax;
    out[i * 3 + 1] = ay;
    out[i * 3 + 2] = Math.min(lid / s, 1);
  }
  return out;
}
