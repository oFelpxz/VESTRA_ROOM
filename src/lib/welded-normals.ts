/**
 * Normais lisas do corpo do avatar (lista 11, item 6). O corpo base
 * (MakeHuman) repete ~1100 vértices no mesmo ponto — costuras de UV no pulso,
 * no tornozelo, nos dedos e no meio da cabeça. A normal de cada cópia só via
 * os triângulos do seu lado, e a luz desenhava um risco fino ali (e a ponta
 * do polegar escura). Aqui as cópias somam os triângulos juntas, como se a
 * malha fosse uma peça só. Regras puras, sem three.
 */

/** Normal por vértice, média ponderada pela área dos triângulos em volta de cada ponto. */
export function weldedNormals(positions: ArrayLike<number>, index: ArrayLike<number>): Float32Array {
  const n = positions.length / 3;
  // Primeiro vértice em cada ponto (posição arredondada a 0,01 mm).
  const canon = new Int32Array(n);
  const first = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(positions[i * 3] * 1e5)},${Math.round(positions[i * 3 + 1] * 1e5)},${Math.round(positions[i * 3 + 2] * 1e5)}`;
    const at = first.get(key);
    if (at === undefined) first.set(key, i);
    canon[i] = at ?? i;
  }
  const sum = new Float64Array(n * 3);
  for (let t = 0; t + 2 < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    const u = [0, 1, 2].map((k) => positions[b * 3 + k] - positions[a * 3 + k]);
    const v = [0, 1, 2].map((k) => positions[c * 3 + k] - positions[a * 3 + k]);
    // Produto vetorial sem normalizar: o tamanho já é o peso da área.
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const p of [canon[a], canon[b], canon[c]]) for (let k = 0; k < 3; k++) sum[p * 3 + k] += f[k];
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = canon[i];
    const len = Math.hypot(sum[p * 3], sum[p * 3 + 1], sum[p * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = sum[p * 3 + k] / len;
  }
  return out;
}
