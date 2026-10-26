import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindBottom,
  bottomEase,
  bottomLength,
  bottomWrinkle,
  fitBottom,
  meshEdges,
  restOnShoes,
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

describe("fitBottom na borda de cima e nas alças do vestido", () => {
  // Dois pontos vizinhos 1 cm à frente da pele, cada um mais perto de um lado.
  const skin = new Float32Array([
    -0.03, 1.29, 0,
    -0.03, 1.31, 0,
    0.03, 1.29, 0,
    0.03, 1.31, 0,
  ]);
  const cloth = new Float32Array([-0.005, 1.3, 0.01, 0.005, 1.3, 0.01]);

  it("pontos vizinhos andam juntos (no corpo magro as alças enrugavam)", () => {
    const client = skin.map((v, i) => (i >= 6 && i % 3 === 2 ? 0.01 : v));
    const out = fitBottom(bindBottom(cloth, skin), client, 0);
    close(out[2], out[5], 2e-4);
  });
});

describe("fitBottom perto do meio do corpo", () => {
  it("o ponto não passa para o outro lado (no glúteo virava uma mancha escura)", () => {
    // A pele de que ele se afasta fica mais para fora: a direção cruza o meio.
    const skin = SKIN.map((v, i) => (i % 3 === 0 ? v + 0.03 : v));
    const cloth = new Float32Array([0.005, 1, 0.03]);
    const out = fitBottom(bindBottom(cloth, skin), skin, 0.02);
    assert.ok(out[0] >= 0.0025 - 1e-6, `${out[0]}`);
  });
});

