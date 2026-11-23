"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { brandLookTryOnHref } from "@/lib/brand-looks";
import type { ResolvedBrandLook } from "@/lib/look-data";
import { outfitOf } from "./brand-look-stage";
import { LookPieceList, LookTotal } from "./complete-look";

const LookMannequin = dynamic(() => import("@/components/viewer-3d/look-mannequin"), {
  ssr: false,
});

/**
 * Lookbook 3D (lista 10, item 6): os looks prontos da marca no manequim, um
 * de cada vez (um 3D só na página), girando para mostrar as costas, com as
 * peças, o preço somado e o botão que leva ao provador já vestido com o look.
 * (As vistas do provador aproximam a câmera e cortariam a cabeça aqui.)
 */
export function Lookbook3D({ looks }: { looks: ResolvedBrandLook[] }) {
  const [index, setIndex] = useState(0);
  const [spin, setSpin] = useState(true);
  const look = looks[index];
  const outfit = look ? outfitOf(look) : null;
  if (!look) return null;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 md:grid-cols-[1.15fr_1fr] md:px-8">
      <div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-muted">
          <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">
            <span className="inline-block size-1.5 rounded-full bg-acid" />
            VESTRA FIT · 3D
          </span>
          {outfit && <LookMannequin key={look.slug} outfit={outfit} autoRotate={spin} />}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">Arraste para girar</p>
          <button
            type="button"
            onClick={() => setSpin((s) => !s)}
            className="rounded-sm border border-foreground/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] hover:bg-secondary"
          >
            {spin ? "Parar giro" : "Girar"}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        <ol className="flex flex-col border-t border-border">
          {looks.map((l, i) => (
            <li key={l.slug} className="border-b border-border">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                className="group flex w-full items-baseline justify-between gap-4 py-4 text-left"
              >
                <span className="font-heading text-lg font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors group-hover:text-foreground group-aria-pressed:text-foreground">
                  {String(i + 1).padStart(2, "0")} — {l.name}
                </span>
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {l.line === "street" ? "Street" : "Sport"}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-muted-foreground">{look.caption}</p>
        <LookPieceList look={look} />
        <div className="mt-4">
          <LookTotal look={look} />
        </div>
        <Link
          href={brandLookTryOnHref(look)}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          Experimentar este look
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">
          No provador VESTRA FIT, com as suas medidas (precisa entrar na conta).
        </p>
      </div>
    </div>
  );
}
