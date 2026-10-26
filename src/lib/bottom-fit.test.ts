import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindBottom,
  bottomEase,
  bottomLength,
  bottomWrinkle,
  fitBottom,
  type TopHem,
} from "./bottom-fit";

// Tabela da calça (scripts/attach-bottom-models.ts): quadril e perna por tamanho.
const CHART = [
  { size: "38", hipMinCm: 92, hipMaxCm: 96, legLengthMinCm: 76, legLengthMaxCm: 80 },
  { size: "40", hipMinCm: 96, hipMaxCm: 100, legLengthMinCm: 78, legLengthMaxCm: 82 },
  { size: "42", hipMinCm: 100, hipMaxCm: 104, legLengthMinCm: 80, legLengthMaxCm: 84 },
  { size: "44", hipMinCm: 104, hipMaxCm: 108, legLengthMinCm: 82, legLengthMaxCm: 86 },
];

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

// Pele: um quadrado no chão (y = 1); tecido: um ponto 1 cm acima do meio.
const SKIN = new Float32Array([
  -0.01, 1, -0.01,
  0.01, 1, -0.01,
  -0.01, 1, 0.01,
  0.01, 1, 0.01,
]);
const CLOTH = new Float32Array([0, 1.01, 0]);

describe("bottomEase", () => {
  it("o 40 num quadril de 98 é o próprio molde", () => {
    close(bottomEase("40", CHART, 98), 0);
    close(bottomEase(null, CHART, 98), 0);
  });

  it("tamanho maior sobra, menor aperta", () => {
    close(bottomEase("44", CHART, 98), 8 / (2 * Math.PI) / 100);
    close(bottomEase("38", CHART, 98), -4 / (2 * Math.PI) / 100);
  });

  it("sem tabela, 4 cm de quadril por número", () => {
    close(bottomEase("42", [], 98), 4 / (2 * Math.PI) / 100);
  });

  it("sem quadril do cliente, compara com o molde", () => {
    close(bottomEase("40", CHART, null), 0);
  });
});

describe("fitBottom", () => {
  it("no corpo do molde o tecido fica onde estava", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, 0);
    close(out[0], 0);
    close(out[1], 1.01);
    close(out[2], 0);
  });

  it("acompanha a pele e soma a folga", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const moved = SKIN.map((v, i) => (i % 3 === 1 ? v + 0.1 : v));
    const out = fitBottom(binding, moved, 0.005);
    close(out[1], 1.1 + 0.015, 1e-5);
  });

  it("apertado chega no máximo a 3/4 da distância do molde", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, -0.05);
    close(out[1], 1.0075, 1e-5);
  });

  it("nunca entra na pele", () => {
    const near = new Float32Array([0, 1.004, 0]);
    const out = fitBottom(bindBottom(near, SKIN), SKIN, -0.05);
    close(out[1], 1.003, 1e-5);
  });

  it("toda a pele do outro lado do meio: o ponto não vira NaN", () => {
    const left = SKIN.map((v, i) => (i % 3 === 0 ? v - 0.02 : v));
    const cloth = new Float32Array([0.011, 1.01, 0]);
    const out = fitBottom(bindBottom(cloth, left), left, 0);
    assert.ok(out.every(Number.isFinite), `${out}`);
    close(out[1], 1.01, 1e-5);
  });

  it("debaixo da peça de cima fica rente", () => {
    const binding = bindBottom(CLOTH, SKIN);
    const out = fitBottom(binding, SKIN, 0, 0.9);
    close(out[1], 1.004, 1e-5);
  });
});

