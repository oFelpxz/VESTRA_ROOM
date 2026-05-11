import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerfilPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Meu perfil</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>Nome, e-mail e telefone</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Em construção.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medidas corporais</CardTitle>
            <CardDescription>Para recomendação de tamanho e provador virtual</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Em construção.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereços</CardTitle>
            <CardDescription>Endereços de entrega</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Em construção.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
            <CardDescription>Histórico de compras</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">
            Em construção.
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
