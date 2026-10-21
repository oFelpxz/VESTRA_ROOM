import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FABRICS, makeWeave } from "./fabric-weave";

const SIZE = 64;

describe("makeWeave", () => {
  for (const fabric of FABRICS) {
    describe(fabric, () => {
      const px = makeWeave(fabric, SIZE);

      it("gera um quadrado RGBA do tamanho pedido", () => {
        assert.equal(px.length, SIZE * SIZE * 4);
      });

      it("tom dos fios fica com média 1 (não clareia nem escurece a cor)", () => {
        let sum = 0;
        for (let i = 3; i < px.length; i += 4) sum += px[i] / 255 + 0.5;
        assert.ok(Math.abs(sum / (SIZE * SIZE) - 1) < 0.01, `média ${sum / (SIZE * SIZE)}`);
      });

      it("normal em volta de 'reta' (sem puxar a luz para um lado)", () => {
        let r = 0;
        let g = 0;
        for (let i = 0; i < px.length; i += 4) {
          r += px[i];
          g += px[i + 1];
        }
        const n = SIZE * SIZE;
        assert.ok(Math.abs(r / n - 127.5) < 3, `R médio ${r / n}`);
        assert.ok(Math.abs(g / n - 127.5) < 3, `G médio ${g / n}`);
      });

      it("repete sem emenda (a borda continua na borda oposta)", () => {
        // A diferença entre a última e a primeira coluna não pode ser maior que
        // a diferença normal entre duas colunas vizinhas.
        const at = (i: number, j: number, c: number) => px[(j * SIZE + i) * 4 + c];
        let seam = 0;
        let inner = 0;
        for (let j = 0; j < SIZE; j++)
          for (const c of [2, 3]) {
            seam += Math.abs(at(SIZE - 1, j, c) - at(0, j, c));
            inner += Math.abs(at(SIZE / 2, j, c) - at(SIZE / 2 - 1, j, c));
          }
        assert.ok(seam <= inner * 2 + SIZE, `emenda ${seam} x vizinhos ${inner}`);
      });
    });
  }
});
