import { formatBRL } from "@/lib/format";

type Item = {
  id: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
};

export function OrderSummary({
  items,
  subtotal,
  shipping,
  shippingReason,
  total,
  estimatedDays,
}: {
  items: Item[];
  subtotal: number;
  shipping: number;
  shippingReason?: string;
  total: number;
  estimatedDays?: number;
}) {
  return (
    <div className="border border-border p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Resumo
      </p>

      <ul className="mt-4 flex flex-col gap-3 border-b border-border pb-4">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <div className="aspect-square w-12 shrink-0 overflow-hidden rounded-sm bg-secondary">
              {i.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{i.productName}</p>
              <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {i.color} · Tam {i.size} · {i.quantity}x
              </p>
            </div>
            <p className="text-sm">{formatBRL(i.unitPrice * i.quantity)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Frete</span>
          <span>
            {shipping === 0 ? (
              <span className="font-semibold uppercase tracking-wide text-acid-foreground/0 text-foreground">
                Grátis
              </span>
            ) : (
              formatBRL(shipping)
            )}
          </span>
        </div>
        {shippingReason && (
          <p className="text-[11px] text-muted-foreground">{shippingReason}</p>
        )}
        {estimatedDays && (
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Entrega estimada · {estimatedDays} dias úteis
          </p>
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-xs font-semibold uppercase tracking-[0.15em]">
          Total
        </span>
        <span className="font-heading text-2xl font-bold">
          {formatBRL(total)}
        </span>
      </div>
    </div>
  );
}
