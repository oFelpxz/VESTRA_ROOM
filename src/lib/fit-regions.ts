/**
 * Caimento por região do corpo (3D-06) e tamanho sugerido (3D-08).
 *
 * Para cada região (ombros, tórax, cintura, quadril, manga e barra) compara a
 * medida do cliente com o centro da faixa da tabela de medidas do tamanho:
 *
 *   diferença = medida do cliente − centro da faixa
 *
 * Diferença positiva: o corpo é maior que a peça (aperta, ou fica curta).
 * Negativa: a peça é maior que o corpo (sobra, ou fica comprida). Dentro da
 * tolerância da loja (configurações, item 25.8) é "regular"; passando da
 * metade da faixa mais a tolerância é "muito justo" ou "oversized".
 *
 * A classe é física (como a peça veste) e não muda com a preferência do
 * cliente: a preferência só pesa na escolha do tamanho sugerido.
 *
 * Conta pura, sem banco: roda no navegador e nos testes.
 */

import { sizeSteps } from "./garment-fit";

export type FitPreference = "SLIM" | "REGULAR" | "OVERSIZED";

export type FitClass = "MUITO_JUSTO" | "JUSTO" | "REGULAR" | "SOLTO" | "OVERSIZED";

/** Da mais justa para a mais solta (ordem da escala no provador). */
export const FIT_CLASSES: FitClass[] = ["MUITO_JUSTO", "JUSTO", "REGULAR", "SOLTO", "OVERSIZED"];

export const FIT_CLASS_LABEL: Record<FitClass, string> = {
  MUITO_JUSTO: "Muito justo",
  JUSTO: "Justo",
  REGULAR: "Regular",
  SOLTO: "Solto",
  OVERSIZED: "Oversized",
};

export type FitRegion = "shoulders" | "chest" | "waist" | "hip" | "sleeve" | "hem";

export const REGION_LABEL: Record<FitRegion, string> = {
  shoulders: "Ombros",
  chest: "Tórax",
  waist: "Cintura",
  hip: "Quadril",
  sleeve: "Manga",
  hem: "Barra",
};

/** Tipo de peça, pela categoria: decide quais regiões contam. */
export type GarmentKind = "top" | "bottom" | "dress" | "other";

const KIND_BY_CATEGORY: Record<string, GarmentKind> = {
  camisetas: "top",
  camisas: "top",
  moletons: "top",
  jaquetas: "top",
  calcas: "bottom",
  bermudas: "bottom",
  saias: "bottom",
  vestidos: "dress",
};

export function garmentKind(categorySlug: string): GarmentKind {
  return KIND_BY_CATEGORY[categorySlug] ?? "other";
}

/** Categorias de um tipo de peça (ex.: as de baixo, para montar um look). */
export function categoriesOfKind(kind: GarmentKind): string[] {
  return Object.keys(KIND_BY_CATEGORY).filter((slug) => KIND_BY_CATEGORY[slug] === kind);
}

const REGIONS_BY_KIND: Record<GarmentKind, FitRegion[]> = {
  top: ["shoulders", "chest", "waist", "hip", "sleeve", "hem"],
  bottom: ["waist", "hip", "hem"],
  dress: ["shoulders", "chest", "waist", "hip"],
  other: ["shoulders", "chest", "waist", "hip", "sleeve", "hem"],
};

const LENGTH_REGIONS: ReadonlySet<FitRegion> = new Set(["sleeve", "hem"]);

// A tabela não tem ombro: ombro a ombro fica perto de 46% do peito.
const SHOULDER_PER_CHEST = 0.46;
// Barra de peça de cima: a tabela não tem comprimento. O M veste bem quem tem
// de 166 a 174 cm; cada tamanho acima (+2 cm de corpo na confecção, ver
// `sizeGrade`) serve em quem tem uns 5 cm a mais.
const TOP_HEIGHT_M_CM = 170;
const TOP_HEIGHT_HALF_CM = 4;
const TOP_HEIGHT_PER_SIZE_CM = 5;

