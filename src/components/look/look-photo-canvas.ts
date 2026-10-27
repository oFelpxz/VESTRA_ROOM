"use client";

import { FONTS, loadBrandFonts, logoCanvas } from "@/components/viewer-3d/brand-logo-canvas";
import { coverCrop, lookPhotoLayout, lookPhotoLines, type Rect } from "@/lib/look-photo";

const INK = "#111111";
const PAPER = "#f2f0ec";
const STAGE = "#e7e2da";

/**
 * Desenha a foto do look (`lookPhotoLayout`): faixa escura com o logo A1,
 * frente e costas, e a lista de peças com a soma. Devolve PNG em data URL.
 */
export async function composeLookPhoto(
  shots: { front: HTMLCanvasElement; back: HTMLCanvasElement },
  pieces: { label: string; price: number }[],
): Promise<string> {
  await loadBrandFonts();
  const lines = lookPhotoLines(pieces);
  const l = lookPhotoLayout(lines.length);
  const canvas = document.createElement("canvas");
  canvas.width = l.width;
  canvas.height = l.height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, l.width, l.height);
  ctx.fillStyle = INK;
  ctx.fillRect(l.header.x, l.header.y, l.header.w, l.header.h);
  // Tinta do logo para fundo escuro: palavra e risco lima, ROOM branco.
  ctx.drawImage(logoCanvas("costas", INK, Math.round(l.logo.w * 2)), l.logo.x, l.logo.y, l.logo.w, l.logo.h);

  const panel = (shot: HTMLCanvasElement, r: Rect, label: string) => {
    ctx.fillStyle = STAGE;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const c = coverCrop(shot.width, shot.height, r);
    ctx.drawImage(shot, c.x, c.y, c.w, c.h, r.x, r.y, r.w, r.h);
    ctx.fillStyle = INK;
    ctx.font = `600 22px ${FONTS.label}`;
    ctx.textAlign = "left";
    ctx.fillText(label, r.x + 24, r.y + 44);
  };
  panel(shots.front, l.front, "FRENTE");
  panel(shots.back, l.back, "COSTAS");

  const left = l.pad;
  const right = l.width - l.pad;
  lines.forEach((line, i) => {
    const y = l.lines[i];
    if (line.strong) {
      ctx.fillStyle = INK;
      ctx.fillRect(left, y - 34, right - left, 1.5);
    }
    ctx.fillStyle = INK;
    ctx.font = `${line.strong ? 600 : 400} 26px ${FONTS.label}`;
    ctx.textAlign = "left";
    ctx.fillText(line.left, left, y);
    ctx.textAlign = "right";
    ctx.fillText(line.right, right, y);
  });

  return canvas.toDataURL("image/png");
}
