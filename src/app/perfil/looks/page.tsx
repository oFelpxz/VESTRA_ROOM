import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { LookCardActions } from "@/components/profile/look-card-actions";

export const metadata = { title: "Looks salvos" };

const pieceSelect = {
  id: true,
  color: true,
  size: true,
  status: true,
  stockQuantity: true,
  price: true,
  product: {
    select: {
      id: true,
      name: true,
      status: true,
      has3DModel: true,
      basePrice: true,
      promotionalPrice: true,
      images: {
        orderBy: { position: "asc" as const },
        take: 1,
        select: { url: true },
      },
    },
  },
} as const;

export default async function LooksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const looks = await prisma.savedLook.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      topVariant: { select: pieceSelect },
      bottomVariant: { select: pieceSelect },
    },
  });

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/perfil" className="underline-offset-4 hover:underline">
          Minha conta
        </Link>{" "}
        / Looks
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Looks salvos
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Uma peça de cima e uma de baixo, montadas no provador. Para criar um
        look, abra o{" "}
        <Link
          href="/catalogo?provador=1"
          className="underline hover:text-foreground"
        >
          provador de uma peça
        </Link>
        .
      </p>

      <div className="mt-8">
        {looks.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Você ainda não salvou nenhum look.
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {looks.map((look) => {
              const pieces = [
                { role: "De cima", v: look.topVariant },
                { role: "De baixo", v: look.bottomVariant },
              ];
              const available = (v: (typeof pieces)[number]["v"]) =>
                v != null &&
                v.status === "ACTIVE" &&
                v.product.status === "ACTIVE" &&
                v.stockQuantity > 0;
              const with3D = [look.topVariant, look.bottomVariant].find(
                (v) => v?.product.has3DModel && v.product.status === "ACTIVE",
              );
              const total = pieces.reduce(
                (sum, { v }) =>
                  v
                    ? sum +
                      Number(
                        v.product.promotionalPrice ??
                          v.price ??
                          v.product.basePrice,
                      )
                    : sum,
                0,
              );
              return (
                <li
                  key={look.id}
                  className="flex gap-5 rounded-sm border border-border p-5"
                >
                  {look.previewImage && (
                    // Foto do avatar vestido, tirada no provador ao salvar.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={look.previewImage}
                      alt={`Avatar vestindo o look ${look.name}`}
                      className="hidden w-32 shrink-0 self-start rounded-sm bg-muted object-cover sm:block"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {look.previewImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={look.previewImage}
                        alt=""
                        className="mb-4 w-full max-w-48 rounded-sm bg-muted sm:hidden"
                      />
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-heading text-xl font-bold uppercase tracking-tight">
                        {look.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Salvo em {look.createdAt.toLocaleDateString("pt-BR")} ·{" "}
                        {formatBRL(total)}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {pieces.map(({ role, v }) => (
                        <div key={role} className="flex gap-3">
                          <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-secondary">
                            {v?.product.images[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.product.images[0].url}
                                alt={v.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ProductPlaceholder />
                            )}
                          </div>
                          <div className="min-w-0 text-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                              {role}
                            </p>
                            {v ? (
                              <>
                                <Link
                                  href={`/produto/${v.product.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {v.product.name}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                  {v.color} · Tam {v.size}
                                </p>
                                {!available(v) && (
                                  <p className="text-xs text-destructive">
                                    {v.stockQuantity > 0
                                      ? "Fora de venda"
                                      : "Sem estoque"}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-destructive">
                                Peça saiu da loja
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5">
                      <LookCardActions
                        id={look.id}
                        name={look.name}
                        provadorHref={
                          with3D
                            ? `/produto/${with3D.product.id}/provador?look=${look.id}`
                            : null
                        }
                        canAdd={pieces.every(({ v }) => available(v))}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
