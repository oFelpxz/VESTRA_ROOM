import Link from "next/link";
import { Tag } from "@/components/ui/tag";

type ProductCardProps = {
  id: string;
  slug?: string;
  name: string;
  price: string;
  tags?: string[];
};

export function ProductCard({
  id,
  slug,
  name,
  price,
  tags = [],
}: ProductCardProps) {
  const href = `/produto/${slug ?? id}`;
  const isNew = tags.includes("NOVO");
  const visibleTags = tags.filter((t) => t !== "NOVO");

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-secondary">
        <div className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground transition-transform duration-500 group-hover:scale-105">
          VESTRA ROOM
        </div>
        {isNew && (
          <span className="absolute left-3 top-3">
            <Tag variant="accent">Novo</Tag>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wide">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground">{price}</p>
      </div>

      {visibleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {visibleTags.map((t) => (
            <Tag key={t} variant={t.includes("3D") ? "accent" : "outline"}>
              {t}
            </Tag>
          ))}
        </div>
      )}
    </Link>
  );
}
