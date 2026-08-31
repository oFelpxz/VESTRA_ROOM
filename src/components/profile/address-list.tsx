"use client";

import { useState } from "react";
import {
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/lib/address-actions";
import { formatCep } from "@/lib/format";
import { AddressForm, type AddressInitial } from "@/components/profile/address-form";

export function AddressList({ addresses }: { addresses: AddressInitial[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(addresses.length === 0);

  return (
    <div className="flex flex-col gap-8">
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem endereços cadastrados.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) =>
            editingId === a.id ? (
              <li
                key={a.id}
                className="rounded-sm border border-foreground p-4 sm:col-span-2"
              >
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Editando endereço
                </p>
                <AddressForm initial={a} onSaved={() => setEditingId(null)} />
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="mt-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Cancelar
                </button>
              </li>
            ) : (
              <li
                key={a.id}
                className={`flex flex-col gap-1 rounded-sm border p-4 ${
                  a.isDefault
                    ? "border-foreground bg-secondary/50"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{a.recipient}</p>
                  {a.isDefault && (
                    <span className="shrink-0 rounded-sm bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background">
                      Padrão
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {a.line1}
                  {a.line2 ? ` · ${a.line2}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.city} · {a.state} · CEP {formatCep(a.postalCode)}
                </p>
                {a.phone && (
                  <p className="text-xs text-muted-foreground">{a.phone}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditingId(a.id);
                    }}
                    className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:text-foreground"
                  >
                    Editar
                  </button>
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:text-foreground"
                      >
                        Definir como padrão
                      </button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/60 hover:text-destructive"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {creating ? (
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Novo endereço
          </p>
          <AddressForm onSaved={() => setCreating(false)} />
          {addresses.length > 0 && (
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
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
          className="w-fit rounded-sm border border-foreground/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 hover:border-foreground hover:text-foreground"
        >
          + Adicionar endereço
        </button>
      )}
    </div>
  );
}
