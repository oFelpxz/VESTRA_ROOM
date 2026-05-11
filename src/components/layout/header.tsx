import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Loja 3D
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/catalogo" className="hover:text-zinc-600 dark:hover:text-zinc-400">
            Catálogo
          </Link>
          <Link href="/teste-3d" className="hover:text-zinc-600 dark:hover:text-zinc-400">
            Teste 3D
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/cadastro">Cadastrar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
