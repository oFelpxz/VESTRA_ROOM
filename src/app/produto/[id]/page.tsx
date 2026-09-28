import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Tag } from "@/components/ui/tag";
import { ProductViewer } from "@/components/viewer-3d/product-viewer";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ReviewForm } from "@/components/product/review-form";
import { getProductDetail, GENDER_LABEL } from "@/lib/products";
import { getReviewEligibility } from "@/lib/review-actions";
import { isProductFavorite } from "@/lib/favorites";
import { FavoriteButton } from "@/components/product/favorite-button";
import { formatBRL } from "@/lib/format";

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
  const [eligibility, isFavorite] = await Promise.all([
    getReviewEligibility(product.id),
    session?.user?.id
      ? isProductFavorite(session.user.id, product.id)
      : Promise.resolve(false),
  ]);

  const installments = product.maxInstallments && product.maxInstallments > 1
    ? {
        n: product.maxInstallments,
        value: (product.promotionalPriceNumber ?? product.priceNumber) / product.maxInstallments,
      }
    : null;

  const hasTechSheet = Boolean(
    product.composition || product.careInstructions || product.returnPolicy || product.gender || product.collection,
  );

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
              <ProductViewer modelUrl={product.modelUrl} controls />
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
          {product.has3D && product.model3DAvailableSizes.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Simulação 3D disponível nos tamanhos:{" "}
              {product.model3DAvailableSizes.join(", ")}
            </p>
          )}
        </div>

        {/* Detalhes */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {product.brand ?? "VESTRA ROOM"} · {product.category}
            </p>
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              isFavorite={isFavorite}
              isLoggedIn={isLoggedIn}
              returnTo={`/produto/${product.slug}`}
              withLabel
              className="text-foreground/70 hover:text-foreground aria-pressed:text-foreground"
            />
          </div>
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
          {installments && (
            <p className="mt-1 text-xs text-muted-foreground">
              ou {installments.n}x de {formatBRL(installments.value)} sem juros
            </p>
          )}

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
                      <th className="py-2 pr-4 font-medium">Quadril (cm)</th>
                      <th className="py-2 pr-4 font-medium">Braço (cm)</th>
                      <th className="py-2 font-medium">Perna (cm)</th>
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
                        <td className="py-2 pr-4 text-muted-foreground">
                          {range(r.hipMinCm, r.hipMaxCm)}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {range(r.armLengthMinCm, r.armLengthMaxCm)}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {range(r.legLengthMinCm, r.legLengthMaxCm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ficha técnica */}
          {hasTechSheet && (
            <div className="mt-12 border-t border-border pt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Ficha técnica
              </p>
              <dl className="mt-4 divide-y divide-border/60 text-sm">
                {product.gender && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Gênero</dt>
                    <dd>{GENDER_LABEL[product.gender] ?? product.gender}</dd>
                  </div>
                )}
                {product.collection && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Coleção</dt>
                    <dd>{product.collection}</dd>
                  </div>
                )}
                {product.composition && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Composição</dt>
                    <dd className="text-right">{product.composition}</dd>
                  </div>
                )}
                {product.careInstructions && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Cuidados</dt>
                    <dd className="text-right">{product.careInstructions}</dd>
                  </div>
                )}
                {product.returnPolicy && (
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-muted-foreground">Trocas e devoluções</dt>
                    <dd className="text-right">{product.returnPolicy}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Avaliações */}
          <div className="mt-12 border-t border-border pt-8">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Avaliações
              </p>
              {product.reviews.average != null && (
                <p className="text-sm">
                  <span className="text-acid">★</span>{" "}
                  {product.reviews.average.toFixed(1)}{" "}
                  <span className="text-muted-foreground">
                    ({product.reviews.count})
                  </span>
                </p>
              )}
            </div>

            {product.reviews.items.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Ainda não há avaliações para esta peça.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {product.reviews.items.map((r) => (
                  <li key={r.id} className="border-b border-border/60 pb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-acid">{"★".repeat(r.rating)}</span>
                      <span className="text-muted-foreground/40">
                        {"★".repeat(5 - r.rating)}
                      </span>
                      <span className="font-medium">{r.authorName}</span>
                    </div>
                    {r.comment && (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {r.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              {eligibility.canReview ? (
                <ReviewForm productId={product.id} productSlug={product.slug} />
              ) : eligibility.reason === "already-reviewed" ? (
                <p className="text-sm text-muted-foreground">
                  Você já avaliou esta peça — obrigado!
                </p>
              ) : eligibility.reason === "not-purchased" ? (
                <p className="text-sm text-muted-foreground">
                  Só clientes que compraram esta peça podem avaliar.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href="/login" className="underline underline-offset-2">
                    Entre na sua conta
                  </Link>{" "}
                  para avaliar esta peça.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
