import { prisma } from "@/lib/prisma";
import { deleteCategoryAction } from "@/lib/admin-actions";
import { CategoryForm } from "@/components/admin/category-form";

export default async function AdminCategoriasPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Categorias
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Categorias usadas no catálogo e nos filtros.
      </p>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Nova categoria
          </p>
          <div className="mt-4">
            <CategoryForm />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Categorias existentes ({categories.length})
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{c.slug} · {c._count.products}{" "}
                    {c._count.products === 1 ? "produto" : "produtos"}
                  </p>
                </div>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    disabled={c._count.products > 0}
                    className="rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      c._count.products > 0
                        ? "Categoria com produtos não pode ser removida"
                        : "Remover categoria"
                    }
                  >
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
