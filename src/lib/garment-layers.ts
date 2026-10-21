/**
 * Peças exportadas do programa de modelagem (Boxy Tee, Relugar, Oversized)
 * vêm com o tecido em duas camadas: a de fora e o avesso, quase no mesmo
 * lugar. No caimento cada camada anda sozinha e, em corpo maior, o avesso fura
 * a de fora (manchas cinza no peito e na barriga). Como o material já desenha
 * os dois lados, o avesso duplicado sai e fica só a camada de fora.
 */

// Mesma malha: quase o mesmo número de pontos e a mesma caixa (m).
const SAME_COUNT = 8;
const SAME_BOX = 0.005;

function box(p: ArrayLike<number>) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  }
  return { min, max };
}

/** Distância média ao eixo vertical (x, z). */
function meanRadius(p: ArrayLike<number>, cx: number, cz: number) {
  let s = 0;
  for (let i = 0; i < p.length; i += 3) s += Math.hypot(p[i] - cx, p[i + 2] - cz);
  return s / (p.length / 3);
}

/** Índices das malhas que são o avesso de outra (a de dentro do par). */
export function duplicateLayers(positions: ArrayLike<number>[]): Set<number> {
  const boxes = positions.map(box);
  // Eixo do corpo: centro da peça inteira (a caixa de um painel só, como a
  // frente, fica na frente do corpo e confundiria dentro e fora).
  const cx = (Math.min(...boxes.map((b) => b.min[0])) + Math.max(...boxes.map((b) => b.max[0]))) / 2;
  const cz = (Math.min(...boxes.map((b) => b.min[2])) + Math.max(...boxes.map((b) => b.max[2]))) / 2;
  const drop = new Set<number>();
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (drop.has(i) || drop.has(j)) continue;
      if (Math.abs(positions[i].length - positions[j].length) > SAME_COUNT * 3) continue;
      const a = boxes[i];
      const b = boxes[j];
      const same = [0, 1, 2].every(
        (k) => Math.abs(a.min[k] - b.min[k]) < SAME_BOX && Math.abs(a.max[k] - b.max[k]) < SAME_BOX,
      );
      if (!same) continue;
      const inner =
        meanRadius(positions[i], cx, cz) < meanRadius(positions[j], cx, cz) ? i : j;
      drop.add(inner);
    }
  }
  return drop;
}
