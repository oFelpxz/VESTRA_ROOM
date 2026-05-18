import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminHomePage() {
  const [categories, products, users, sizeCharts] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.user.count(),
    prisma.sizeChart.count(),
  ]);

  const stats = [
    { label: "Categorias", value: categories },
    { label: "Produtos", value: products },
    { label: "Usuários", value: users },
    { label: "Tabelas de medidas", value: sizeCharts },
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Painel
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Visão geral da loja.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-sm border border-border p-6"
          >
            <p className="font-heading text-3xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Link href="/admin/categorias" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
              <CardDescription>
                Criar, listar e remover categorias de produtos
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/medidas" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Tabela de medidas</CardTitle>
              <CardDescription>
                Definir medidas por tamanho de cada produto
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
