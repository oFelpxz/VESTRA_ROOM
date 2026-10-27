"use client";

import { createContext, useContext } from "react";
import { skinTone, type SkinTone } from "@/lib/skin-tones";

/**
 * Pele do avatar (provador e prévia).
 *
 * Antes era um "manequim de gesso" (fosco e cinza). Agora: tom mais quente,
 * um pouco de brilho (pele tem oleosidade, aspereza ~0,5) e um sheen
 * avermelhado nas bordas contra a luz — imita a luz que entra na pele e volta
 * avermelhada (subsurface) sem o custo de um shader de verdade. A cor e o
 * brilho vêm do tom de pele escolhido (`SkinToneContext`).
 */

/** Tom de pele de quem prova (lista 11); fora do provador, o padrão. */
export const SkinToneContext = createContext<SkinTone>(skinTone(null));

/**
 * Manequim da página do produto: o mesmo corpo, com acabamento de manequim de
 * loja (fibra de vidro cinza, verniz leve) — com pele, sem roupa embaixo,
 * parecia uma pessoa pelada.
 */
export const MannequinFinish = createContext(false);

export function SkinMaterial({ color }: { color?: string }) {
  const mannequin = useContext(MannequinFinish);
  const tone = useContext(SkinToneContext);
  if (mannequin) {
    return (
      <meshPhysicalMaterial
        color="#9d9994"
        roughness={0.42}
        clearcoat={0.35}
        clearcoatRoughness={0.3}
      />
    );
  }
  return (
    <meshPhysicalMaterial
      color={color ?? tone.color}
      roughness={0.5}
      specularIntensity={0.35}
      sheen={0.45}
      sheenRoughness={0.55}
      sheenColor={tone.sheen}
    />
  );
}
