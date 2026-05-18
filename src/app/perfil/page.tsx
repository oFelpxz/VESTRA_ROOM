import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  const profile = await prisma.measurementProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
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

        <Card>
          <CardHeader>
            <CardTitle>Endereços</CardTitle>
            <CardDescription>Endereços de entrega</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Em breve (Semana 3).
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>Histórico de compras</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Em breve (Semana 3).
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
