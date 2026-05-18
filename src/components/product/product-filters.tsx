import Link from "next/link";
import { PRICE_OPTIONS } from "@/lib/products";

type Current = {
  categoria?: string;
  tamanho?: string;
  cor?: string;
  preco?: string;
};

function buildHref(current: Current, key: keyof Current, value: string) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v) params.set(k, v);
  }
  // toggle: se já está ativo, remove; senão, define
  if (current[key] === value) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

function FilterGroup({
  title,
  options,
  paramKey,
  current,
}: {
  title: string;
  options: { value: string; label: string }[];
  paramKey: keyof Current;
  current: Current;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = current[paramKey] === opt.value;
          return (
            <Link
              key={opt.value}
              href={buildHref(current, paramKey, opt.value)}
              className={
                active
                  ? "rounded-sm bg-foreground px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-background"
                  : "rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
              }
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ProductFilters({
  categories,
  sizes,
  colors,
  current,
}: {
  categories: { name: string; slug: string }[];
  sizes: string[];
  colors: string[];
  current: Current;
}) {
  const hasAnyFilter = Boolean(
    current.categoria || current.tamanho || current.cor || current.preco,
  );

  return (
    <div className="flex flex-col gap-6 border-b border-border pb-8">
      <FilterGroup
        title="Categoria"
        paramKey="categoria"
        current={current}
        options={categories.map((c) => ({ value: c.slug, label: c.name }))}
      />
      <FilterGroup
        title="Tamanho"
        paramKey="tamanho"
        current={current}
        options={sizes.map((s) => ({ value: s, label: s }))}
      />
      <FilterGroup
        title="Cor"
        paramKey="cor"
        current={current}
        options={colors.map((c) => ({ value: c, label: c }))}
      />
      <FilterGroup
        title="Preço"
        paramKey="preco"
        current={current}
        options={PRICE_OPTIONS}
      />

      {hasAnyFilter && (
        <Link
          href="/catalogo"
          className="text-xs font-medium uppercase tracking-[0.15em] text-acid underline-offset-4 hover:underline"
        >
          Limpar filtros
        </Link>
      )}
    </div>
  );
}
