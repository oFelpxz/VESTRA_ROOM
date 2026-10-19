import { STATUS_LABEL, type ReturnStatus } from "@/lib/returns";

type Dates = {
  createdAt: Date;
  answeredAt: Date | null;
  receivedAt: Date | null;
  completedAt: Date | null;
};

const fmt = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Etapas da troca: pedido → resposta → peça recebida → concluído. */
export function ReturnTimeline({ status, dates }: { status: ReturnStatus; dates: Dates }) {
  const ended = status === "DENIED" || status === "CANCELED";
  const steps: { label: string; at: Date | null }[] = [
    { label: "Pedido enviado", at: dates.createdAt },
    {
      label: status === "DENIED" ? "Negado" : "Aprovado",
      at: dates.answeredAt,
    },
    { label: "Peça recebida", at: dates.receivedAt },
    { label: "Concluído", at: dates.completedAt },
  ];
  const shown = ended
    ? [...steps.slice(0, 2).filter((s) => s.at), ...(status === "CANCELED" ? [{ label: "Cancelado", at: null }] : [])]
    : steps;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Status · {STATUS_LABEL[status]}
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {shown.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                s.at || s.label === "Cancelado" ? "bg-foreground" : "border border-border"
              }`}
            />
            <span className={s.at || s.label === "Cancelado" ? "" : "text-muted-foreground"}>
              {s.label}
            </span>
            {s.at && <span className="text-xs text-muted-foreground">{fmt(s.at)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