export type BodyMeasures = {
  heightCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  shoulderCm: number | null;
  armLengthCm: number | null;
  legLengthCm: number | null;
};

export type ChartRow = {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
  armLengthMinCm: number | null;
  armLengthMaxCm: number | null;
  legLengthMinCm: number | null;
  legLengthMaxCm: number | null;
};

export type RegionFit = {
  region: FitRegion;
  label: string;
  isLength: boolean;
  userCm: number;
  idealMinCm: number;
  idealMaxCm: number;
  /** Medida do cliente − centro da faixa (cm). */
  diffCm: number;
  fit: FitClass;
  /** Para manga e barra: "curta" ou "comprida". */
  note: string | null;
};

type Range = { min: number; max: number };

const range = (min: number | null, max: number | null): Range | null =>
  min != null && max != null && max >= min ? { min, max } : null;

/** Faixa da tabela e medida do cliente para uma região, ou null sem dados. */
function regionInput(
  region: FitRegion,
  kind: GarmentKind,
  body: BodyMeasures,
  row: ChartRow,
  chart: ChartRow[],
): { user: number | null; ideal: Range | null } {
  switch (region) {
    case "shoulders": {
      const chest = range(row.chestMinCm, row.chestMaxCm);
      return {
        user: body.shoulderCm,
        ideal: chest && {
          min: chest.min * SHOULDER_PER_CHEST,
          max: chest.max * SHOULDER_PER_CHEST,
        },
      };
    }
    case "chest":
      return { user: body.chestCm, ideal: range(row.chestMinCm, row.chestMaxCm) };
    case "waist":
      return { user: body.waistCm, ideal: range(row.waistMinCm, row.waistMaxCm) };
    case "hip":
      return { user: body.hipCm, ideal: range(row.hipMinCm, row.hipMaxCm) };
    case "sleeve":
      return { user: body.armLengthCm, ideal: range(row.armLengthMinCm, row.armLengthMaxCm) };
    case "hem": {
      if (kind === "bottom") {
        return { user: body.legLengthCm, ideal: range(row.legLengthMinCm, row.legLengthMaxCm) };
      }
      const center = TOP_HEIGHT_M_CM + sizeSteps(row.size, chart) * TOP_HEIGHT_PER_SIZE_CM;
      return {
        user: body.heightCm,
        ideal: { min: center - TOP_HEIGHT_HALF_CM, max: center + TOP_HEIGHT_HALF_CM },
      };
    }
  }
}

/**
 * Classe pela diferença até o centro da faixa: até a tolerância é regular;
 * além da metade da faixa mais a tolerância, é o extremo.
 */
export function classify(diffCm: number, halfRangeCm: number, toleranceCm: number): FitClass {
  if (diffCm > halfRangeCm + toleranceCm) return "MUITO_JUSTO";
  if (diffCm > toleranceCm) return "JUSTO";
  if (diffCm < -(halfRangeCm + toleranceCm)) return "OVERSIZED";
  if (diffCm < -toleranceCm) return "SOLTO";
  return "REGULAR";
}

const LENGTH_NOTE: Record<FitClass, string | null> = {
  MUITO_JUSTO: "curta",
  JUSTO: "um pouco curta",
  REGULAR: null,
  SOLTO: "um pouco comprida",
  OVERSIZED: "comprida",
};

/** Caimento de cada região de um tamanho. Regiões sem medida ficam de fora. */
export function regionFits(
  body: BodyMeasures,
  row: ChartRow,
  chart: ChartRow[],
  kind: GarmentKind,
  toleranceCm: number,
): RegionFit[] {
  const out: RegionFit[] = [];
  for (const region of REGIONS_BY_KIND[kind]) {
    const { user, ideal } = regionInput(region, kind, body, row, chart);
    if (user == null || !ideal) continue;
    const center = (ideal.min + ideal.max) / 2;
    const diffCm = user - center;
    const fit = classify(diffCm, (ideal.max - ideal.min) / 2, toleranceCm);
    const isLength = LENGTH_REGIONS.has(region);
    out.push({
      region,
      label: REGION_LABEL[region],
      isLength,
      userCm: user,
      idealMinCm: ideal.min,
      idealMaxCm: ideal.max,
      diffCm,
      fit,
      note: isLength ? LENGTH_NOTE[fit] : null,
    });
  }
  return out;
}

