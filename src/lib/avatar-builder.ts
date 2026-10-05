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

/** Corpo do avatar: o neutro (unissex) ou o masculino/feminino do MakeHuman. */
export type AvatarBody = "neutral" | "male" | "female";

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
   * de referência (1,70 m / 70 kg). Peito, cintura e quadril são calibrados
   * em cm e vão até +2 (ver `AVATAR_CALIBRATION`). O componente <Avatar /> aplica esses
   * valores em `mesh.morphTargetInfluences`, casando pelo nome da shape key.
   * `height` é só uma estimativa: quem desenha o corpo resolve o peso da
   * altura para bater `totalHeight` (ver `shapeBody` em garment-dress.ts).
   * `male` / `female` valem 0 ou 1: o corpo escolhido (ver `AvatarBody`).
   * Nomes esperados no GLB (aceita variações: `arm_length`, `armLength`, `arm`):
   * height · weight · chest · waist · hip · shoulder · armLength · legLength ·
   * male · female
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
    male: number;
    female: number;
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

/**
 * Calibração do `public/models/avatar_base.glb`: medidas do corpo base e
 * quanto cada shape key em +1 muda cada medida, em cm. Gerar o avatar de novo
 * exige atualizar estes números (ver scripts/molde/README.md).
 */
const AVATAR_CALIBRATION = {
  // circunferências: scripts/molde/avatar_medidas.py (fita métrica virtual,
  // antes de abaixar os braços, sempre na mesma faixa de pele)
  base: { chest: 90.1, waist: 69.5, hip: 85.7 },
  gain: {
    height: { chest: 25.8, waist: 20.0, hip: 24.9 },
    weight: { chest: 3.1, waist: 7.0, hip: 5.6 },
    chest: { chest: 29.9, waist: 1.0, hip: 0 },
    waist: { chest: 1.0, waist: 29.9, hip: 5.0 },
    hip: { chest: 0, waist: 3.3, hip: 30.0 },
    male: { chest: 6.7, waist: 5.5, hip: 0.5 },
    female: { chest: -5.9, waist: -4.2, hip: 0.2 },
  },
  // comprimentos: scripts/molde/avatar_comprimentos.py (avatar já posado)
  lengths: {
    base: { height: 165.9, inseam: 77.1, arm: 53.5, shoulder: 45.4 },
    gain: {
      height: { height: 70.8, inseam: 41.3, arm: 25.0, shoulder: 13.1 },
      legLength: { height: 18.5, inseam: 18.5 },
      armLength: { arm: 13.4 },
      shoulder: { shoulder: 1.9 },
      weight: { shoulder: 0.5 },
      male: { height: 7.0, inseam: 5.1, arm: 4.3, shoulder: 2.2 },
      female: { height: -6.8, inseam: -5.0, arm: -4.4, shoulder: -2.1 },
    },
  },
} as const;

/**
 * Pesos de altura, perna, braço e ombro que dão ao avatar essas medidas em
 * cm (null = medida não informada: o comprimento acompanha a altura).
 * Perna mexe na altura também, então altura e entrepernas são resolvidas
 * juntas (sistema 2×2). O corpo masculino/feminino já muda os comprimentos:
 * isso é descontado antes.
 */
function lengthMorphs(
  heightCm: number,
  inseamCm: number | null,
  armCm: number | null,
  shoulderCm: number | null,
  weightMorph: number,
  body: AvatarBody,
) {
  const { base, gain } = AVATAR_CALIBRATION.lengths;
  const g = body === "neutral" ? { height: 0, inseam: 0, arm: 0, shoulder: 0 } : gain[body];
  const a = gain.height.height;
  const b = gain.legLength.height;
  const c = gain.height.inseam;
  const d = gain.legLength.inseam;
  const dH = heightCm - base.height - g.height;
  const legLength = inseamCm
    ? clamp((a * (inseamCm - base.inseam - g.inseam) - c * dH) / (a * d - b * c), -1, 1)
    : 0;
  const height = clamp((dH - b * legLength) / a, -1, 1);
  const armLength = armCm
    ? clamp(
        (armCm - base.arm - g.arm - height * gain.height.arm) / gain.armLength.arm,
        -1,
        1,
      )
    : 0;
  // a shape key de ombro muda pouco (1,9 cm): até 2 ainda fica natural
  const shoulder = shoulderCm
    ? clamp(
        (shoulderCm -
          base.shoulder -
          g.shoulder -
          height * gain.height.shoulder -
          weightMorph * gain.weight.shoulder) /
          gain.shoulder.shoulder,
        -2,
        2,
      )
    : 0;
  return { height, legLength, armLength, shoulder };
}

