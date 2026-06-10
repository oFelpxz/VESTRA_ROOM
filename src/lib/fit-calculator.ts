/**
 * Cálculo de caimento (fit) — cruzando as medidas do usuário com a tabela
 * de medidas do produto.
 *
 * Para cada eixo (peito, cintura, quadril), compara a medida do usuário com
 * o intervalo [min..max] da tabela. A preferência de caimento desloca o
 * "centro ideal" do intervalo para mais justo (SLIM) ou mais folgado (OVERSIZED).
 *
 * Saída:
 *   - label: rótulo geral ("Justo" / "Ideal" / "Folgado" / "Não serve")
 *   - score: distância normalizada (0 = perfeito, 1 = limite)
 *   - details: explicação por eixo
 */

export type FitPreference = "SLIM" | "REGULAR" | "OVERSIZED";

export type FitLabel = "JUSTO" | "IDEAL" | "FOLGADO" | "NAO_SERVE";

export type FitAxis = "chest" | "waist" | "hip";

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
};

type SizeMeasures = {
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
};

const AXIS_LABEL: Record<FitAxis, string> = {
  chest: "Peito",
  waist: "Cintura",
  hip: "Quadril",
};

// Quanto o intervalo "ideal" é deslocado do centro pela preferência.
// Valor em fração [0..1] do range total.
const PREFERENCE_SHIFT: Record<FitPreference, number> = {
  SLIM: -0.25, // ideal puxado pro lado justo (menor)
  REGULAR: 0,
  OVERSIZED: 0.25,
};

// Tolerância antes de considerar "não serve" — em cm absolutos.
const MAX_TOLERANCE_CM = 6;

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

  for (const axis of ["chest", "waist", "hip"] as FitAxis[]) {
    const userValue = user[`${axis}Cm` as const];
    const min = size[`${axis}MinCm` as const];
    const max = size[`${axis}MaxCm` as const];

    if (userValue == null || min == null || max == null) continue;

    const range = max - min;
    if (range <= 0) continue;

    // Ideal shift: REGULAR = meio do intervalo
    const idealCenter = (min + max) / 2 + range * PREFERENCE_SHIFT[preference];

    let status: FitDetail["status"];
    let deltaCm: number;

    if (userValue < min) {
      status = "below"; // usuário menor → roupa fica folgada nessa medida
      deltaCm = min - userValue;
      totalBelow += deltaCm;
    } else if (userValue > max) {
      status = "above"; // usuário maior → roupa fica justa
      deltaCm = userValue - max;
      totalAbove += deltaCm;
    } else {
      status = "ok";
      deltaCm = 0;
    }

    if (status !== "ok") anyOutOfRange = true;

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
    return {
      label: "IDEAL",
      score: 0,
      details: [],
    };
  }

  const avgScore = totalScore / axesCounted;

  // Não serve se qualquer eixo extrapola muito
  const worstDelta = Math.max(totalAbove, totalBelow);
  if (worstDelta > MAX_TOLERANCE_CM) {
    return { label: "NAO_SERVE", score: avgScore, details };
  }

  // Heurística do label final baseada na predominância
  let label: FitLabel;
  if (!anyOutOfRange) {
    label = "IDEAL";
  } else if (totalAbove > totalBelow) {
    // usuário maior que o range → fica JUSTO
    label = "JUSTO";
  } else {
    // usuário menor que o range → fica FOLGADO
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
      return {
        bg: "bg-acid/30",
        text: "text-foreground",
        dot: "bg-acid",
      };
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