describe("fitBottom na perna", () => {
  // Folga a mais cresce para baixo do entrepernas (gravidade no tamanho maior).
  const hang = (y: number) => 1 + 0.5 * Math.min((0.776 - y) / 0.7, 1);
  // Uma "perna" do lado direito (x > 0), bem abaixo do entrepernas.
  const leg = new Float32Array([
    0.1, 0.4, -0.01,
    0.1, 0.4, 0.01,
    0.1, 0.42, 0,
    0.1, 0.38, 0,
  ]);

  it("calça apertada: a perna aperta até o joelho; perto da barra, não", () => {
    const at = (y: number) => {
      const skin = leg.map((v, i) => (i % 3 === 1 ? v + y - 0.4 : v));
      return fitBottom(bindBottom(new Float32Array([0.12, y, 0]), skin), skin, -0.05)[0];
    };
    close(at(0.6), 0.1 + 0.02 * 0.4, 1e-5);
    close(at(0.2), 0.12, 1e-5);
    assert.ok(at(0.4) > at(0.6) && at(0.4) < 0.12, `${at(0.4)}`);
  });

  it("calça apertada: tamanho menor, perna mais justa", () => {
    const skin = leg.map((v, i) => (i % 3 === 1 ? v + 0.2 : v));
    const cloth = new Float32Array([0.12, 0.6, 0]);
    const small = fitBottom(bindBottom(cloth, skin), skin, -0.03)[0];
    const smaller = fitBottom(bindBottom(cloth, skin), skin, -0.02)[0];
    assert.ok(small < smaller && smaller < 0.12, `${small} ${smaller}`);
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
    assert.ok(low[0] - 0.12 > 1.3 * (high[0] - 0.12));
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

  it("no máximo 5 cm mais longa e 20 cm mais curta", () => {
    close(bottomLength("44", CHART, 60), 0.05);
    close(bottomLength("38", CHART, 100), -0.2);
    close(bottomLength("44", CHART, 94), -0.1);
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

  it("mais longa que o chão: a perna toda desce só até a barra encostar", () => {
    // Coxa, canela e barra: a canela não pode descer mais que a barra deixa.
    const leg = new Float32Array([0.1, 0.9, 0, 0.1, 0.5, 0, 0.1, 0.1, 0]);
    const binding = bindBottom(new Float32Array([0.1, 0.9, 0.02, 0.1, 0.5, 0.02, 0.1, 0.1, 0.02]), leg);
    const long = fitBottom(binding, leg, 0, null, 0.2);
    const touch = fitBottom(binding, leg, 0, null, 0.095);
    for (let k = 0; k < long.length; k++) close(long[k], touch[k], 1e-5);
  });

  // Perna em cone em volta de x = 0,12 (mais grossa em cima, como coxa e
  // joelho), com os triângulos: raio 0,03 + 0,1·y.
  const cone = () => {
    const pos: number[] = [];
    const index: number[] = [];
    const seg = 16;
    const ys = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    for (const y of ys)
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * 2 * Math.PI;
        const r = 0.03 + 0.1 * y;
        pos.push(0.12 + r * Math.cos(a), y, r * Math.sin(a));
      }
    for (let j = 0; j + 1 < ys.length; j++)
      for (let k = 0; k < seg; k++) {
        const [a, b] = [j * seg + k, j * seg + ((k + 1) % seg)];
        index.push(a, b, a + seg, b, b + seg, a + seg);
      }
    return { pos: new Float32Array(pos), index };
  };

  it("mais curta: o tecido sobe e abre onde a perna é mais grossa", () => {
    const leg = cone();
    // 1 cm fora da pele, de frente, em y = 0,3 (raio 0,06).
    const point = new Float32Array([0.12, 0.3, 0.07]);
    const out = fitBottom(bindBottom(point, leg.pos, leg.index), leg.pos, 0, null, -0.1);
    close(out[1], 0.4, 1e-5);
    // Em y = 0,4 a pele está a 0,07 do meio: o tecido continua 1 cm fora.
    close(Math.hypot(out[0] - 0.12, out[2]), 0.08, 2e-3);
  });

  it("sem os triângulos do corpo, só sobe", () => {
    const leg = cone();
    const out = fitBottom(bindBottom(new Float32Array([0.12, 0.3, 0.07]), leg.pos), leg.pos, 0, null, -0.1);
    close(out[2], 0.07, 1e-5);
  });

  it("folga a mais na calça: abre para fora do meio da perna, sem descer", () => {
    const leg = cone();
    // 1 cm abaixo de um anel e 1 cm fora: a pele dele fica acima e para dentro.
    const point = new Float32Array([0.12, 0.29, 0.07]);
    const binding = bindBottom(point, leg.pos, leg.index);
    assert.ok(binding.dir[1] < -0.1, `${binding.dir[1]}`);
    const out = fitBottom(binding, leg.pos, 0.02);
    close(out[1], 0.29, 1e-4);
    close(out[0], 0.12, 1e-4);
    assert.ok(out[2] > 0.08, `${out[2]}`);
  });
});

describe("restOnShoes", () => {
  // Tênis de mentira: um tampo plano a 8 cm do chão, 10 × 20 cm.
  const shoe: number[] = [];
  for (let x = 0; x <= 0.1; x += 0.002) for (let z = 0; z <= 0.2; z += 0.002) shoe.push(x, 0.08, z);
  const shoes = [new Float32Array(shoe)];
  // Tira de tecido em pé, de 2 cm a 20 cm, no meio do tênis (x = 0,05) e fora dele (x = 0,3).
  const strip = (x: number) => {
    const pos: number[] = [];
    const index: number[] = [];
    for (let k = 0; k <= 18; k++) pos.push(x, 0.02 + k * 0.01, 0.1, x + 0.005, 0.02 + k * 0.01, 0.1);
    for (let k = 0; k < 18; k++) index.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
    return { pos: new Float32Array(pos), edges: meshEdges(index) };
  };

  it("barra que entra no tênis pousa em cima dele, e o tecido acima sobe junto sem dobrar", () => {
    const { pos, edges } = strip(0.05);
    const out = restOnShoes(pos, edges, shoes);
    close(out[1], 0.084, 1e-3);
    for (let k = 1; k <= 18; k++) assert.ok(out[k * 6 + 1] > out[(k - 1) * 6 + 1], `ponto ${k} desceu`);
    close(out[18 * 6 + 1], 0.2, 1e-6); // longe do tênis: não muda
    for (let i = 0; i < pos.length; i += 3) {
      assert.equal(out[i], pos[i]);
      assert.equal(out[i + 2], pos[i + 2]);
    }
  });

  it("fora do tênis nada muda", () => {
    const { pos, edges } = strip(0.3);
    assert.equal(restOnShoes(pos, edges, shoes), pos);
  });
});

describe("meshEdges", () => {
  it("arestas de dois triângulos colados, sem repetir a do meio", () => {
    assert.equal(meshEdges([0, 1, 2, 1, 3, 2]).length / 2, 5);
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
