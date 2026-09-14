/**
 * Encaixe da peça 3D sobre o avatar.
 *
 * Traduz "tamanho P/M/G/GG + preferência de caimento" em escala por eixo:
 * - Y (comprimento) vem do corpo — ombro até abaixo do quadril — para a barra
 *   cair sempre no lugar certo, com um acréscimo modesto nos tamanhos maiores.
 * - X/Z (largura) vêm da tabela de medidas do produto: circunferência de peito
 *   do tamanho + folga da preferência. X e Z andam juntos para não achatar a
 *   seção da peça.
 *
 * A largura natural da malha precisa ser medida no torso, não pela bounding box
 * inteira: peça modelada em A-pose tem manga aberta, e a bbox nesse caso mede
 * envergadura, não peito.
 */

import type { AvatarParams } from "./avatar-builder";
import type { FitPreference } from "./fit-calculator";

export type GarmentSizeRow = {
  chestMinCm: number | null;
  chestMaxCm: number | null;
};

export type GarmentFitInput = {
  params: AvatarParams;
  /** Altura da malha em unidades do próprio modelo. */
  naturalHeight: number;
  /** Largura de torso da malha (mediana das fatias centrais). */
  naturalTorsoWidth: number;
  sizeRow: GarmentSizeRow | null;
  preference: FitPreference;
};

export type GarmentFit = {
  /** Escala por eixo — X e Z iguais. */
  scale: [number, number, number];
  /** Altura (m) onde o topo da peça encosta. */
  topY: number;
};

/** Folga de circunferência somada à medida do corpo, em cm. */
const EASE_CM: Record<FitPreference, number> = {
  SLIM: 4,
  REGULAR: 9,
  OVERSIZED: 16,
};

/** Mesmo fator das âncoras de peito/cintura/quadril em avatar-builder. */
const ELLIPSE_FACTOR = 1.1;

/** Peito do corpo de referência (REF.chestCm em avatar-builder). */
const REF_CHEST_CM = 96;

/** Quanto a barra desce abaixo do quadril, em fração da altura total. */
const HEM_DROP = 0.08;

/** Gola sobe um pouco acima da linha do ombro. */
const COLLAR_RISE = 0.02;

/** Folga aplicada sobre a âncora de peito quando não há tabela de medidas. */
const FALLBACK_EASE = 1.12;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function halfWidthFromCircumference(cm: number) {
  return cm / 100 / Math.PI / 2;
}

function midpoint(min: number | null, max: number | null): number | null {
  if (min == null || max == null) return null;
  const mid = (min + max) / 2;
  return mid > 0 ? mid : null;
}

export function buildGarmentFit({
  params,
  naturalHeight,
  naturalTorsoWidth,
  sizeRow,
  preference,
}: GarmentFitInput): GarmentFit {
  const { anchors, totalHeight } = params;

  const hemY = anchors.hip.y - totalHeight * HEM_DROP;
  const targetLength = Math.max(anchors.shoulder.y - hemY, 0.01);

  const bodyChestCm = sizeRow
    ? midpoint(sizeRow.chestMinCm, sizeRow.chestMaxCm)
    : null;
  const garmentChestCm =
    bodyChestCm != null ? bodyChestCm + EASE_CM[preference] : null;

  const targetHalfWidth =
    garmentChestCm != null
      ? halfWidthFromCircumference(garmentChestCm) * ELLIPSE_FACTOR
      : anchors.chest.halfWidth * FALLBACK_EASE;

  // Tamanho maior também alonga a peça, não só alarga.
  const lengthFactor =
    garmentChestCm != null
      ? clamp(1 + ((garmentChestCm - REF_CHEST_CM) / REF_CHEST_CM) * 0.35, 0.92, 1.12)
      : 1;

  const scaleY =
    naturalHeight > 0 ? (targetLength / naturalHeight) * lengthFactor : 1;
  const scaleX =
    naturalTorsoWidth > 0 ? (targetHalfWidth * 2) / naturalTorsoWidth : 1;

  return {
    scale: [scaleX, scaleY, scaleX],
    topY: anchors.shoulder.y + totalHeight * COLLAR_RISE,
  };
}
