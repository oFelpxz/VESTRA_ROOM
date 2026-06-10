import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StockEditor } from "@/components/admin/stock-editor";

export default async function AdminEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; baixo?: string; produto?: string }>;
}) {
  const sp = await searchParams;
  const categoryId = sp.categoria;
  const onlyLow = sp.baixo === "1";
  const productId = sp.produto;

  const [variants, categories, products] = await Promise.all([
    prisma.productVariant.findMany({
      where: {
        ...(categoryId
          ? { product: { categoryId } }
          : {}),
        ...(productId ? { productId } : {}),
        ...(onlyLow ? { stockQuantity: { lt: 5 } } : {}),
        status: "ACTIVE",
      },
      include: {
        product: {
          select: { id: true, name: true, categoryId: true },
        },
      },
      orderBy: [
        { stockQuantity: "asc" },
        { product: { name: "asc" } },
      ],
      take: 200,
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
  ]);

  const lowStockCount = await prisma.productVariant.count({
    where: { stockQuantity: { lt: 5 }, status: "ACTIVE" },
  });

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Estoque
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste de inventário por variante (SKU).
          </p>
        </div>
        {lowStockCount > 0 && !onlyLow && (
          <Link
            href="/admin/estoque?baixo=1"
            className="inline-flex items-center gap-2 rounded-sm bg-destructive/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-destructive transition-colors hover:bg-destructive/20"
          >
            <span className="inline-block size-1.5 rounded-full bg-destructive" />
            {lowStockCount} com estoque baixo
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/estoque"
          className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
            !categoryId && !onlyLow && !productId
              ? "bg-foreground text-background"
              : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          Todos
        </Link>
        <Link
          href="/admin/estoque?baixo=1"
          className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
            onlyLow
              ? "bg-destructive text-background"
              : "border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
          }`}
        >
          Estoque baixo
        </Link>

        <span className="mx-2 h-4 w-px bg-border" />

        <form action="/admin/estoque" method="GET" className="flex gap-2">
          <select
            name="categoria"
            defaultValue={categoryId ?? ""}
            className="h-8 rounded-sm border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="produto"
            defaultValue={productId ?? ""}
            className="h-8 max-w-48 rounded-sm border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring"
          >
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {onlyLow && <input type="hidden" name="baixo" value="1" />}
          <button
            type="submit"
            className="rounded-sm bg-foreground px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
          >
            Filtrar
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {variants.length}{" "}
          {variants.length === 1 ? "variante" : "variantes"} encontradas
        </p>

        <div className="mt-4">
          <StockEditor
            variants={variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              color: v.color,
              size: v.size,
              stockQuantity: v.stockQuantity,
              productName: v.product.name,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
