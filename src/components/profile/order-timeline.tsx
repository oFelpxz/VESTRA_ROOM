type Status =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

const STEPS: { key: Status; label: string }[] = [
  { key: "PENDING_PAYMENT", label: "Aguardando pagamento" },
  { key: "PAID", label: "Pago" },
  { key: "PREPARING", label: "Em preparação" },
  { key: "SHIPPED", label: "Enviado" },
  { key: "DELIVERED", label: "Entregue" },
];

function indexOfStatus(s: Status): number {
  return STEPS.findIndex((step) => step.key === s);
}

export function OrderTimeline({ status }: { status: Status }) {
  const canceled = status === "CANCELED" || status === "REFUNDED";
  const currentIdx = canceled ? -1 : indexOfStatus(status);

  if (canceled) {
    return (
      <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-destructive">
          {status === "REFUNDED" ? "Pedido reembolsado" : "Pedido cancelado"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Este pedido foi {status === "REFUNDED" ? "reembolsado" : "cancelado"}{" "}
          e não será mais processado.
        </p>
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;

        return (
          <li
            key={s.key}
            className={`relative rounded-sm border p-3 ${
              active
                ? "border-foreground bg-secondary/40"
                : done
                  ? "border-foreground/30"
                  : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? "bg-foreground text-background"
                    : done
                      ? "bg-acid text-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                  active
                    ? "text-foreground"
                    : done
                      ? "text-foreground/70"
                      : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
