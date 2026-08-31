"use client";

import { useActionState, useState } from "react";
import {
  createOrderFromCartAction,
  type CheckoutState,
} from "@/lib/order-actions";
import { Button } from "@/components/ui/button";

const initial: CheckoutState = {};

type Method = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "BOLETO";

const OPTIONS: { value: Method; label: string; desc: string }[] = [
  { value: "PIX", label: "PIX", desc: "Aprovação imediata (simulado)" },
  {
    value: "CREDIT_CARD",
    label: "Cartão de crédito",
    desc: "Pagamento à vista (simulado)",
  },
  { value: "DEBIT_CARD", label: "Débito", desc: "Débito em conta (simulado)" },
  {
    value: "BOLETO",
    label: "Boleto",
    desc: "Compensação em ~3 dias úteis (simulado)",
  },
];

type SavedMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  isDefault: boolean;
};

export function PaymentStep({
  addressId,
  savedMethods = [],
}: {
  addressId: string;
  savedMethods?: SavedMethod[];
}) {
  const [state, formAction, pending] = useActionState(
    createOrderFromCartAction,
    initial,
  );
  const [method, setMethod] = useState<Method>("PIX");
  const defaultSaved = savedMethods.find((m) => m.isDefault) ?? savedMethods[0];
  const [selectedCardId, setSelectedCardId] = useState<string | "new" | null>(
    defaultSaved?.id ?? (savedMethods.length === 0 ? "new" : null),
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="addressId" value={addressId} />
      <input type="hidden" name="paymentMethod" value={method} />

      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt) => {
          const selected = method === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition-colors ${
                selected
                  ? "border-foreground bg-secondary/50"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              <input
                type="radio"
                name="method-radio"
                value={opt.value}
                checked={selected}
                onChange={() => setMethod(opt.value)}
                className="mt-1 size-4 accent-foreground"
              />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Painéis específicos por método (simulação visual) */}
      {method === "PIX" && (
        <div className="rounded-sm border border-dashed border-border p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            QR Code simulado
          </p>
          <div className="mt-3 grid aspect-square w-40 place-items-center bg-muted">
            <div className="grid grid-cols-8 gap-0.5">
              {Array.from({ length: 64 }).map((_, i) => (
                <span
                  key={i}
                  className={`size-2 ${
                    (i * 7) % 3 === 0 ? "bg-foreground" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 max-w-xs text-xs text-muted-foreground">
            Após finalizar, o status mudará para PAGO em ~3 segundos.
          </p>
        </div>
      )}

      {method === "CREDIT_CARD" && (
        <div className="rounded-sm border border-dashed border-border p-6">
          {savedMethods.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Cartões salvos
              </p>
              <div className="flex flex-col gap-2">
                {savedMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-sm transition-colors ${
                      selectedCardId === m.id
                        ? "border-foreground bg-secondary/50"
                        : "border-border hover:border-foreground/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-card-radio"
                      checked={selectedCardId === m.id}
                      onChange={() => setSelectedCardId(m.id)}
                      className="size-4 accent-foreground"
                    />
                    <span>
                      {m.brand} •••• {m.last4} — {m.holderName} (val.{" "}
                      {String(m.expMonth).padStart(2, "0")}/{m.expYear})
                    </span>
                  </label>
                ))}
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-sm transition-colors ${
                    selectedCardId === "new"
                      ? "border-foreground bg-secondary/50"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="saved-card-radio"
                    checked={selectedCardId === "new"}
                    onChange={() => setSelectedCardId("new")}
                    className="size-4 accent-foreground"
                  />
                  <span>Usar outro cartão</span>
                </label>
              </div>
            </div>
          )}

          {selectedCardId === "new" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Número do cartão
                </label>
                <input
                  placeholder="4111 1111 1111 1111"
                  className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Validade
                </label>
                <input
                  placeholder="MM/AA"
                  className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  CVV
                </label>
                <input
                  placeholder="123"
                  className="h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
                />
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Os dados não são processados — pagamento é simulado para o MVP.
          </p>
        </div>
      )}

      {method === "BOLETO" && (
        <div className="rounded-sm border border-dashed border-border p-6 text-sm">
          <p className="font-mono text-xs text-foreground/80">
            Código de barras simulado: 23793.38128 60082.901047 81100.000005 9
            12340000000000
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Após finalizar, o pagamento será confirmado em ~3 segundos.
          </p>
        </div>
      )}

      {state.error && (
        <div className="rounded-sm bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">{state.error}</p>
          {state.unavailable && state.unavailable.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {state.unavailable.map((u, i) => (
                <li key={i}>
                  {u.name} · {u.color} · Tam {u.size} → {u.available} disponível(is)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending} size="lg" className="w-fit">
        {pending ? "Finalizando..." : "Finalizar pedido"}
      </Button>
    </form>
  );
}
