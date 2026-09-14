import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  publishProductAction,
  unpublishProductAction,
  deleteProductAction,
} from "@/lib/product-actions";
import { ProductForm } from "@/components/admin/product-form";
import { VariantManager } from "@/components/admin/variant-manager";

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

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        model3D: true,
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const canPublish =
    product.status !== "ACTIVE" &&
    product.variants.some((v) => v.status === "ACTIVE");

  return (
    <div className="flex flex-col gap-12">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Link
            href="/admin/produtos"
            className="underline-offset-4 hover:underline"
          >
            Produtos
          </Link>{" "}
          / {product.name}
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
                {product.name}
              </h1>
              <span
                className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${
                  STATUS_STYLE[product.status]
                }`}
              >
                {STATUS_LABEL[product.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              /{product.slug}
            </p>
          </div>

          {/* Ações de status */}
          <div className="flex flex-wrap items-center gap-2">
            {product.status === "ACTIVE" ? (
              <form action={unpublishProductAction}>
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                >
                  Despublicar
                </button>
              </form>
            ) : (
              <form action={publishProductAction}>
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  disabled={!canPublish}
                  title={
                    canPublish
                      ? "Publicar produto"
                      : "Precisa de ao menos 1 variante ativa"
                  }
                  className="inline-flex items-center gap-2 rounded-sm bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="text-acid">●</span> Publicar
                </button>
              </form>
            )}

            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <button
                type="submit"
                className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
              >
                Excluir
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Seção: Dados básicos */}
      <Section index="01" title="Dados básicos">
        <div className="max-w-3xl">
          <ProductForm
            mode="edit"
            categories={categories}
            defaults={{
              id: product.id,
              name: product.name,
              categoryId: product.categoryId,
              description: product.description,
              brand: product.brand,
              basePrice: product.basePrice.toString(),
              promotionalPrice: product.promotionalPrice?.toString() ?? null,
              availableForVirtualTryOn: product.availableForVirtualTryOn,
            }}
          />
        </div>
      </Section>

      {/* Seção: Variantes */}
      <Section
        index="02"
        title="Variantes"
        subtitle={`${product.variants.length} ${
          product.variants.length === 1 ? "variante" : "variantes"
        } cadastradas`}
      >
        <VariantManager
          productId={product.id}
          basePrice={product.basePrice.toString()}
          variants={product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            size: v.size,
            price: v.price?.toString() ?? null,
            stockQuantity: v.stockQuantity,
            status: v.status,
          }))}
        />
      </Section>

      {/* Seção: Modelo 3D */}
      <Section
        index="03"
        title="Modelo 3D"
        subtitle={
          product.model3D
            ? `${product.model3D.status} · v${product.model3D.version}`
            : "Nenhum modelo associado"
        }
      >
        <div className="flex flex-col gap-4 rounded-sm border border-border p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            {product.model3D ? (
              <>
                <p className="text-sm">
                  Modelo <strong className="font-semibold">{product.model3D.format}</strong>{" "}
                  v{product.model3D.version}
                  {product.model3D.fileSizeMb && (
                    <> · {product.model3D.fileSizeMb} MB</>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status atual:{" "}
                  <strong className="font-semibold uppercase tracking-wide text-foreground">
                    {product.model3D.status}
                  </strong>
                  {product.has3DModel
                    ? " — disponível na loja"
                    : " — não exibido na loja"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este produto ainda não possui modelo 3D. Envie um arquivo
                .glb/.gltf para começar.
              </p>
            )}
          </div>

          <Link
            href={`/admin/modelos-3d/${product.id}`}
            className="inline-flex w-fit items-center gap-2 rounded-sm bg-foreground px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
          >
            <span className="text-acid">↗</span>{" "}
            {product.model3D ? "Revisar modelo" : "Enviar modelo 3D"}
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Section({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 border-b border-border pb-3">
        <span className="font-mono text-xs font-semibold text-acid-foreground/0 text-foreground/30">
          |{index}|
        </span>
        <h2 className="font-heading text-xl font-bold uppercase tracking-[0.05em]">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">· {subtitle}</span>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
