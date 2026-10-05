/**
 * Bloco de pagamento das páginas de pedido (cliente, Admin e confirmação):
 * forma, situação, boleto com vencimento, link para concluir o pagamento no
 * Stripe e dados do reembolso.
 */

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BOLETO: "Boleto",
  WALLET: "Carteira digital",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Não concluído",
  REFUNDED: "Reembolsado",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PAID: "bg-acid/30 text-foreground",
  FAILED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-destructive/10 text-destructive",
};

const PROVIDER_LABEL: Record<string, string> = {
  SIMULATED: "Simulado",
  STRIPE: "Stripe (modo de teste)",
};

const SP = { timeZone: "America/Sao_Paulo" } as const;

export type PaymentInfo = {
  method: string;
  status: string;
  provider: string;
  paidAt: Date | null;
  externalPaymentId: string | null;
  checkoutUrl: string | null;
  boletoUrl: string | null;
  dueAt: Date | null;
  refundId: string | null;
  refundedAt: Date | null;
};

export function PaymentDetails({
  payment,
  orderStatus,
  showIds = true,
}: {
  payment: PaymentInfo;
  orderStatus: string;
  showIds?: boolean;
}) {
  const waiting = payment.status === "PENDING" && orderStatus === "PENDING_PAYMENT";
  // Boleto já gerado: o cliente paga pela guia, não pela página do Stripe.
  const canResume = waiting && payment.provider === "STRIPE" && !payment.boletoUrl && payment.checkoutUrl;

  return (
    <div className="rounded-sm border border-border p-5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
        </p>
        <span
          className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
            STATUS_BADGE[payment.status] ?? ""
          }`}
        >
          {STATUS_LABEL[payment.status] ?? payment.status}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Provedor: {PROVIDER_LABEL[payment.provider] ?? payment.provider}
      </p>

      {payment.boletoUrl && (
        <div className="mt-3 rounded-sm bg-muted/50 p-3 text-xs">
          {payment.dueAt && (
            <p>
              Vencimento:{" "}
              <strong>{payment.dueAt.toLocaleDateString("pt-BR", SP)}</strong>
            </p>
          )}
          {waiting && (
            <p className="mt-1 text-muted-foreground">
              A confirmação do banco pode levar até 2 dias úteis depois do
              pagamento. Se vencer sem pagamento, o pedido é cancelado.
            </p>
          )}
          <a
            href={payment.boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-semibold underline underline-offset-4"
          >
            Ver boleto
          </a>
        </div>
      )}

      {canResume && (
        <a
          href={payment.checkoutUrl!}
          className="mt-3 inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Pagar agora
        </a>
      )}

      {payment.paidAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Pago em {payment.paidAt.toLocaleString("pt-BR", SP)}
        </p>
      )}
      {payment.refundedAt && (
        <p className="text-xs text-muted-foreground">
          Reembolsado em {payment.refundedAt.toLocaleString("pt-BR", SP)}
        </p>
      )}
      {showIds && payment.externalPaymentId && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          ID: {payment.externalPaymentId}
        </p>
      )}
      {showIds && payment.refundId && (
        <p className="font-mono text-[10px] text-muted-foreground">
          Estorno: {payment.refundId}
        </p>
      )}
    </div>
  );
}
