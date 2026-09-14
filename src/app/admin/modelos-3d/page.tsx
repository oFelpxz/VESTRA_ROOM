import Link from "next/link";
import { prisma } from "@/lib/prisma";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendentes",
  VALIDATED: "Validados",
  REJECTED: "Rejeitados",
  OPTIMIZED: "Otimizados",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  VALIDATED: "bg-acid/30 text-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
  OPTIMIZED: "bg-foreground text-background",
};

const TABS = ["PENDING", "VALIDATED", "REJECTED", "OPTIMIZED"] as const;

export default async function AdminModelos3DPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.toUpperCase();
  const active =
    status && TABS.includes(status as (typeof TABS)[number])
      ? (status as (typeof TABS)[number])
      : "PENDING";

  const [models, counts, productsWithoutModel] = await Promise.all([
    prisma.model3D.findMany({
      where: { status: active },
      include: {
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.model3D.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: { model3D: null, status: { not: "INACTIVE" } },
      select: { id: true, name: true, slug: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Modelos 3D
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload, revisão e validação dos modelos GLB/GLTF.
          </p>
        </div>
      </div>

      {/* Tabs por status */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => {
          const isActive = active === t;
          return (
            <Link
              key={t}
              href={`/admin/modelos-3d?status=${t.toLowerCase()}`}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                isActive
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {STATUS_LABEL[t]}
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] ${
                  isActive
                    ? "bg-background/15 text-background"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {countMap[t] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Lista */}
      <div className="mt-6">
        {models.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhum modelo neste status.
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:gap-6"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/modelos-3d/${m.product.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {m.product.name}
                    </Link>
                    <span
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${STATUS_BADGE[m.status]}`}
                    >
                      {m.status}
                    </span>
                    <span className="rounded-sm border border-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/70">
                      v{m.version}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    /{m.product.slug} · {m.format} ·{" "}
                    {m.fileSizeMb ? `${m.fileSizeMb} MB` : "tamanho desconhecido"}{" "}
                    · atualizado{" "}
                    {m.updatedAt.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <Link
                  href={`/admin/modelos-3d/${m.product.id}`}
                  className="rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                >
                  Revisar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Produtos sem modelo (atalho de upload) */}
      {productsWithoutModel.length > 0 && (
        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Produtos sem modelo 3D
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {productsWithoutModel.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/modelos-3d/${p.id}`}
                  className="block rounded-sm border border-border p-4 transition-colors hover:border-foreground"
                >
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    /{p.slug} · enviar modelo →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
