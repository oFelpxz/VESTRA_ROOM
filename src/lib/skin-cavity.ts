/**
 * Quanto cada ponto do corpo fica "dentro de uma dobra" (lista 11, item 3):
 * canto do olho, narina, orelha, axila, entre os dedos. A pele ali recebe
 * menos luz e fica mais avermelhada; sem isso o avatar parece plástico liso.
 *
 * Sem UV nem textura: sai da própria malha. Para cada vértice, a média de
 * quanto os vizinhos sobem na direção da normal (vizinho "acima" = buraco),
 * dividida pela distância — não depende da escala do corpo. Uma passada de
 * média com os vizinhos tira o ruído dos triângulos. Regras puras, sem three.
 */

/** 0 = liso ou para fora; 1 = dobra funda. */
export function surfaceCavity(
  positions: ArrayLike<number>,
  index: ArrayLike<number>,
  normals: ArrayLike<number>,
  strength = 4,
): Float32Array {
  const n = positions.length / 3;
  const rise = new Float32Array(n);
  const count = new Float32Array(n);
  const add = (a: number, b: number) => {
    const dx = positions[b * 3] - positions[a * 3];
    const dy = positions[b * 3 + 1] - positions[a * 3 + 1];
    const dz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    rise[a] += (dx * normals[a * 3] + dy * normals[a * 3 + 1] + dz * normals[a * 3 + 2]) / len;
    count[a]++;
  };
  // Cada aresta aparece em dois triângulos: conta duas vezes, sem mudar a média.
  for (let t = 0; t + 2 < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      add(p, q);
      add(q, p);
    }
  }
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = count[i] ? rise[i] / count[i] : 0;

  const sum = new Float32Array(n);
  const k = new Float32Array(n);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    for (const a of tri)
      for (const b of tri) {
        sum[a] += raw[b];
        k[a]++;
      }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = k[i] ? sum[i] / k[i] : raw[i];
    out[i] = Math.min(1, Math.max(0, v * strength));
  }
  return out;
}
