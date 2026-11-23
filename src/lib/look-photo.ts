/**
 * Foto do look (lista 10, item 9): uma imagem só com o avatar de frente e de
 * costas lado a lado, o logo A1 numa faixa escura em cima e a lista das peças
 * embaixo (nome, cor e tamanho, preço e a soma). Aqui só as medidas e os
 * textos; o desenho é do `look-photo-canvas.ts`.
 */

import { brandLookTotal } from "./brand-looks";
import { formatBRL } from "./format";

export type Rect = { x: number; y: number; w: number; h: number };

export type LookPhotoLayout = {
  width: number;
  height: number;
  header: Rect;
  logo: Rect;
  front: Rect;
  back: Rect;
  /** Linha de base de cada linha da lista (peças e, no fim, o total). */
  lines: number[];
  pad: number;
};

/** Cada lado em retrato 3:4; a lista cresce com o número de linhas. */
const PANEL_W = 720;
const PANEL_H = 960;
const PAD = 40;
const HEADER_H = 176;
const LINE_H = 48;
/** Proporção do logo das costas (com ROOM): 200 x 112. */
const LOGO_ASPECT = 200 / 112;

export function lookPhotoLayout(lineCount: number): LookPhotoLayout {
  const width = PAD * 3 + PANEL_W * 2;
  const logoH = HEADER_H - 40;
  const logoW = logoH * LOGO_ASPECT;
  const header = { x: 0, y: 0, w: width, h: HEADER_H };
  const top = HEADER_H + PAD;
  const front = { x: PAD, y: top, w: PANEL_W, h: PANEL_H };
  const back = { x: PAD * 2 + PANEL_W, y: top, w: PANEL_W, h: PANEL_H };
  const listTop = top + PANEL_H + PAD;
  const lines = Array.from({ length: lineCount }, (_, i) => listTop + LINE_H * (i + 1) - 14);
  return {
    width,
    height: listTop + LINE_H * lineCount + PAD,
    header,
    logo: { x: (width - logoW) / 2, y: (HEADER_H - logoH) / 2, w: logoW, h: logoH },
    front,
    back,
    lines,
    pad: PAD,
  };
}

/**
 * Recorte do meio da cena que cabe no lado `panel` sem distorcer (como
 * `object-fit: cover`), para uma cena de `w` x `h`.
 */
export function coverCrop(w: number, h: number, panel: { w: number; h: number }): Rect {
  const scale = Math.max(panel.w / w, panel.h / h);
  const cw = panel.w / scale;
  const ch = panel.h / scale;
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

export type LookPhotoLine = { left: string; right: string; strong?: boolean };

/** Linhas da lista: uma por peça e, com mais de uma, a soma (sem desconto). */
export function lookPhotoLines(pieces: { label: string; price: number }[]): LookPhotoLine[] {
  const lines: LookPhotoLine[] = pieces.map((p) => ({ left: p.label, right: formatBRL(p.price) }));
  if (pieces.length > 1)
    lines.push({
      left: `Look completo · ${pieces.length} peças`,
      right: formatBRL(brandLookTotal(pieces.map((p) => p.price))),
      strong: true,
    });
  return lines;
}
