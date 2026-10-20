/**
 * Looks salvos (item 15): uma peça de cima + uma de baixo, sem camadas
 * (decisão do grupo em 05/10). Regras puras, sem banco.
 */

import type { GarmentKind } from "./fit-regions";

export const LOOK_NAME_LIMIT = 60;
/** Looks por cliente: evita a lista crescer sem fim. */
export const MAX_LOOKS = 50;

export function parseLookName(raw: unknown): { name: string } | { error: string } {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Dê um nome ao look." };
  if (name.length > LOOK_NAME_LIMIT) {
    return { error: `Nome do look: até ${LOOK_NAME_LIMIT} caracteres.` };
  }
  return { name };
}

/** Peça que completa o look: quem está de cima procura uma de baixo, e vice-versa. */
export function companionKind(kind: GarmentKind): "top" | "bottom" | null {
  if (kind === "top") return "bottom";
  if (kind === "bottom") return "top";
  return null;
}

/**
 * Qual das duas peças vai em cima e qual embaixo. Null se não forem uma de
 * cima e uma de baixo.
 */
export function lookRoles<T>(
  a: { kind: GarmentKind; value: T },
  b: { kind: GarmentKind; value: T },
): { top: T; bottom: T } | null {
  if (a.kind === "top" && b.kind === "bottom") return { top: a.value, bottom: b.value };
  if (a.kind === "bottom" && b.kind === "top") return { top: b.value, bottom: a.value };
  return null;
}

/** Foto do look: só JPEG em data URL e pequena (a do provador tem ~30 kB). */
export const LOOK_PHOTO_MAX_CHARS = 200_000;
const LOOK_PHOTO_PREFIX = "data:image/jpeg;base64,";

/** A foto enviada pelo provador, ou null se vier vazia ou fora do formato. */
export function parseLookPhoto(raw: unknown): string | null {
  const photo = typeof raw === "string" ? raw : "";
  if (!photo.startsWith(LOOK_PHOTO_PREFIX) || photo.length > LOOK_PHOTO_MAX_CHARS) return null;
  return /^[A-Za-z0-9+/]+=*$/.test(photo.slice(LOOK_PHOTO_PREFIX.length)) ? photo : null;
}
