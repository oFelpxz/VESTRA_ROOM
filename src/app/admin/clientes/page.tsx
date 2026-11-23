import Link from "next/link";
import { listCustomers } from "@/lib/customers";
import { formatBRL } from "@/lib/format";
import { CustomerStatusBadge } from "@/components/admin/customer-status-badge";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  // Parâmetro repetido na URL (?q=a&q=b) chega como lista — só texto vale.
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ : "";
  const customers = await listCustomers(q);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Clientes
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Contato, histórico de compras e bloqueio. Medidas corporais não são
        exibidas nem carregadas aqui, por privacidade.
      </p>

      <form action="/admin/clientes" method="get" className="mt-8 flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou e-mail"
          className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-sm bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Buscar
        </button>
        {q && (
          <Link
            href="/admin/clientes"
            className="inline-flex h-10 items-center px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Link>
        )}
      </form>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
        {q && ` para "${q}"`}
      </p>

      {customers.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y border-border text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Cliente</th>
                <th className="py-3 pr-4 font-semibold">Telefone</th>
                <th className="py-3 pr-4 font-semibold">Cadastro</th>
                <th className="py-3 pr-4 text-right font-semibold">Pedidos</th>
                <th className="py-3 pr-4 text-right font-semibold">Total gasto</th>
                <th className="py-3 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {dateFormat.format(c.createdAt)}
                  </td>
                  <td className="py-3 pr-4 text-right">{c._count.orders}</td>
                  <td className="py-3 pr-4 text-right">{formatBRL(c.totalSpent)}</td>
                  <td className="py-3">
                    <CustomerStatusBadge blocked={c.status === "BLOCKED"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
