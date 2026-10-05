"use client";

import { useActionState, useState } from "react";
import {
  advanceOrderStatusAction,
  cancelOrderByAdminAction,
  type LogisticsState,
} from "@/lib/logistics-actions";
import { canAdminCancel, goodsLeftWarehouse } from "@/lib/order-cancel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LogisticsState = {};

type Status =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

const NEXT_BY_STATUS: Record<
  Status,
  { value: Status; label: string; requiresTracking?: boolean } | null
> = {
  PENDING_PAYMENT: null, // pago via webhook
  PAID: { value: "PREPARING", label: "Iniciar preparação" },
  PREPARING: {
    value: "SHIPPED",
    label: "Marcar como enviado",
    requiresTracking: true,
  },
  SHIPPED: { value: "DELIVERED", label: "Marcar como entregue" },
  DELIVERED: null,
  CANCELED: null,
  REFUNDED: null,
};

export function OrderStatusActions({
  orderId,
  status,
  trackingCode,
  isAdmin,
}: {
  orderId: string;
  status: Status;
  trackingCode: string | null;
  /** Cancelar é só do Admin (item 19); o Operador só avança a logística. */
  isAdmin: boolean;
}) {
  const [advanceState, formAction, pending] = useActionState(
    advanceOrderStatusAction,
    initial,
  );
  const [cancelState, cancelAction, canceling] = useActionState(
    cancelOrderByAdminAction,
    initial,
  );
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const next = NEXT_BY_STATUS[status];
  const canCancel = isAdmin && canAdminCancel(status);
  const afterShipping = goodsLeftWarehouse(status);
  // Mostra só a mensagem do último formulário enviado; senão um erro antigo
  // do cancelamento esconderia o resultado de um avanço feito depois.
  const [lastAction, setLastAction] = useState<"advance" | "cancel">("advance");
  const state = lastAction === "cancel" ? cancelState : advanceState;

  if (!next && !canCancel) {
    return (
      <div className="rounded-sm border border-border p-4 text-sm text-muted-foreground">
        {status === "PENDING_PAYMENT"
          ? "Aguardando a confirmação do pagamento."
          : "Pedido em estado final — sem ações disponíveis."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {next && (
        <form
          action={formAction}
          onSubmit={() => setLastAction("advance")}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="newStatus" value={next.value} />

          {next.requiresTracking && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="trackingCode">Código de rastreio</Label>
              <Input
                id="trackingCode"
                name="trackingCode"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="BR123456789"
                required
              />
            </div>
          )}

          {!next.requiresTracking && tracking && (
            <input type="hidden" name="trackingCode" value={tracking} />
          )}

          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="w-full"
          >
            <span className="text-acid">●</span> {pending ? "Processando..." : next.label}
          </Button>
        </form>
      )}

      {canCancel && (
        <form
          action={cancelAction}
          onSubmit={(e) => {
            if (!window.confirm("Cancelar este pedido? Essa ação não pode ser desfeita.")) {
              e.preventDefault();
              return;
            }
            setLastAction("cancel");
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          {afterShipping && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="returnedToStock"
                className="mt-0.5"
              />
              A peça já voltou para o depósito — devolver ao estoque.
            </label>
          )}
          <button
            type="submit"
            disabled={canceling}
            className="w-full rounded-sm border border-foreground/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
          >
            {canceling ? "Cancelando..." : "Cancelar pedido"}
          </button>
        </form>
      )}

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Status atualizado.
        </p>
      )}
    </div>
  );
}
