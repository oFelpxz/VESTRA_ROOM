import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Tag } from "@/components/ui/tag";
import { ProductViewer } from "@/components/viewer-3d/product-viewer";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { ProductPurchase } from "@/components/product/product-purchase";
import { getProductDetail } from "@/lib/products";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) {
    return { title: "Produto não encontrado | VESTRA ROOM" };
  }
  return {
    title: `${product.name} | VESTRA ROOM`,
    description:
      product.description ??
      "Peça VESTRA ROOM com visualização 3D e provador virtual VESTRA FIT.",
  };
}

function range(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${min} – ${max}`;
  return `${min ?? max}`;
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, session] = await Promise.all([
    getProductDetail(id),
    auth(),
  ]);

  if (!product) {
    notFound();
  }

  const isLoggedIn = !!session?.user;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="grid gap-12 md:grid-cols-2">
        {/* Visual: 3D quando disponível, senão placeholder */}
        <div>
          {product.has3D && product.modelUrl ? (
            <div className="relative aspect-square overflow-hidden rounded-sm border border-border bg-muted">
              <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/60">
                <span className="inline-block size-1.5 rounded-full bg-acid" />
                VESTRA FIT · 3D
              </span>
              <ProductViewer modelUrl={product.modelUrl} />
            </div>
          ) : (
            <div className="relative aspect-square overflow-hidden rounded-sm bg-secondary">
              <ProductPlaceholder />
            </div>
          )}
          {product.has3D && (
            <p className="mt-3 text-xs text-muted-foreground">
              Arraste para girar · scroll para zoom
            </p>
          )}
        </div>

        {/* Detalhes */}
        <div className="flex flex-col">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            {product.brand ?? "VESTRA ROOM"} · {product.category}
          </p>
          <h1 className="font-heading mt-3 text-4xl font-bold uppercase tracking-tight md:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            {product.promotionalPrice ? (
              <>
                <span className="text-2xl">{product.promotionalPrice}</span>
                <span className="text-base text-muted-foreground line-through">
                  {product.price}
                </span>
              </>
            ) : (
              <span className="text-2xl">{product.price}</span>
            )}
          </div>

          {product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Tag key={t} variant={t.includes("3D") ? "accent" : "outline"}>
                  {t}
                </Tag>
              ))}
            </div>
          )}

          {product.description && (
            <p className="mt-6 text-sm text-muted-foreground">
              {product.description}
            </p>
          )}

          {/* Compra: seleção cor + tamanho + adicionar à sacola */}
          <div className="mt-8">
            <ProductPurchase
              variants={product.variants}
              colors={product.colors}
              sizes={product.sizes}
              isLoggedIn={isLoggedIn}
            />
          </div>

          {product.has3D && product.modelUrl && (
            <Link
              href={`/produto/${product.slug}/provador`}
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-foreground/20 px-8 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-secondary"
            >
              <span className="inline-block size-1.5 rounded-full bg-acid" />
              Experimentar no VESTRA FIT
            </Link>
          )}

          {/* Tabela de medidas */}
          {product.sizeChart && product.sizeChart.rows.length > 0 && (
            <div className="mt-12 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {product.sizeChart.name}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Tamanho</th>
                      <th className="py-2 pr-4 font-medium">Tórax (cm)</th>
                      <th className="py-2 pr-4 font-medium">Cintura (cm)</th>
                      <th className="py-2 font-medium">Quadril (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.sizeChart.rows.map((r) => (
                      <tr key={r.size} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-medium">{r.size}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {range(r.chestMinCm, r.chestMaxCm)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {range(r.waistMinCm, r.waistMaxCm)}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {range(r.hipMinCm, r.hipMaxCm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
