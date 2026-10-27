"use client";

import { Jost, Permanent_Marker } from "next/font/google";
import { drawLogo, logoAspect, logoInks, type LogoKind } from "@/lib/brand-logo";

// Fontes do logo A1, servidas pelo próprio site (o next/font baixa no build).
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "block" });
const jost = Jost({ weight: "400", subsets: ["latin"], display: "block" });

const FONTS = { script: marker.style.fontFamily, label: jost.style.fontFamily };

let ready: Promise<unknown> | null = null;

/** Espera as fontes do logo: o canvas não espera sozinho e sairia em Arial. */
export function loadBrandFonts() {
  ready ??= Promise.all([
    document.fonts.load(`44px ${FONTS.script}`, "Vestra"),
    document.fonts.load(`10px ${FONTS.label}`, "ROOM"),
  ]);
  return ready;
}

/**
 * Logo A1 num canvas transparente de `width` px, nas cores para o tecido
 * `baseHex` (`logoInks`). Chamar depois de `loadBrandFonts()`.
 */
export function logoCanvas(kind: LogoKind, baseHex: string, width = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width / logoAspect(kind));
  drawLogo(canvas.getContext("2d")!, kind, width, logoInks(baseHex), FONTS);
  return canvas;
}
