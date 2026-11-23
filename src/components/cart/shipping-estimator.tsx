import { formatBRL, formatCep } from "@/lib/format";
import { setCartShippingMethodAction } from "@/lib/cart-actions";
import type { ShippingMethod, ShippingOption } from "@/lib/shipping";

/**
 * Cotação de frete no carrinho (item 14). Sem JS no cliente: o CEP vai por
 * GET em `?cep=` (é só estimativa), e a modalidade escolhida é gravada no
 * carrinho — é de lá que checkout e pedido leem.
 */
export function ShippingEstimator({
  cepInput,
  cep,
  error,
  options,
  selected,
}: {
  /** Valor mostrado no campo (pode ser o que o usuário digitou errado). */
  cepInput: string;
  /** CEP válido já normalizado, ou null se ainda não há cotação. */
  cep: string | null;
  error: string | null;
  options: ShippingOption[];
  selected: ShippingMethod;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <form action="/carrinho" method="get" className="flex gap-2">
        <label htmlFor="cep" className="sr-only">
          CEP
        </label>
        <input
          id="cep"
          name="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          defaultValue={cepInput}
          maxLength={9}
          className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-sm border border-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-foreground hover:text-background"
        >
          Calcular
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {cep && options.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {options.map((option) => {
            const active = option.method === selected;
            return (
              <li key={option.method}>
                <form action={setCartShippingMethodAction}>
                  <input type="hidden" name="shippingMethod" value={option.method} />
                  <button
                    type="submit"
                    aria-pressed={active}
                    className={`flex w-full items-center justify-between rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
                      active
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/60"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`inline-block size-3 rounded-full border ${
                          active ? "border-foreground bg-foreground" : "border-foreground/40"
                        }`}
                      />
                      <span>
                        <span className="font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          até {option.estimatedDays} dias úteis
                        </span>
                      </span>
                    </span>
                    <span className="font-medium">
                      {option.free ? "Grátis" : formatBRL(option.amount)}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {cep && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimativa para {formatCep(cep)}. O valor final é confirmado com o
          endereço de entrega no checkout.
        </p>
      )}
    </div>
  );
}
