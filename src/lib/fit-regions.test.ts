import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classify,
  garmentKind,
  overallFit,
  recommendSize,
  regionFits,
  type BodyMeasures,
  type ChartRow,
} from "./fit-regions";

// Tabela padrão do seed (prisma/seed.ts).
const CHART: ChartRow[] = [
  { size: "P", chestMinCm: 86, chestMaxCm: 90, waistMinCm: 70, waistMaxCm: 76, hipMinCm: 88, hipMaxCm: 94, armLengthMinCm: 56, armLengthMaxCm: 60, legLengthMinCm: 74, legLengthMaxCm: 78 },
  { size: "M", chestMinCm: 91, chestMaxCm: 98, waistMinCm: 77, waistMaxCm: 84, hipMinCm: 95, hipMaxCm: 100, armLengthMinCm: 60, armLengthMaxCm: 64, legLengthMinCm: 78, legLengthMaxCm: 82 },
  { size: "G", chestMinCm: 99, chestMaxCm: 106, waistMinCm: 85, waistMaxCm: 92, hipMinCm: 101, hipMaxCm: 106, armLengthMinCm: 63, armLengthMaxCm: 67, legLengthMinCm: 81, legLengthMaxCm: 85 },
  { size: "GG", chestMinCm: 107, chestMaxCm: 114, waistMinCm: 93, waistMaxCm: 100, hipMinCm: 107, hipMaxCm: 113, armLengthMinCm: 66, armLengthMaxCm: 70, legLengthMinCm: 84, legLengthMaxCm: 88 },
];
const row = (size: string) => CHART.find((r) => r.size === size)!;

// Corpo no centro do M.
const BODY_M: BodyMeasures = {
  heightCm: 170,
  chestCm: 94.5,
  waistCm: 80.5,
  hipCm: 97.5,
  shoulderCm: 43.5,
  armLengthCm: 62,
  legLengthCm: 80,
};
// Corpo no centro do G.
const BODY_G: BodyMeasures = {
  heightCm: 175,
  chestCm: 102,
  waistCm: 88,
  hipCm: 103,
  shoulderCm: 47,
  armLengthCm: 65,
  legLengthCm: 83,
};

const fitOf = (body: BodyMeasures, size: string, region: string, tol = 2) =>
  regionFits(body, row(size), CHART, "top", tol).find((r) => r.region === region);

describe("classify", () => {
  it("separa as cinco classes pela tolerância e pela metade da faixa", () => {
    assert.equal(classify(0, 3, 2), "REGULAR");
    assert.equal(classify(2, 3, 2), "REGULAR"); // no limite ainda é regular
    assert.equal(classify(2.5, 3, 2), "JUSTO");
    assert.equal(classify(5, 3, 2), "JUSTO");
    assert.equal(classify(5.5, 3, 2), "MUITO_JUSTO");
    assert.equal(classify(-2.5, 3, 2), "SOLTO");
    assert.equal(classify(-5.5, 3, 2), "OVERSIZED");
  });
});

