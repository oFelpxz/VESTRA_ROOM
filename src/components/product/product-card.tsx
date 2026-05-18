import Link from "next/link";
import { ProductPlaceholder } from "@/components/product/product-placeholder";

type ProductCardProps = {
  id: string;
  slug?: string;
  name: string;
  price: string;
  tags?: string[];
};

export function ProductCard({ id, slug, name, price }: ProductCardProps) {
  const href = `/produto/${slug ?? id}`;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.03]">
          <ProductPlaceholder />
        </div>
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
