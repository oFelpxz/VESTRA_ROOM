"use client";

import { useActionState } from "react";
import { refundOrderAction, type LogisticsState } from "@/lib/logistics-actions";
import { Button } from "@/components/ui/button";

const initial: LogisticsState = {};

/**
 * Pedido cancelado com pagamento ainda Pago (item 20): o estorno no gateway
 * falhou ou é boleto, que o Stripe não estorna.
 */
export function RefundActions({
  orderId,
  manualOnly,
}: {
  orderId: string;
  /** Boleto pago: a devolução é feita fora do Stripe e só registrada aqui. */
  manualOnly: boolean;
}) {
  const [state, action, pending] = useActionState(refundOrderAction, initial);

  return (
    <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">Reembolso pendente</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {manualOnly
          ? "Boleto pago não tem estorno automático no Stripe. Devolva o valor ao cliente por PIX ou transferência e registre aqui."
          : "O pedido foi cancelado, mas o estorno no gateway não foi concluído."}
      </p>

      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        {manualOnly && <input type="hidden" name="manual" value="on" />}
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="w-fit">
          {pending
            ? "Processando..."
            : manualOnly
              ? "Registrar reembolso manual"
              : "Tentar estorno de novo"}
        </Button>
      </form>

      {state.error && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="mt-2 text-xs text-foreground">Reembolso registrado.</p>}
    </div>
  );
}
