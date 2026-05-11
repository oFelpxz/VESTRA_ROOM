import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-8 px-4 py-24 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Experimente roupas em 3D antes de comprar
        </h1>
        <p className="mx-auto max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Visualize cada peça em 360°, ajuste no seu avatar e descubra o
          tamanho ideal antes mesmo do pedido sair.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/teste-3d">Testar visualizador 3D</Link>
        </Button>
      </div>
    </section>
  );
}
