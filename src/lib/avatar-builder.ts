/**
 * Avatar builder — converte MeasurementProfile em parâmetros visuais
 * que o componente <Avatar /> consome.
 *
 * Este módulo é a "tradução" entre dados crus do usuário e o modelo 3D.
 * Quando trocarmos do avatar primitivo (Opção A) para um GLB com morph
 * targets (Opção B/SMPL), só este arquivo muda: o componente Avatar passa
 * a aplicar os pesos retornados aqui em `morphTargetInfluences`.
 */

export type MeasurementInput = {
  heightCm: number | null;
  weightKg: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  shoulderCm: number | null;
  armLengthCm: number | null;
  legLengthCm: number | null;
};

/**
 * Parâmetros normalizados do corpo. Cada campo é uma escala/fator relativo
 * a um corpo "referência" de altura 1,70m e peso 70kg.
 *
 * Para o avatar primitivo, multiplicamos as geometrias por esses fatores.
 * Para um GLB com morph targets, mapeamos para os pesos correspondentes.
 */
export type AvatarParams = {
  // Escalas gerais
  scaleHeight: number; // ~0.85..1.20 (170 cm = 1.0)
  scaleGirth: number; // largura/profundidade geral, baseada no peso

  // Proporções por região
  scaleChest: number;
  scaleWaist: number;
  scaleHip: number;
  scaleShoulder: number;

  // Comprimentos relativos
  ratioArm: number; // comprimento do braço relativo à altura
  ratioLeg: number; // comprimento da perna relativo à altura

  /**
   * Pesos de morph target para um GLB paramétrico (`avatar_base.glb`).
   * Cada valor vai de -1 (abaixo da referência) a +1 (acima), com 0 = corpo
   * de referência (1,70 m / 70 kg). O componente <Avatar /> aplica esses
   * valores em `mesh.morphTargetInfluences`, casando pelo nome da shape key.
   * Nomes esperados no GLB (aceita variações: `arm_length`, `armLength`, `arm`):
   * height · weight · chest · waist · hip · shoulder · armLength · legLength
   */
  morphs: {
    height: number;
    weight: number;
    chest: number;
    waist: number;
    hip: number;
    shoulder: number;
    armLength: number;
    legLength: number;
  };

  // Ancoragens (em unidades do avatar) — onde a roupa "encaixa"
  // Y vertical, origem no chão.
  anchors: {
    head: { y: number };
    shoulder: { y: number; halfWidth: number };
    chest: { y: number; halfWidth: number };
    waist: { y: number; halfWidth: number };
    hip: { y: number; halfWidth: number };
  };

  // Altura total do avatar em unidades 3D (1 unidade = 1 metro)
  totalHeight: number;
};

const REF = {
  heightCm: 170,
  weightKg: 70,
  chestCm: 96,
  waistCm: 80,
  hipCm: 96,
  shoulderCm: 45,
  armLengthCm: 60,
  legLengthCm: 80,
} as const;

function safe(value: number | null, fallback: number) {
  return value && value > 0 ? value : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function buildAvatarParams(m: MeasurementInput): AvatarParams {
  const height = safe(m.heightCm, REF.heightCm);
  const weight = safe(m.weightKg, REF.weightKg);
  const chest = safe(m.chestCm, REF.chestCm);
  const waist = safe(m.waistCm, REF.waistCm);
  const hip = safe(m.hipCm, REF.hipCm);
  const shoulder = safe(m.shoulderCm, REF.shoulderCm);
  const armLen = safe(m.armLengthCm, REF.armLengthCm);
  const legLen = safe(m.legLengthCm, REF.legLengthCm);

  const scaleHeight = clamp(height / REF.heightCm, 0.82, 1.22);
  // sqrt do peso → largura sentida (volume cresce com cubo)
  const scaleGirth = clamp(Math.sqrt(weight / REF.weightKg), 0.78, 1.35);

  const scaleChest = clamp(chest / REF.chestCm, 0.78, 1.4);
  const scaleWaist = clamp(waist / REF.waistCm, 0.78, 1.5);
  const scaleHip = clamp(hip / REF.hipCm, 0.78, 1.4);
  const scaleShoulder = clamp(shoulder / REF.shoulderCm, 0.85, 1.25);

  const ratioArm = armLen / height;
  const ratioLeg = legLen / height;

  // Morph targets: desvio da referência normalizado para [-1, 1].
  // O "meio-alcance" define quantos cm/kg equivalem a um peso de 1.0.
  const dev = (value: number, ref: number, halfRange: number) =>
    clamp((value - ref) / halfRange, -1, 1);
  const morphs = {
    height: dev(height, REF.heightCm, 25),
    weight: dev(weight, REF.weightKg, 35),
    chest: dev(chest, REF.chestCm, 22),
    waist: dev(waist, REF.waistCm, 28),
    hip: dev(hip, REF.hipCm, 22),
    shoulder: dev(shoulder, REF.shoulderCm, 12),
    armLength: dev(armLen, REF.armLengthCm, 12),
    legLength: dev(legLen, REF.legLengthCm, 15),
  };

  // Avatar total: 1 unidade ≈ 1 metro
  const totalHeight = (height / 100) * 1.0; // metros

  // Distribuição vertical do corpo (proporções clássicas: cabeça ~ 1/8, etc.)
  // Origem em Y = 0 (chão).
  const yHead = totalHeight * 0.93;
  const yShoulder = totalHeight * 0.83;
  const yChest = totalHeight * 0.72;
  const yWaist = totalHeight * 0.58;
  const yHip = totalHeight * 0.48;

  // Larguras (em metros) — base de uma circunferência aproximada
  // Aproximamos como elipse: meia-largura ≈ (circunf / π) / 2 * fator
  const halfWidth = (cmCirc: number) => (cmCirc / 100) / Math.PI / 2;

  return {
    scaleHeight,
    scaleGirth,
    scaleChest,
    scaleWaist,
    scaleHip,
    scaleShoulder,
    ratioArm,
    ratioLeg,
    morphs,
    totalHeight,
    anchors: {
      head: { y: yHead },
      shoulder: {
        y: yShoulder,
        halfWidth: (shoulder / 100) / 2 * 1.05,
      },
      chest: { y: yChest, halfWidth: halfWidth(chest) * 1.1 },
      waist: { y: yWaist, halfWidth: halfWidth(waist) * 1.1 },
      hip: { y: yHip, halfWidth: halfWidth(hip) * 1.1 },
    },
  };
}
