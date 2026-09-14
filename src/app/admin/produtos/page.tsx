import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-acid/30 text-foreground",
  INACTIVE: "bg-destructive/10 text-destructive",
};

export default async function AdminProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; categoria?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status?.toUpperCase();
  const categoryFilter = sp.categoria;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(statusFilter && ["DRAFT", "ACTIVE", "INACTIVE"].includes(statusFilter)
          ? { status: statusFilter as "DRAFT" | "ACTIVE" | "INACTIVE" }
          : {}),
        ...(categoryFilter ? { categoryId: categoryFilter } : {}),
      },
      include: {
        category: { select: { name: true } },
        _count: { select: { variants: true, images: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Produtos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Catálogo, variantes e modelo 3D associado.
          </p>
        </div>

        <Link
          href="/admin/produtos/novo"
          className="inline-flex w-fit items-center gap-2 rounded-sm bg-foreground px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
        >
          <span className="text-acid">+</span> Novo produto
        </Link>
      </div>

      {/* Filtros */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <FilterPill
          href="/admin/produtos"
          label="Todos"
          active={!statusFilter && !categoryFilter}
        />
        {(["DRAFT", "ACTIVE", "INACTIVE"] as const).map((s) => (
          <FilterPill
            key={s}
            href={`/admin/produtos?status=${s.toLowerCase()}`}
            label={STATUS_LABEL[s]}
            active={statusFilter === s}
          />
        ))}
        <span className="mx-2 h-4 w-px bg-border" />
        {categories.map((c) => (
          <FilterPill
            key={c.id}
            href={`/admin/produtos?categoria=${c.id}`}
            label={c.name}
            active={categoryFilter === c.id}
          />
        ))}
      </div>

      {/* Lista */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {products.length}{" "}
          {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
        </p>

        <ul className="mt-4 divide-y divide-border border-y border-border">
          {products.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.{" "}
              <Link
                href="/admin/produtos/novo"
                className="underline-offset-4 hover:underline"
              >
                Cadastrar primeiro produto
              </Link>
            </li>
          )}

          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:gap-6"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                      STATUS_STYLE[p.status]
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.has3DModel && (
                    <span className="rounded-sm border border-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/70">
                      3D
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  /{p.slug} · {p.category.name} · {p._count.variants}{" "}
                  {p._count.variants === 1 ? "variante" : "variantes"} ·{" "}
                  {p._count.images}{" "}
                  {p._count.images === 1 ? "imagem" : "imagens"}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-heading text-lg font-bold">
                    {formatBRL(Number(p.basePrice))}
                  </p>
                  {p.promotionalPrice && (
                    <p className="text-xs text-acid-foreground/70">
                      {formatBRL(Number(p.promotionalPrice))} promo
                    </p>
                  )}
                </div>

                <Link
                  href={`/admin/produtos/${p.id}`}
                  className="rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                >
                  Editar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