type Girth = "chest" | "waist" | "hip";
const GIRTHS: Girth[] = ["chest", "waist", "hip"];

/**
 * Pesos de peito/cintura/quadril que fazem o avatar ter exatamente essas
 * circunferências (cm), já descontando o que a altura, o peso corporal e o
 * corpo masculino/feminino acrescentam. Sistema linear 3×3, resolvido por
 * Cramer.
 */
function girthMorphs(
  target: Record<Girth, number>,
  weightMorph: number,
  heightMorph: number,
  body: AvatarBody,
): Record<Girth, number> {
  const { base, gain } = AVATAR_CALIBRATION;
  const rhs = GIRTHS.map(
    (m) =>
      target[m] -
      base[m] -
      heightMorph * gain.height[m] -
      weightMorph * gain.weight[m] -
      (body === "neutral" ? 0 : gain[body][m]),
  );
  // linha = medida, coluna = shape key
  const A = GIRTHS.map((m) => GIRTHS.map((k) => gain[k][m]));
  const det = (M: number[][]) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const d = det(A);
  const solve = (col: number) =>
    det(A.map((row, i) => row.map((v, j) => (j === col ? rhs[i] : v)))) / d;
  // As faixas funcionam nos dois sentidos; acima de 2 a forma já exagera.
  return {
    chest: clamp(solve(0), -1, 2),
    waist: clamp(solve(1), -1, 2),
    hip: clamp(solve(2), -1, 2),
  };
}

/**
 * Medidas (cm) que o avatar terá com esses pesos, pela mesma calibração usada
 * para calculá-los. Serve para conferir o avatar: dentro da faixa das shape
 * keys deve bater com o pedido; fora dela, o peso é limitado e a medida para
 * no máximo que o corpo consegue representar. A altura real é acertada pela
 * malha em `shapeBody`; aqui é a estimativa da calibração.
 */
export function predictAvatarMeasurements(
  morphs: AvatarParams["morphs"],
): Record<Girth | "height" | "inseam" | "arm" | "shoulder", number> {
  const { base, gain, lengths } = AVATAR_CALIBRATION;
  const girth = (m: Girth) =>
    base[m] +
    morphs.height * gain.height[m] +
    morphs.weight * gain.weight[m] +
    morphs.chest * gain.chest[m] +
    morphs.waist * gain.waist[m] +
    morphs.hip * gain.hip[m] +
    morphs.male * gain.male[m] +
    morphs.female * gain.female[m];
  const lg = lengths.gain;
  const sex = (k: "height" | "inseam" | "arm" | "shoulder") =>
    morphs.male * lg.male[k] + morphs.female * lg.female[k];
  return {
    chest: girth("chest"),
    waist: girth("waist"),
    hip: girth("hip"),
    height:
      lengths.base.height +
      morphs.height * lg.height.height +
      morphs.legLength * lg.legLength.height +
      sex("height"),
    inseam:
      lengths.base.inseam +
      morphs.height * lg.height.inseam +
      morphs.legLength * lg.legLength.inseam +
      sex("inseam"),
    arm:
      lengths.base.arm +
      morphs.height * lg.height.arm +
      morphs.armLength * lg.armLength.arm +
      sex("arm"),
    shoulder:
      lengths.base.shoulder +
      morphs.height * lg.height.shoulder +
      morphs.shoulder * lg.shoulder.shoulder +
      morphs.weight * lg.weight.shoulder +
      sex("shoulder"),
  };
}

function safe(value: number | null, fallback: number) {
  return value && value > 0 ? value : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function buildAvatarParams(
  m: MeasurementInput,
  body: AvatarBody = "neutral",
): AvatarParams {
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
  const weightMorph = dev(weight, REF.weightKg, 35);
  // comprimentos e circunferências em cm de verdade (ver AVATAR_CALIBRATION)
  const lengthsMorphs = lengthMorphs(
    height,
    m.legLengthCm || null,
    m.armLengthCm || null,
    m.shoulderCm || null,
    weightMorph,
    body,
  );
  const morphs = {
    ...lengthsMorphs,
    weight: weightMorph,
    ...girthMorphs({ chest, waist, hip }, weightMorph, lengthsMorphs.height, body),
    male: body === "male" ? 1 : 0,
    female: body === "female" ? 1 : 0,
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