describe("regionFits", () => {
  it("peça de cima: as seis regiões, todas regulares no tamanho certo", () => {
    const regions = regionFits(BODY_M, row("M"), CHART, "top", 2);
    assert.deepEqual(
      regions.map((r) => r.region),
      ["shoulders", "chest", "waist", "hip", "sleeve", "hem"],
    );
    assert.ok(regions.every((r) => r.fit === "REGULAR"));
    assert.equal(overallFit(regions), "REGULAR");
  });

  it("o mesmo corpo aperta num tamanho e sobra em outro", () => {
    const body = { ...BODY_M, chestCm: 104 };
    assert.equal(fitOf(body, "M", "chest")?.fit, "MUITO_JUSTO");
    assert.equal(fitOf(body, "G", "chest")?.fit, "REGULAR");
    assert.equal(fitOf(body, "GG", "chest")?.fit, "OVERSIZED");
  });

  it("manga e barra dizem se ficam curtas ou compridas", () => {
    const sleeve = fitOf({ ...BODY_M, armLengthCm: 68 }, "M", "sleeve");
    assert.equal(sleeve?.fit, "MUITO_JUSTO");
    assert.equal(sleeve?.note, "curta");
    // barra da peça de cima pela altura: o GG serve em quem é 10 cm mais alto que o M
    const hem = fitOf({ ...BODY_M, heightCm: 185 }, "GG", "hem");
    assert.equal(hem?.fit, "JUSTO");
    assert.equal(hem?.note, "um pouco curta");
    assert.equal(fitOf({ ...BODY_M, heightCm: 160 }, "M", "hem")?.note, "comprida");
  });

  it("a tolerância da loja muda o que conta como regular", () => {
    const body = { ...BODY_M, chestCm: 97 }; // 2,5 cm acima do centro
    assert.equal(fitOf(body, "M", "chest", 2)?.fit, "JUSTO");
    assert.equal(fitOf(body, "M", "chest", 3)?.fit, "REGULAR");
  });

  it("peça de baixo: só cintura, quadril e barra (pela perna)", () => {
    const regions = regionFits({ ...BODY_M, legLengthCm: 86 }, row("M"), CHART, "bottom", 2);
    assert.deepEqual(
      regions.map((r) => r.region),
      ["waist", "hip", "hem"],
    );
    assert.equal(regions[2].note, "curta");
  });

  it("região sem medida fica de fora", () => {
    const regions = regionFits(
      { ...BODY_M, shoulderCm: null, armLengthCm: null },
      row("M"),
      CHART,
      "top",
      2,
    );
    assert.ok(!regions.some((r) => r.region === "shoulders" || r.region === "sleeve"));
  });

  it("o resumo é a região mais longe do regular, com o justo na frente", () => {
    const regions = regionFits({ ...BODY_M, chestCm: 98, hipCm: 94.5 }, row("M"), CHART, "top", 2);
    // tórax 3,5 acima (justo) e quadril 3 abaixo (solto): fica justo
    assert.equal(overallFit(regions), "JUSTO");
  });
});

describe("recommendSize", () => {
  const sizes = ["P", "M", "G", "GG"];

  it("sugere o tamanho do corpo na preferência regular", () => {
    assert.equal(recommendSize(BODY_G, CHART, sizes, "top", "REGULAR", 2)?.size, "G");
    assert.equal(recommendSize(BODY_M, CHART, sizes, "top", "REGULAR", 2)?.size, "M");
  });

  it("oversized sobe um tamanho; slim não desce para o que fica muito justo", () => {
    assert.equal(recommendSize(BODY_G, CHART, sizes, "top", "OVERSIZED", 2)?.size, "GG");
    assert.equal(recommendSize(BODY_G, CHART, sizes, "top", "SLIM", 2)?.size, "G");
  });

  it("evita o tamanho muito justo mesmo se o resto vestir melhor", () => {
    // tudo de M, menos o quadril, que só cabe no G
    const rec = recommendSize({ ...BODY_M, hipCm: 105 }, CHART, sizes, "top", "REGULAR", 2);
    assert.equal(rec?.size, "G");
    assert.equal(rec?.tooTight, false);
  });

  it("se nenhum serve, sugere o que fica menos justo e avisa", () => {
    const rec = recommendSize({ ...BODY_G, chestCm: 130 }, CHART, sizes, "top", "REGULAR", 2);
    assert.equal(rec?.size, "GG");
    assert.equal(rec?.tooTight, true);
  });

  it("só considera os tamanhos que a peça tem", () => {
    const rec = recommendSize(BODY_G, CHART, ["P", "M"], "top", "REGULAR", 2);
    assert.equal(rec?.size, "M");
    assert.equal(rec?.tooTight, true);
  });

  it("sem medidas que a tabela cubra, não sugere", () => {
    const empty: BodyMeasures = {
      heightCm: 170,
      chestCm: null,
      waistCm: null,
      hipCm: null,
      shoulderCm: null,
      armLengthCm: null,
      legLengthCm: null,
    };
    assert.equal(recommendSize(empty, CHART, sizes, "bottom", "REGULAR", 2), null);
  });
});

describe("garmentKind", () => {
  it("pela categoria", () => {
    assert.equal(garmentKind("camisetas"), "top");
    assert.equal(garmentKind("moletons"), "top");
    assert.equal(garmentKind("calcas"), "bottom");
    assert.equal(garmentKind("saias"), "bottom");
    assert.equal(garmentKind("vestidos"), "dress");
    assert.equal(garmentKind("acessorios"), "other");
  });
});
