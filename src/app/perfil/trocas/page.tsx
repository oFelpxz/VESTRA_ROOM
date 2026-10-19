import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { KIND_LABEL, REASON_LABEL, STATUS_LABEL } from "@/lib/returns";
import { shortOrderCode } from "@/lib/payment-rules";

export const metadata = { title: "Trocas e devoluções" };

export default async function MinhasTrocasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const requests = await prisma.returnRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderId: true,
      status: true,
      kind: true,
      reason: true,
      quantity: true,
      createdAt: true,
      orderItem: { select: { productName: true, size: true, color: true } },
    },
  });

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/perfil" className="underline-offset-4 hover:underline">
          Minha conta
        </Link>{" "}
        / Trocas
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Trocas e devoluções
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Para pedir, abra um{" "}
        <Link href="/perfil/pedidos?status=delivered" className="underline hover:text-foreground">
          pedido entregue
        </Link>{" "}
        e escolha a peça. Veja a{" "}
        <Link href="/trocas" className="underline hover:text-foreground">
          política de trocas
        </Link>
        .
      </p>

      <div className="mt-8">
        {requests.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Você ainda não pediu nenhuma troca.
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {requests.map((r) => (
              <li key={r.id} className="py-4">
                <Link
                  href={`/perfil/trocas/${r.id}`}
                  className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {r.quantity}× {r.orderItem.productName} · {r.orderItem.color} · Tam{" "}
                      {r.orderItem.size}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {KIND_LABEL[r.kind]} · {REASON_LABEL[r.reason]} · Pedido #
                      {shortOrderCode(r.orderId)} ·{" "}
                      {r.createdAt.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="w-fit rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]">
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="hidden text-foreground/40 md:inline">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
