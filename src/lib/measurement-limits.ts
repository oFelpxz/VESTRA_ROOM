/**
 * Faixas aceitas no perfil de medidas (3D-05). São largas de propósito: só
 * barram erro de digitação (ex.: altura em metros ou em milímetros), nunca um
 * corpo real. O avatar acerta as medidas na maior parte da faixa; perto dos
 * extremos ele chega ao máximo do que consegue representar e para ali (ver
 * docs/SPRINT4-3D05.md).
 */

export type MeasurementField =
  | "heightCm"
  | "weightKg"
  | "chestCm"
  | "waistCm"
  | "hipCm"
  | "shoulderCm"
  | "armLengthCm"
  | "legLengthCm";

export const MEASUREMENT_LIMITS: Record<
  MeasurementField,
  { label: string; min: number; max: number; unit: "cm" | "kg" }
> = {
  heightCm: { label: "Altura", min: 100, max: 230, unit: "cm" },
  weightKg: { label: "Peso", min: 25, max: 250, unit: "kg" },
  chestCm: { label: "Tórax / Busto", min: 50, max: 180, unit: "cm" },
  waistCm: { label: "Cintura", min: 40, max: 180, unit: "cm" },
  hipCm: { label: "Quadril", min: 50, max: 180, unit: "cm" },
  shoulderCm: { label: "Ombros", min: 25, max: 70, unit: "cm" },
  armLengthCm: { label: "Braço", min: 30, max: 100, unit: "cm" },
  legLengthCm: { label: "Perna", min: 40, max: 120, unit: "cm" },
};

/**
 * Primeira medida fora da faixa, como mensagem para o cliente; `null` se
 * todas estão ok. Medida vazia (null) é permitida: o avatar usa a referência.
 * Texto que não é número chega como NaN e também é recusado.
 */
export function measurementError(
  data: Record<MeasurementField, number | null>,
): string | null {
  for (const [field, lim] of Object.entries(MEASUREMENT_LIMITS)) {
    const v = data[field as MeasurementField];
    if (v === null) continue;
    if (!Number.isFinite(v) || v < lim.min || v > lim.max) {
      return `${lim.label}: informe um valor entre ${lim.min} e ${lim.max} ${lim.unit}.`;
    }
  }
  return null;
}
