/**
 * "Comprar o look todo" (lista 10, item 8): as peças do look entram na sacola
 * juntas ou nenhuma entra. Cada uma precisa estar à venda e ter estoque para
 * mais uma unidade além do que já está na sacola. Sem desconto: cada peça
 * entra pelo próprio preço. Regras puras, sem banco.
 */

/** Peças de um look: a do provador, a outra e a touca. */
export const LOOK_CART_MAX = 3;

export type LookCartVariant = {
  id: string;
  /** Variação e produto à venda (nem rascunho nem desativado). */
  active: boolean;
  stockQuantity: number;
  /** "Cargo Pant (Preto, 42)", para a mensagem de erro. */
  label: string;
};

/** Ids das variações do formulário: sem vazios nem repetidos, até 3. */
export function lookCartIds(raw: unknown[]): string[] {
  const ids = raw.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  return [...new Set(ids)].slice(0, LOOK_CART_MAX);
}

/**
 * Confere o look antes de pôr na sacola. Devolve a mensagem do primeiro
 * problema, ou null quando todas as peças podem entrar. `minPieces` é 1 só
 * para o vestido salvo sem acessório (o vestido é o look inteiro).
 */
export function checkLookCart(
  ids: string[],
  variants: LookCartVariant[],
  inCart: ReadonlyMap<string, number>,
  minPieces = 2,
): string | null {
  if (ids.length < minPieces || ids.length === 0) return "Escolha cor e tamanho de todas as peças do look.";
  for (const id of ids) {
    const v = variants.find((x) => x.id === id);
    if (!v || !v.active) return v ? `${v.label} está indisponível.` : "Uma peça do look está indisponível.";
    const already = inCart.get(id) ?? 0;
    if (already + 1 > v.stockQuantity)
      return `${v.label} esgotou${already ? " (o que tinha já está na sua sacola)" : ""}.`;
  }
  return null;
}
