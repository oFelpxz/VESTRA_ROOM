"use client";

import Link from "next/link";
import { ColorLabel } from "@/components/product/color-swatch";
import { brandLookTotal } from "@/lib/brand-looks";
import { formatBRL } from "@/lib/format";
import { LOOK_INFO } from "@/lib/garment-prints";
import type { ResolvedBrandLook } from "@/lib/look-data";
import { outfitOf, useBrandLook } from "./brand-look-stage";

/**
 * "Complete o look" na página do produto (lista 10, item 5): os looks prontos
 * da marca que levam esta peça, com as outras peças, o preço somado (sem
 * desconto) e o botão que veste o look no manequim lá em cima.
 */
export function CompleteLook({
  looks,
  productSlug,
}: {
  looks: ResolvedBrandLook[];
  productSlug: string;
}) {
  const [selected, setSelected] = useBrandLook();
  if (looks.length === 0) return null;

  function wear(slug: string) {
    setSelected(slug);
    document.getElementById("produto-visual")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="mt-12 border-t border-border pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Complete o look
      </p>
      <ul className="mt-4 flex flex-col gap-4">
        {looks.map((look) => {
          const wearing = selected === look.slug;
          const canWear = outfitOf(look) != null;
          return (
            <li key={look.slug} className="rounded-sm border border-border p-4">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-heading text-lg font-bold uppercase tracking-tight">{look.name}</p>
                <span
                  className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
                  title={LOOK_INFO[look.line]}
                >
                  Linha {look.line === "street" ? "Street" : "Sport"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{look.caption}</p>
              <ul className="mt-3 divide-y divide-border/60 text-sm">
                {look.items.map((item) => (
                  <li key={item.role} className="flex items-center justify-between gap-4 py-2">
                    <span className="min-w-0">
                      {item.product.slug === productSlug ? (
                        <span className="font-medium">{item.product.name}</span>
                      ) : (
                        <Link
                          href={`/produto/${item.product.slug}`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {item.product.name}
                        </Link>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        <ColorLabel name={item.color} />
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{item.product.price}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  Look completo{" "}
                  <span className="font-semibold">
                    {formatBRL(brandLookTotal(look.items.map((i) => i.product.priceValue)))}
                  </span>
                  <span className="block text-xs text-muted-foreground">Soma das peças</span>
                </p>
                {canWear && (
                  <button
                    type="button"
                    onClick={() => (wearing ? setSelected(null) : wear(look.slug))}
                    aria-pressed={wearing}
                    className="inline-flex h-10 items-center gap-2 rounded-sm border border-foreground/20 px-4 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-secondary aria-pressed:bg-foreground aria-pressed:text-background"
                  >
                    <span className="inline-block size-1.5 rounded-full bg-acid" />
                    {wearing ? "Vestindo no manequim" : "Ver no manequim"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
