import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminHomePage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(
    startOfDay.getFullYear(),
    startOfDay.getMonth(),
    1,
  );

  const [
    ordersToday,
    pendingShipping,
    lowStock,
    monthRevenue,
    products,
    categories,
    users,
    pending3D,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: startOfDay } },
    }),
    prisma.order.count({
      where: { status: { in: ["PAID", "PREPARING"] } },
    }),
    prisma.productVariant.count({
      where: { stockQuantity: { lt: 5 }, status: "ACTIVE" },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] },
      },
      _sum: { totalAmount: true },
    }),
    prisma.product.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.model3D.count({ where: { status: "PENDING" } }),
  ]);

  const revenue = Number(monthRevenue._sum.totalAmount ?? 0);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Painel
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Visão geral da loja —{" "}
        {new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
      </p>

      {/* Métricas operacionais */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Pedidos hoje"
          value={ordersToday}
          highlight={ordersToday > 0}
        />
        <StatCard
          label="A despachar"
          value={pendingShipping}
          highlight={pendingShipping > 0}
          href="/admin/pedidos"
        />
        <StatCard
          label="Estoque baixo"
          value={lowStock}
          danger={lowStock > 0}
          href="/admin/estoque?baixo=1"
        />
        <StatCard
          label="Faturamento (mês)"
          value={formatBRL(revenue)}
          big
        />
      </div>

      {/* Métricas de catálogo */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Produtos" value={products} muted />
        <StatCard label="Categorias" value={categories} muted />
        <StatCard label="Usuários" value={users} muted />
        <StatCard
          label="3D pendentes"
          value={pending3D}
          highlight={pending3D > 0}
          href="/admin/modelos-3d?status=pending"
          muted={pending3D === 0}
        />
      </div>

      {/* Atalhos */}
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/pedidos" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
              <CardDescription>
                Acompanhar e atualizar status dos pedidos
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/estoque" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Estoque</CardTitle>
              <CardDescription>
                Inventário por variante e ajustes manuais
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/produtos" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Produtos</CardTitle>
              <CardDescription>
                Cadastrar produtos, variantes, imagens e modelo 3D
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/modelos-3d" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Modelos 3D</CardTitle>
              <CardDescription>
                Upload, revisão e validação dos arquivos .glb
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>

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

function StatCard({
  label,
  value,
  highlight,
  danger,
  muted,
  big,
  href,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
  muted?: boolean;
  big?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-sm border p-6 transition-colors ${
        danger
          ? "border-destructive/30 bg-destructive/5"
          : highlight
            ? "border-foreground bg-secondary/40"
            : muted
              ? "border-border"
              : "border-border"
      } ${href ? "hover:border-foreground" : ""}`}
    >
      <p
        className={`font-heading font-bold ${big ? "text-2xl md:text-3xl" : "text-3xl"} ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
