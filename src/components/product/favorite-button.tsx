import Link from "next/link";
import { Heart } from "lucide-react";
import { setFavoriteAction } from "@/lib/favorite-actions";

/**
 * Coração de favoritar (item 11). Visitante é levado ao login; logado, o
 * formulário grava o estado desejado — funciona sem JavaScript no cliente.
 *
 * Acessibilidade: é um botão de alternar. O estado vai só no `aria-pressed`;
 * o nome do ícone sozinho é fixo e leva o nome da peça (no catálogo há um
 * coração por card). Com rótulo visível, o nome é o próprio texto.
 */
export function FavoriteButton({
  productId,
  productName,
  isFavorite,
  isLoggedIn,
  withLabel = false,
  returnTo,
  className = "",
}: {
  productId: string;
  productName: string;
  isFavorite: boolean;
  isLoggedIn: boolean;
  /** Mostra "Favoritar"/"Favoritado" ao lado do ícone (página de produto). */
  withLabel?: boolean;
  /** Para onde o visitante volta depois de entrar (validado no login). */
  returnTo?: string;
  className?: string;
}) {
  const hint = isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  const content = (
    <>
      <Heart
        className="size-4"
        strokeWidth={1.75}
        fill={isFavorite ? "currentColor" : "none"}
      />
      {withLabel && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em]">
          {isFavorite ? "Favoritado" : "Favoritar"}
        </span>
      )}
    </>
  );
  const baseClass = `inline-flex items-center gap-2 transition-colors ${className}`;

  if (!isLoggedIn) {
    return (
      <Link
        href={returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login"}
        aria-label={`Entre para favoritar ${productName}`}
        className={baseClass}
      >
        {content}
      </Link>
    );
  }

  return (
    <form action={setFavoriteAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="favorite" value={isFavorite ? "false" : "true"} />
      <button
        type="submit"
        aria-label={withLabel ? undefined : `Favoritar ${productName}`}
        aria-pressed={isFavorite}
        title={withLabel ? undefined : hint}
        className={baseClass}
      >
        {content}
      </button>
    </form>
  );
}
