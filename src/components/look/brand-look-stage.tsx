"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useState, type ReactNode } from "react";
import { brandLookOutfit } from "@/lib/brand-looks";
import type { ResolvedBrandLook } from "@/lib/look-data";

const LookMannequin = dynamic(() => import("@/components/viewer-3d/look-mannequin"), {
  ssr: false,
});

/**
 * Look pronto escolhido em "Complete o look" (lista 10, item 5): o 3D da
 * página troca a peça pelo manequim vestido com o look inteiro.
 */
type SelectedLook = [string | null, (slug: string | null) => void];

const BrandLookContext = createContext<SelectedLook | null>(null);

export function BrandLookProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null);
  return <BrandLookContext.Provider value={state}>{children}</BrandLookContext.Provider>;
}

export function useBrandLook(): SelectedLook {
  const shared = useContext(BrandLookContext);
  const local = useState<string | null>(null);
  return shared ?? local;
}

/** Look pronto no manequim, já com as peças no 3D (null se faltar molde). */
export function outfitOf(look: ResolvedBrandLook) {
  return brandLookOutfit(
    look.items.map((i) => ({ role: i.role, modelUrl: i.product.modelUrl, color: i.color })),
  );
}

/** Área do 3D: a peça (children) ou o look escolhido no manequim. */
export function BrandLookStage({
  looks,
  children,
}: {
  looks: ResolvedBrandLook[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useBrandLook();
  const look = looks.find((l) => l.slug === selected);
  const outfit = look ? outfitOf(look) : null;
  if (!look || !outfit) return <>{children}</>;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-sm border border-border bg-muted">
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          Look {look.name}
        </span>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="absolute right-4 top-3 z-10 rounded-sm border border-foreground/20 bg-background/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] hover:bg-background"
        >
          Voltar para a peça
        </button>
        <LookMannequin key={look.slug} outfit={outfit} autoRotate />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Manequim de referência vestindo o look · arraste para girar
      </p>
    </div>
  );
}
