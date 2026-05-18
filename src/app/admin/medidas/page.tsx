import { prisma } from "@/lib/prisma";
import { SizeChartForm } from "@/components/admin/size-chart-form";

export default async function AdminMedidasPage() {
  const [products, charts] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.sizeChart.findMany({
      include: {
        product: { select: { name: true } },
        _count: { select: { measures: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Tabela de medidas
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Define as faixas de medida por tamanho. Salvar substitui a tabela
        existente do produto.
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Definir / atualizar tabela
          </p>
          <div className="mt-4">
            <SizeChartForm products={products} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Tabelas existentes ({charts.length})
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {charts.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">
                Nenhuma tabela cadastrada ainda.
              </li>
            )}
            {charts.map((c) => (
              <li key={c.id} className="py-3">
                <p className="font-medium">{c.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c._count.measures}{" "}
                  {c._count.measures === 1 ? "tamanho" : "tamanhos"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
