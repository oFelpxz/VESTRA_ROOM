"use client";

/**
 * Pele do avatar (provador e prévia).
 *
 * Antes era um "manequim de gesso" (fosco e cinza). Agora: tom mais quente,
 * um pouco de brilho (pele tem oleosidade, aspereza ~0,5) e um sheen
 * avermelhado nas bordas contra a luz — imita a luz que entra na pele e volta
 * avermelhada (subsurface) sem o custo de um shader de verdade.
 */

export const SKIN_COLOR = "#d9bba4";

export function SkinMaterial({ color = SKIN_COLOR }: { color?: string }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.5}
      specularIntensity={0.35}
      sheen={0.45}
      sheenRoughness={0.55}
      sheenColor="#e58f73"
    />
  );
}
