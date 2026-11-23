"use client";

import { Jost, Permanent_Marker } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { BRAND_LIME, drawLogo, logoAspect, logoInks, type LogoKind } from "@/lib/brand-logo";
import type { PrintDecal } from "@/lib/fabric";
import { printSpots, stripeSpot, type GarmentLook } from "@/lib/garment-prints";

// Fontes do logo A1, servidas pelo próprio site (o next/font baixa no build).
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "block" });
const jost = Jost({ weight: "400", subsets: ["latin"], display: "block" });

export const FONTS = { script: marker.style.fontFamily, label: jost.style.fontFamily };

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

const textures = new Map<string, THREE.CanvasTexture>();

/**
 * Logo como textura para estampa (`PrintDecal`), uma por versão e cor de
 * tinta, dividida entre as peças. Chamar depois de `loadBrandFonts()`.
 */
export function logoTexture(kind: LogoKind, baseHex: string) {
  const inks = logoInks(baseHex);
  const key = `${kind}-${inks.word}`;
  let t = textures.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(logoCanvas(kind, baseHex));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    textures.set(key, t);
  }
  return t;
}

/** Fontes do logo prontas? Até lá a peça aparece sem estampa. */
export function useBrandFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadBrandFonts().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/**
 * Estampas da peça na versão `look` (`printSpots`), com a tinta do logo
 * escolhida pela cor `hex`, e a faixa lima das mangas (`stripeSpot`). Vazio
 * até as fontes chegarem ou sem cor.
 */
export function useGarmentPrints(
  modelUrl: string,
  look: GarmentLook | null | undefined,
  hex: string | undefined,
): PrintDecal[] {
  const fonts = useBrandFontsReady();
  return useMemo(() => {
    if (!fonts || !hex) return [];
    const prints: PrintDecal[] = printSpots(modelUrl, look ?? null).map((s) => ({
      image: logoTexture(s.kind, hex),
      center: s.center,
      size: [s.width, s.width / logoAspect(s.kind)],
      side: s.side,
    }));
    const stripe = stripeSpot(modelUrl, look ?? null);
    if (stripe) prints.push({ color: BRAND_LIME, ...stripe });
    return prints;
  }, [fonts, modelUrl, look, hex]);
}