describe("fitBottom debaixo da peça de cima vestida", () => {
  // Pele de pé no lado +X (x = 0,1, em volta de y = 1); tecido 2 cm para fora.
  const WALL = new Float32Array([
    0.1, 0.99, -0.01,
    0.1, 0.99, 0.01,
    0.1, 1.01, -0.01,
    0.1, 1.01, 0.01,
  ]);
  const POINT = new Float32Array([0.12, 1, 0]);
  const hem = (y: number, r = 1, side?: number): TopHem => {
    const ys = new Float32Array(24).fill(y);
    if (side != null) ys[0] = ys[23] = side; // as duas fatias em volta de +X
    return { cx: 0, cz: 0, y: ys, r: new Float32Array(24).fill(r) };
  };
  const fit = (tuck: TopHem) => fitBottom(bindBottom(POINT, WALL), WALL, 0, tuck)[0];

  it("acima da barra vestida fica rente", () => {
    close(fit(hem(0.9)), 0.104, 1e-5);
  });

  it("vale a barra na direção do ponto: lá ela está mais baixa ou mais alta", () => {
    close(fit(hem(0.9, 1, 1)), 0.12, 1e-5);
    close(fit(hem(1, 1, 0.9)), 0.104, 1e-5);
  });

  it("logo acima da barra mantém a forma, mas não passa da peça de cima", () => {
    close(fit(hem(0.99)), 0.12, 1e-5);
    close(fit(hem(0.99, 0.11)), 0.107, 1e-5);
  });

  it("abaixo da barra (à mostra), a peça de cima não aperta", () => {
    close(fit(hem(1.02, 0.11)), 0.12, 1e-5);
  });
});

describe("fitBottom no corpete do vestido", () => {
  // Pele de frente (z = 0) na altura do busto e um ponto do tecido 1 cm à frente.
  const chest = new Float32Array([
    -0.01, 1.19, 0,
    0.01, 1.19, 0,
    -0.01, 1.21, 0,
    0.01, 1.21, 0,
    0, 1.2, 0,
  ]);
  const cloth = new Float32Array([0, 1.2, 0.01]);

  it("o mamilo maior no cliente não fura o tecido", () => {
    const client = chest.map((v, i) => (i === 14 ? 0.02 : v));
    const out = fitBottom(bindBottom(cloth, chest), client, 0);
    assert.ok(out[2] > 0.02 + 0.002, `${out[2]}`);
  });

  it("na borda do decote e nas alcinhas, não (serrilhava)", () => {
    const up = (a: Float32Array) => a.map((v, i) => (i % 3 === 1 ? v + 0.06 : v));
    const client = up(chest).map((v, i) => (i === 14 ? 0.02 : v));
    const out = fitBottom(bindBottom(up(cloth), up(chest)), client, 0);
    assert.ok(out[2] < 0.02, `${out[2]}`);
  });
});

describe("fitBottom na perna", () => {
  // Folga a mais cresce para baixo do entrepernas (gravidade no tamanho maior).
  const hang = (y: number) => 1 + 1.5 * Math.min((0.776 - y) / 0.7, 1);
  // Uma "perna" do lado direito (x > 0), bem abaixo do entrepernas.
  const leg = new Float32Array([
    0.1, 0.4, -0.01,
    0.1, 0.4, 0.01,
    0.1, 0.42, 0,
    0.1, 0.38, 0,
  ]);

  it("tamanho apertado não aperta a perna (o bolso cargo entraria no tecido)", () => {
    const cloth = new Float32Array([0.12, 0.4, 0]);
    const out = fitBottom(bindBottom(cloth, leg), leg, -0.05);
    close(out[0], 0.12, 1e-5);
  });

  it("folga a mais: o lado de dentro sobra só 1/4", () => {
    const outer = fitBottom(bindBottom(new Float32Array([0.12, 0.4, 0]), leg), leg, 0.02);
    const inner = fitBottom(bindBottom(new Float32Array([0.08, 0.4, 0]), leg), leg, 0.02);
    close(outer[0], 0.12 + 0.02 * hang(0.4), 1e-5);
    close(inner[0], 0.08 - 0.02 * 0.25 * hang(0.4), 1e-5);
  });

  it("perto do entrepernas o lado de dentro não ganha folga (as pernas se encostavam)", () => {
    // Coxa direita 3 cm abaixo do entrepernas (0,776 m).
    const thigh = leg.map((v, i) => (i % 3 === 1 ? v + 0.346 : v));
    const inner = fitBottom(bindBottom(new Float32Array([0.08, 0.746, 0]), thigh), thigh, 0.04);
    const outer = fitBottom(bindBottom(new Float32Array([0.12, 0.746, 0]), thigh), thigh, 0.04);
    close(inner[0], 0.08, 1e-5);
    close(outer[0], 0.12 + 0.04 * hang(0.746), 1e-5);
  });

  it("tamanho maior cai reto: perto da barra sobra mais que na coxa", () => {
    const knee = leg.map((v, i) => (i % 3 === 1 ? v - 0.3 : v));
    const thigh = leg.map((v, i) => (i % 3 === 1 ? v + 0.3 : v));
    const low = fitBottom(bindBottom(new Float32Array([0.12, 0.1, 0]), knee), knee, 0.02);
    const high = fitBottom(bindBottom(new Float32Array([0.12, 0.7, 0]), thigh), thigh, 0.02);
    assert.ok(low[0] - 0.12 > 2 * (high[0] - 0.12));
  });
});

