"use client";

import { useActionState, useState } from "react";
import {
  advanceOrderStatusAction,
  type LogisticsState,
} from "@/lib/logistics-actions";
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
}: {
  orderId: string;
  status: Status;
  trackingCode: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    advanceOrderStatusAction,
    initial,
  );
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const next = NEXT_BY_STATUS[status];
  const canCancel = ["PENDING_PAYMENT", "PAID", "PREPARING"].includes(status);

  if (!next && !canCancel) {
    return (
      <div className="rounded-sm border border-border p-4 text-sm text-muted-foreground">
        Pedido em estado final — sem ações disponíveis.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {next && (
        <form action={formAction} className="flex flex-col gap-3">
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
        <form action={formAction}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="newStatus" value="CANCELED" />
          <button
            type="submit"
            className="w-full rounded-sm border border-foreground/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
          >
            Cancelar pedido
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
