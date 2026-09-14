import Link from "next/link";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { ProductViewer } from "@/components/viewer-3d/product-viewer";

type ProductCardProps = {
  id: string;
  slug?: string;
  name: string;
  price: string;
  tags?: string[];
  imageUrl?: string | null;
  modelUrl?: string | null;
};

export function ProductCard({
  id,
  slug,
  name,
  price,
  tags = [],
  imageUrl,
  modelUrl,
}: ProductCardProps) {
  const href = `/produto/${slug ?? id}`;
  const has3D = Boolean(modelUrl) || tags.some((t) => t.includes("3D"));
  const hasFit = tags.some((t) => t.includes("FIT"));

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
          {modelUrl ? (
            <div className="h-full w-full pointer-events-none">
              <ProductViewer
                modelUrl={modelUrl}
                interactive={false}
                autoRotate
              />
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ProductPlaceholder />
          )}
        </div>

        {/* Badges sobre a imagem */}
        {(has3D || hasFit) && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {has3D && (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-background">
                <span className="inline-block size-1 rounded-full bg-acid" />
                3D
              </span>
            )}
            {hasFit && (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-acid px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground">
                VESTRA FIT
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.15em]">
            {name}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{price}</p>
        </div>
        <span
          aria-hidden
          className="text-lg leading-none text-foreground/40 transition-colors group-hover:text-foreground"
        >
          +
        </span>
      </div>
    </Link>
  );
}
