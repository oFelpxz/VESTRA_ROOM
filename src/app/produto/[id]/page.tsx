import { Button } from "@/components/ui/button";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-900" />

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-zinc-500">Produto #{id}</p>
            <h1 className="text-3xl font-bold tracking-tight">Nome do produto</h1>
            <p className="mt-2 text-2xl font-semibold">R$ 0,00</p>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            Descrição em construção. Esta página será preenchida com dados reais
            do produto a partir da Semana 2.
          </p>

          <div className="flex flex-col gap-2">
            <Button size="lg">Adicionar ao carrinho</Button>
            <Button size="lg" variant="outline">
              Experimentar no provador virtual
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