describe("bindBottom longe da pele", () => {
  it("a barra solta da saia segue as duas pernas, não só a mais perto", () => {
    // Duas "pernas" (um ponto cada) a 10 cm do meio; tecido no meio, à frente.
    const legs = new Float32Array([-0.1, 0.5, 0, 0.1, 0.5, 0]);
    const cloth = new Float32Array([0.001, 0.5, 0.12]);
    const binding = bindBottom(cloth, legs);
    assert.equal(binding.start[1] - binding.start[0], 2);
    // As pernas abrem 2 cm cada: o tecido fica no meio.
    const wider = new Float32Array([-0.12, 0.5, 0, 0.12, 0.5, 0]);
    const out = fitBottom(binding, wider, 0);
    close(out[0], 0.001, 2e-3);
  });
});

describe("bottomLength", () => {
  it("perna do tamanho menos a perna do cliente", () => {
    close(bottomLength("40", CHART, 80), 0);
    close(bottomLength("44", CHART, 80), 0.04);
    close(bottomLength("38", CHART, 82), -0.04);
  });

  it("sem perna na tabela ou sem medida, não muda", () => {
    close(bottomLength("40", [{ size: "40", hipMinCm: 96, hipMaxCm: 100 }], 80), 0);
    close(bottomLength("40", CHART, null), 0);
  });

  it("no máximo 5 cm mais longa e 10 cm mais curta", () => {
    close(bottomLength("44", CHART, 60), 0.05);
    close(bottomLength("38", CHART, 100), -0.1);
  });
});

describe("fitBottom comprimento", () => {
  // Pele: um ponto na coxa (acima do entrepernas) e um no tornozelo.
  const skin = new Float32Array([0.1, 0.9, 0, 0.1, 0.1, 0]);
  const cloth = new Float32Array([0.1, 0.9, 0.02, 0.1, 0.1, 0.02]);

  it("a barra desce, a coxa fica onde estava", () => {
    const out = fitBottom(bindBottom(cloth, skin), skin, 0, null, 0.03);
    close(out[1], 0.9, 1e-5);
    close(out[4], 0.07, 1e-5);
  });

  it("mais curta: a barra sobe; mais longa: para no chão", () => {
    const binding = bindBottom(cloth, skin);
    close(fitBottom(binding, skin, 0, null, -0.05)[4], 0.15, 1e-5);
    close(fitBottom(binding, skin, 0, null, 0.2)[4], 0.005, 1e-5);
  });
});

describe("bottomWrinkle", () => {
  // Anel de pontos na altura y, com raio r, centrado em x = cx.
  const ring = (cx: number, y: number, r: number) => {
    const out: number[] = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      out.push(cx + r * Math.cos(a), y, r * Math.sin(a));
    }
    return out;
  };

  it("saia passa pelo meio na altura do joelho: caimento", () => {
    const skirt = [...ring(0, 0.9, 0.18), ...ring(0, 0.5, 0.22)];
    assert.equal(bottomWrinkle(new Float32Array(skirt)), "caimento");
  });

  it("calça tem vão entre as pernas: calça", () => {
    const pants = [...ring(0, 0.95, 0.17), ...ring(-0.09, 0.5, 0.06), ...ring(0.09, 0.5, 0.06)];
    assert.equal(bottomWrinkle(new Float32Array(pants)), "calca");
  });

  it("bermuda acaba acima do joelho: calça", () => {
    const shorts = [...ring(0, 0.95, 0.17), ...ring(-0.09, 0.62, 0.07), ...ring(0.09, 0.62, 0.07)];
    assert.equal(bottomWrinkle(new Float32Array(shorts)), "calca");
  });
});
