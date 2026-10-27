/**
 * Logo A1 da VESTRA ("Marcador", escolhido em 26/10/2026): "Vestra" escrito
 * com caneta grossa (fonte Permanent Marker), um risco curvo embaixo e, na
 * versão das costas, "ROOM" pequeno e espaçado.
 *
 * Aqui só o desenho, em qualquer canvas 2D; as fontes vêm de quem chama
 * (`brand-logo-canvas.ts` carrega as do Google pelo next/font).
 */

/** Verde lima, a cor assinatura da marca. */
export const BRAND_LIME = "#C6FF00";

/** "peito" = logo pequeno da frente; "costas" = estampa grande, com ROOM. */
export type LogoKind = "peito" | "costas";

/** Caixa do desenho em unidades do esboço aprovado (200 de largura). */
const DESIGN_WIDTH = 200;
const DESIGN_HEIGHT: Record<LogoKind, number> = { peito: 88, costas: 112 };

/** Largura / altura do logo (para a imagem e para o tamanho na roupa). */
export function logoAspect(kind: LogoKind) {
  return DESIGN_WIDTH / DESIGN_HEIGHT[kind];
}

export type LogoInks = { word: string; line: string; room: string };

/**
 * Cores do logo sobre o tecido: em peça escura, palavra e risco em lima e ROOM
 * branco (como no esboço); em peça clara o lima some, então a palavra fica
 * quase preta e só o risco continua lima.
 */
export function logoInks(baseHex: string): LogoInks {
  const n = parseInt(baseHex.replace("#", ""), 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.55
    ? { word: BRAND_LIME, line: BRAND_LIME, room: "#FFFFFF" }
    : { word: "#111111", line: BRAND_LIME, room: "#111111" };
}

type LogoCtx = Pick<
  CanvasRenderingContext2D,
  | "font"
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineCap"
  | "textAlign"
  | "textBaseline"
  | "setTransform"
  | "clearRect"
  | "fillText"
  | "measureText"
  | "beginPath"
  | "moveTo"
  | "quadraticCurveTo"
  | "stroke"
>;

/**
 * Desenha o logo ocupando `width` px de largura (a altura é
 * `width / logoAspect(kind)`), com fundo transparente.
 */
export function drawLogo(
  ctx: LogoCtx,
  kind: LogoKind,
  width: number,
  inks: LogoInks,
  fonts: { script: string; label: string },
) {
  const s = width / DESIGN_WIDTH;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT[kind]);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = inks.word;
  ctx.font = `44px ${fonts.script}`;
  ctx.fillText("Vestra", 100, 62);

  ctx.strokeStyle = inks.line;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(38, 80);
  ctx.quadraticCurveTo(100, 68, 166, 76);
  ctx.stroke();

  if (kind === "costas") {
    // Letra a letra: o espaçamento do canvas (letterSpacing) não existe em
    // todo navegador.
    ctx.fillStyle = inks.room;
    ctx.font = `10px ${fonts.label}`;
    const spacing = 6;
    const letters = [..."ROOM"];
    const widths = letters.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1);
    let x = 100 - total / 2;
    ctx.textAlign = "left";
    letters.forEach((c, i) => {
      ctx.fillText(c, x, 104);
      x += widths[i] + spacing;
    });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
