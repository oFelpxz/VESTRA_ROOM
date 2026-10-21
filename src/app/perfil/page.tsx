import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/lib/auth-actions";
import { DeleteAccountSection } from "@/components/profile/delete-account-section";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Minha conta" };

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  const [profile, ordersCount, addressesCount, paymentMethodsCount, openReturns, looksCount] =
    await Promise.all([
      prisma.measurementProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      }),
      prisma.order.count({ where: { userId: user.id } }),
      prisma.address.count({ where: { userId: user.id } }),
      prisma.savedPaymentMethod.count({ where: { userId: user.id } }),
      prisma.returnRequest.count({
        where: { userId: user.id, status: { in: ["OPEN", "APPROVED", "RECEIVED"] } },
      }),
      prisma.savedLook.count({ where: { userId: user.id } }),
    ]);
  const hasMeasurements = Boolean(profile);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Minha conta
          </p>
          <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
            {user.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>Nome, e-mail e contato</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Nome: {user.name}</p>
            <p>E-mail: {user.email}</p>
            <p>Perfil: {user.role}</p>
          </CardContent>
        </Card>

        <Link href="/perfil/medidas" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Medidas corporais</CardTitle>
              <CardDescription>
                Para recomendação de tamanho e VESTRA FIT
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {hasMeasurements ? (
                <span className="font-medium text-foreground">
                  Preenchido — clique para editar
                </span>
              ) : (
                <span>Não preenchido — clique para cadastrar</span>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/perfil/enderecos" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Endereços</CardTitle>
              <CardDescription>Endereços de entrega</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {addressesCount > 0 ? (
                <span className="font-medium text-foreground">
                  {addressesCount}{" "}
                  {addressesCount === 1 ? "endereço cadastrado" : "endereços cadastrados"}
                  {" "}— clique para gerenciar
                </span>
              ) : (
                <span>Nenhum endereço cadastrado — clique para adicionar</span>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/perfil/pagamento" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Formas de pagamento</CardTitle>
              <CardDescription>Cartões salvos</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {paymentMethodsCount > 0 ? (
                <span className="font-medium text-foreground">
                  {paymentMethodsCount}{" "}
                  {paymentMethodsCount === 1 ? "cartão salvo" : "cartões salvos"}
                  {" "}— clique para gerenciar
                </span>
              ) : (
                <span>Nenhum cartão salvo — clique para adicionar</span>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/perfil/pedidos" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
              <CardDescription>Histórico de compras</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {ordersCount > 0 ? (
                <span className="font-medium text-foreground">
                  {ordersCount}{" "}
                  {ordersCount === 1 ? "pedido" : "pedidos"} — ver todos →
                </span>
              ) : (
                <span>Nenhum pedido ainda.</span>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/perfil/trocas" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Trocas e devoluções</CardTitle>
              <CardDescription>Acompanhe seus pedidos de troca</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {openReturns > 0 ? (
                <span className="font-medium text-foreground">
                  {openReturns} em andamento — ver →
                </span>
              ) : (
                <span>Para trocar, abra o pedido entregue.</span>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/perfil/looks" className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>Looks salvos</CardTitle>
              <CardDescription>Combinações montadas no provador</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {looksCount > 0 ? (
                <span className="font-medium text-foreground">
                  {looksCount} {looksCount === 1 ? "look" : "looks"} — ver →
                </span>
              ) : (
                <span>Monte um look no provador de uma peça de cima.</span>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-10 flex flex-col gap-3 rounded-sm border border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Seus dados
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Baixe uma cópia de tudo que a loja guarda sobre você (arquivo JSON). Veja a{" "}
            <Link href="/privacidade" className="underline hover:text-foreground">
              política de privacidade
            </Link>
            .
          </p>
        </div>
        {/* Link comum: o navegador baixa o arquivo da rota. */}
        <a
          href="/api/perfil/dados"
          download
          className="shrink-0 rounded-sm border border-foreground/15 px-4 py-2 text-xs font-medium uppercase tracking-wide transition-colors hover:border-foreground"
        >
          Baixar meus dados
        </a>
      </div>

      {user.email && <DeleteAccountSection userEmail={user.email} />}
    </section>
  );
}
