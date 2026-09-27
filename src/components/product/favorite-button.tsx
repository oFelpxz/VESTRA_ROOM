import Link from "next/link";
import { Heart } from "lucide-react";
import { setFavoriteAction } from "@/lib/favorite-actions";

/**
 * Coração de favoritar (item 11). Visitante é levado ao login; logado, o
 * formulário grava o estado desejado — funciona sem JavaScript no cliente.
 */
export function FavoriteButton({
  productId,
  isFavorite,
  isLoggedIn,
  withLabel = false,
  className = "",
}: {
  productId: string;
  isFavorite: boolean;
  isLoggedIn: boolean;
  /** Mostra "Favoritar"/"Favoritado" ao lado do ícone (página de produto). */
  withLabel?: boolean;
  className?: string;
}) {
  const label = isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
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
      <Link href="/login" aria-label="Entre para favoritar" className={baseClass}>
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
        aria-label={label}
        aria-pressed={isFavorite}
        title={label}
        className={baseClass}
      >
        {content}
      </button>
    </form>
  );
}
