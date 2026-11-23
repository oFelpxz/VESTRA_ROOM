import { BRAND_LIME } from "@/lib/brand-logo";
import { colorToHex } from "@/lib/color-names";
import { LOOK_INFO, lookOf, type GarmentLook } from "@/lib/garment-prints";

/**
 * Bolinha da cor da variante. As versões levam o detalhe lima: risquinho
 * embaixo = Street (logo), faixa na diagonal = Sport (faixa nas mangas).
 */
export function ColorSwatch({ name }: { name: string }) {
  const look = lookOf(name);
  const hex = colorToHex(name);
  const background =
    look === "sport" ? `linear-gradient(135deg, ${hex} 0 38%, ${BRAND_LIME} 38% 62%, ${hex} 62%)` : hex;
  return (
    <span
      aria-hidden
      className="relative inline-block size-3.5 shrink-0 overflow-hidden rounded-full border border-current/30"
      style={{ background }}
    >
      {look === "street" && (
        <span
          className="absolute inset-x-[3px] bottom-[2px] h-[2px] rounded-full"
          style={{ background: BRAND_LIME }}
        />
      )}
    </span>
  );
}

/** Nome da cor com a bolinha, para os botões de cor. */
export function ColorLabel({ name }: { name: string }) {
  const look = lookOf(name);
  return (
    <span className="inline-flex items-center gap-1.5" title={look ? LOOK_INFO[look] : undefined}>
      <ColorSwatch name={name} />
      {name}
    </span>
  );
}

/** Explica as versões que aparecem entre as cores (nada se não houver). */
export function LookLegend({ colors }: { colors: string[] }) {
  const looks = [...new Set(colors.map(lookOf))].filter((l): l is GarmentLook => l != null);
  if (looks.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
      {looks.map((l) => (
        <li key={l}>{LOOK_INFO[l]}</li>
      ))}
    </ul>
  );
}
