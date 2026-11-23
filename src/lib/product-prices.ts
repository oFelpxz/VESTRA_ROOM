// Regras do preço base e do preço promocional do produto (formulário do Admin).
// Arquivo sem "use server" para poder ser testado direto.

/** Limite da coluna Decimal(10, 2) do banco. */
const MAX_PRICE = 99_999_999.99;

type Parsed = { ok: true; value: number | null } | { ok: false };

/** Vazio vira null; aceita vírgula ou ponto e no máximo 2 casas decimais. */
function parsePrice(raw: string): Parsed {
  const s = raw.trim().replace(",", ".");
  if (s === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { ok: false };
  const n = Number(s);
  return n <= MAX_PRICE ? { ok: true, value: n } : { ok: false };
}

export function parseProductPrices(
  baseRaw: string,
  promoRaw: string,
): { basePrice: number; promotionalPrice: number | null } | { error: string } {
  const base = parsePrice(baseRaw);
  if (!base.ok || base.value === null || base.value <= 0) {
    return { error: "Informe um preço base maior que zero, como 199,90." };
  }

  const promo = parsePrice(promoRaw);
  if (!promo.ok) {
    return {
      error:
        "Preço promocional inválido. Use um valor como 149,90 ou deixe em branco.",
    };
  }
  if (promo.value !== null && promo.value <= 0) {
    return {
      error:
        "O preço promocional precisa ser maior que zero. Deixe em branco para tirar a promoção.",
    };
  }
  if (promo.value !== null && promo.value >= base.value) {
    return {
      error: "O preço promocional precisa ser menor que o preço base.",
    };
  }

  return { basePrice: base.value, promotionalPrice: promo.value };
}
