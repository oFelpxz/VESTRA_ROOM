import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/product-form";

export default async function NovoProdutoPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <Link
          href="/admin/produtos"
          className="underline-offset-4 hover:underline"
        >
          Produtos
        </Link>{" "}
        / Novo
      </p>

      <h1 className="mt-2 font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Novo produto
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cadastre os dados básicos. O produto será criado como{" "}
        <strong className="font-semibold uppercase tracking-wide text-foreground">
          rascunho
        </strong>{" "}
        — depois você adiciona variantes, imagens e modelo 3D antes de publicar.
      </p>

      {categories.length === 0 ? (
        <div className="mt-10 rounded-sm border border-dashed border-border p-8 text-sm text-muted-foreground">
          Você precisa criar ao menos uma categoria antes.{" "}
          <Link
            href="/admin/categorias"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Ir para categorias →
          </Link>
        </div>
      ) : (
        <div className="mt-8 max-w-3xl">
          <ProductForm mode="create" categories={categories} />
        </div>
      )}
    </div>
  );
}
