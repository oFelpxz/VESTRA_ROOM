"use client";

import { buildAvatarParams } from "@/lib/avatar-builder";
import type { BrandLookOutfit } from "@/lib/brand-looks";
import type { CameraView } from "./tryon-scene";
import { TryOnScene } from "./tryon-scene";

// Mesmo corpo do manequim da página do produto (medidas de referência): não
// lê nada do cliente, funciona sem login.
const REFERENCE = buildAvatarParams({
  heightCm: null,
  weightKg: null,
  chestCm: null,
  waistCm: null,
  hipCm: null,
  shoulderCm: null,
  armLengthCm: null,
  legLengthCm: null,
});

/** Look pronto da marca vestido no manequim de loja (peças no molde, M). */
export default function LookMannequin({
  outfit,
  view = null,
  autoRotate = false,
}: {
  outfit: BrandLookOutfit;
  view?: { name: CameraView; n: number } | null;
  autoRotate?: boolean;
}) {
  return (
    <TryOnScene
      avatarParams={REFERENCE}
      top={outfit.top}
      bottom={outfit.bottom}
      accessory={outfit.accessory}
      primary={outfit.top ? "top" : "bottom"}
      view={view}
      autoRotate={autoRotate}
      mannequin
    />
  );
}
