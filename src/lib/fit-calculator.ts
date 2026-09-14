/**
 * Cálculo de caimento (fit) — cruzando as medidas do usuário com a tabela
 * de medidas do produto.
 *
 * Para cada eixo (peito, cintura, quadril, braço, perna), compara a medida
 * do usuário com o intervalo [min..max] da tabela. A preferência de caimento
 * desloca o "centro ideal" do intervalo para mais justo (SLIM) ou mais folgado
 * (OVERSIZED).
 *
 * Eixos de comprimento (braço/perna) têm tolerância maior porque o impacto
 * visual de 2 cm a mais/menos numa manga é menor que numa cintura.
 */

export type FitPreference = "SLIM" | "REGULAR" | "OVERSIZED";

export type FitLabel = "JUSTO" | "IDEAL" | "FOLGADO" | "NAO_SERVE";

export type FitAxis = "chest" | "waist" | "hip" | "armLength" | "legLength";

export type FitDetail = {
  axis: FitAxis;
  axisLabel: string;
  userValue: number;
  rangeMin: number;
  rangeMax: number;
  status: "below" | "ok" | "above";
  deltaCm: number;
};

export type FitResult = {
  label: FitLabel;
  score: number; // 0..1+, quanto menor melhor
  details: FitDetail[];
};

type UserMeasures = {
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armLengthCm: number | null;
  legLengthCm: number | null;
};

type SizeMeasures = {
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

const AXIS_LABEL: Record<FitAxis, string> = {
  chest: "Peito",
  waist: "Cintura",
  hip: "Quadril",
  armLength: "Braço",
  legLength: "Perna",
};

// Quanto o intervalo "ideal" é deslocado do centro pela preferência.
// Valor em fração [0..1] do range total.
// Preferência só afeta eixos de circunferência — braço/perna sempre ideal no centro.
const PREFERENCE_SHIFT: Record<FitPreference, number> = {
  SLIM: -0.25,
  REGULAR: 0,
  OVERSIZED: 0.25,
};

const LENGTH_AXES: ReadonlySet<FitAxis> = new Set(["armLength", "legLength"]);

// Tolerância antes de considerar "não serve" — em cm absolutos.
const MAX_TOLERANCE_GIRTH_CM = 6;
const MAX_TOLERANCE_LENGTH_CM = 8;

const AXES: { axis: FitAxis; userKey: keyof UserMeasures; minKey: keyof SizeMeasures; maxKey: keyof SizeMeasures }[] = [
  { axis: "chest", userKey: "chestCm", minKey: "chestMinCm", maxKey: "chestMaxCm" },
  { axis: "waist", userKey: "waistCm", minKey: "waistMinCm", maxKey: "waistMaxCm" },
  { axis: "hip", userKey: "hipCm", minKey: "hipMinCm", maxKey: "hipMaxCm" },
  { axis: "armLength", userKey: "armLengthCm", minKey: "armLengthMinCm", maxKey: "armLengthMaxCm" },
  { axis: "legLength", userKey: "legLengthCm", minKey: "legLengthMinCm", maxKey: "legLengthMaxCm" },
];

export function calculateFit(
  user: UserMeasures,
  size: SizeMeasures,
  preference: FitPreference = "REGULAR",
): FitResult {
  const details: FitDetail[] = [];
  let totalScore = 0;
  let axesCounted = 0;
  let anyOutOfRange = false;
  let totalAbove = 0;
  let totalBelow = 0;
  let worstLengthDelta = 0;
  let worstGirthDelta = 0;

  for (const { axis, userKey, minKey, maxKey } of AXES) {
    const userValue = user[userKey];
    const min = size[minKey];
    const max = size[maxKey];

    if (userValue == null || min == null || max == null) continue;

    const range = max - min;
    if (range <= 0) continue;

    const isLength = LENGTH_AXES.has(axis);

    // Comprimentos não são afetados pela preferência de caimento
    const idealCenter = isLength
      ? (min + max) / 2
      : (min + max) / 2 + range * PREFERENCE_SHIFT[preference];

    let status: FitDetail["status"];
    let deltaCm: number;

    if (userValue < min) {
      status = "below";
      deltaCm = min - userValue;
      totalBelow += deltaCm;
    } else if (userValue > max) {
      status = "above";
      deltaCm = userValue - max;
      totalAbove += deltaCm;
    } else {
      status = "ok";
      deltaCm = 0;
    }

    if (status !== "ok") {
      anyOutOfRange = true;
      if (isLength) {
        worstLengthDelta = Math.max(worstLengthDelta, deltaCm);
      } else {
        worstGirthDelta = Math.max(worstGirthDelta, deltaCm);
      }
    }

    // Score: distância do ideal normalizada por (range/2)
    const distFromIdeal = Math.abs(userValue - idealCenter);
    const halfRange = range / 2 || 1;
    totalScore += distFromIdeal / halfRange;
    axesCounted += 1;

    details.push({
      axis,
      axisLabel: AXIS_LABEL[axis],
      userValue,
      rangeMin: min,
      rangeMax: max,
      status,
      deltaCm,
    });
  }

  if (axesCounted === 0) {
    return { label: "IDEAL", score: 0, details: [] };
  }

  const avgScore = totalScore / axesCounted;

  // Não serve se algum eixo extrapola muito (tolerância maior para comprimento)
  if (
    worstGirthDelta > MAX_TOLERANCE_GIRTH_CM ||
    worstLengthDelta > MAX_TOLERANCE_LENGTH_CM
  ) {
    return { label: "NAO_SERVE", score: avgScore, details };
  }

  let label: FitLabel;
  if (!anyOutOfRange) {
    label = "IDEAL";
  } else if (totalAbove > totalBelow) {
    label = "JUSTO";
  } else {
    label = "FOLGADO";
  }

  return { label, score: avgScore, details };
}

export function fitLabelText(label: FitLabel): string {
  switch (label) {
    case "JUSTO":
      return "Justo";
    case "IDEAL":
      return "Ideal";
    case "FOLGADO":
      return "Folgado";
    case "NAO_SERVE":
      return "Não serve";
  }
}

export function fitLabelColor(label: FitLabel): {
  bg: string;
  text: string;
  dot: string;
} {
  switch (label) {
    case "IDEAL":
      return { bg: "bg-acid/30", text: "text-foreground", dot: "bg-acid" };
    case "JUSTO":
      return {
        bg: "bg-secondary",
        text: "text-foreground",
        dot: "bg-foreground",
      };
    case "FOLGADO":
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        dot: "bg-muted-foreground",
      };
    case "NAO_SERVE":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
        dot: "bg-destructive",
      };
  }
}