const SEVERITY: Record<FitClass, number> = {
  MUITO_JUSTO: 2,
  JUSTO: 1,
  REGULAR: 0,
  SOLTO: 1,
  OVERSIZED: 2,
};

/**
 * Resumo do tamanho: a região de circunferência mais longe do regular (manga
 * e barra só contam se não houver outra). No empate, o justo vence o solto:
 * aperto incomoda mais que folga.
 */
export function overallFit(regions: RegionFit[]): FitClass | null {
  const girths = regions.filter((r) => !r.isLength);
  const pool = girths.length > 0 ? girths : regions;
  const tight = (c: FitClass) => c === "MUITO_JUSTO" || c === "JUSTO";
  let worst: FitClass | null = null;
  for (const r of pool) {
    if (
      worst == null ||
      SEVERITY[r.fit] > SEVERITY[worst] ||
      (SEVERITY[r.fit] === SEVERITY[worst] && tight(r.fit) && !tight(worst))
    ) {
      worst = r.fit;
    }
  }
  return worst;
}

/** Onde o cliente quer ficar em relação ao centro da faixa (circunferências). */
function preferenceTarget(
  preference: FitPreference,
  halfRangeCm: number,
  toleranceCm: number,
): number {
  if (preference === "SLIM") return toleranceCm; // no limite do justo
  if (preference === "OVERSIZED") return -(halfRangeCm + toleranceCm); // no limite do oversized
  return 0;
}

// Manga e barra pesam menos que as circunferências na escolha.
const LENGTH_WEIGHT = 0.5;
// Um tamanho muito justo em alguma circunferência só é sugerido se todos
// forem; aí vence o que passa menos do limite.
const TOO_TIGHT_PENALTY = 100;

export type SizeRecommendation = {
  size: string;
  regions: RegionFit[];
  /** Nenhum tamanho deixa de ficar muito justo em alguma região. */
  tooTight: boolean;
};

/**
 * Tamanho sugerido: o mais perto da preferência do cliente, evitando o que
 * fica muito justo. É uma estimativa (a tela avisa).
 */
export function recommendSize(
  body: BodyMeasures,
  chart: ChartRow[],
  sizes: string[],
  kind: GarmentKind,
  preference: FitPreference,
  toleranceCm: number,
): SizeRecommendation | null {
  let best: { size: string; regions: RegionFit[]; score: number; tooTight: boolean } | null =
    null;
  for (const row of chart) {
    if (sizes.length > 0 && !sizes.includes(row.size)) continue;
    const regions = regionFits(body, row, chart, kind, toleranceCm);
    if (regions.length === 0) continue;

    let sum = 0;
    let weights = 0;
    let tightExcess = 0;
    for (const r of regions) {
      const half = (r.idealMaxCm - r.idealMinCm) / 2;
      const target = r.isLength ? 0 : preferenceTarget(preference, half, toleranceCm);
      const w = r.isLength ? LENGTH_WEIGHT : 1;
      sum += (w * Math.abs(r.diffCm - target)) / Math.max(half, 1);
      weights += w;
      if (!r.isLength && r.fit === "MUITO_JUSTO") tightExcess += r.diffCm - (half + toleranceCm);
    }
    const tooTight = tightExcess > 0;
    const score = sum / weights + (tooTight ? TOO_TIGHT_PENALTY + tightExcess : 0);
    if (!best || score < best.score) best = { size: row.size, regions, score, tooTight };
  }
  return best && { size: best.size, regions: best.regions, tooTight: best.tooTight };
}
