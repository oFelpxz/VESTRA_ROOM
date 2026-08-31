"use client";

import { useState } from "react";
import {
  deleteSavedPaymentMethodAction,
  setDefaultSavedPaymentMethodAction,
} from "@/lib/payment-method-actions";
import { PaymentMethodForm } from "@/components/profile/payment-method-form";

export type SavedPaymentMethodItem = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  isDefault: boolean;
};

export function PaymentMethodList({
  methods,
}: {
  methods: SavedPaymentMethodItem[];
}) {
  const [creating, setCreating] = useState(methods.length === 0);

  return (
    <div className="flex flex-col gap-8">
      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem cartões salvos.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <li
              key={m.id}
              className={`flex flex-col gap-1 rounded-sm border p-4 ${
                m.isDefault ? "border-foreground bg-secondary/50" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {m.brand} •••• {m.last4}
                </p>
                {m.isDefault && (
                  <span className="shrink-0 rounded-sm bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background">
                    Padrão
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{m.holderName}</p>
              <p className="text-xs text-muted-foreground">
                Validade {String(m.expMonth).padStart(2, "0")}/{m.expYear}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!m.isDefault && (
                  <form action={setDefaultSavedPaymentMethodAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:text-foreground"
                    >
                      Definir como padrão
                    </button>
                  </form>
                )}
                <form action={deleteSavedPaymentMethodAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/60 hover:text-destructive"
                  >
                    Remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Novo cartão
          </p>
          <PaymentMethodForm onSaved={() => setCreating(false)} />
          {methods.length > 0 && (
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="mt-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancelar
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-fit rounded-sm border border-foreground/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:border-foreground hover:text-foreground"
        >
          + Adicionar cartão
        </button>
      )}
    </div>
  );
}
