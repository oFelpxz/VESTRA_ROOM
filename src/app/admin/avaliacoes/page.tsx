import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { approveReviewAction, rejectReviewAction } from "@/lib/review-actions";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-acid/30 text-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
};

export default async function AdminAvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status === "APPROVED" || sp.status === "REJECTED" ? sp.status : "PENDING";

  const [reviews, counts] = await Promise.all([
    prisma.review.findMany({
      where: { status },
      include: {
        product: { select: { name: true, slug: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.groupBy({ by: ["status"], _count: true }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Avaliações
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Modere as avaliações enviadas pelos clientes antes de aparecerem na
        página do produto.
      </p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/avaliacoes?status=${s}`}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-colors ${
              status === s
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_LABEL[s]} {countFor(s)}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Nenhuma avaliação {STATUS_LABEL[status].toLowerCase()} neste momento.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-sm border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <Link
                      href={`/produto/${r.product.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {r.product.name}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.user.name} · {r.user.email} ·{" "}
                    {r.createdAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span
                  className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${STATUS_BADGE[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              <p className="mt-3 text-sm">
                <span className="text-acid">{"★".repeat(r.rating)}</span>
                <span className="text-muted-foreground/40">
                  {"★".repeat(5 - r.rating)}
                </span>
              </p>
              {r.comment && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {r.comment}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {r.status !== "APPROVED" && (
                  <form action={approveReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-sm bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
                    >
                      Aprovar
                    </button>
                  </form>
                )}
                {r.status !== "REJECTED" && (
                  <form action={rejectReviewAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
                    >
                      Rejeitar
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
