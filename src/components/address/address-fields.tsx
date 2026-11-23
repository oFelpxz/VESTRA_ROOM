"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { cepDigits, formatCep, lookupCep } from "@/lib/cep";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AddressValues = {
  recipient: string;
  postalCode: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  phone: string;
};

type CepStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; text: string }
  | { kind: "error"; text: string };

/**
 * Campos do endereço, usados no checkout e no perfil. Ao completar o CEP, a
 * rua, a cidade e a UF são preenchidas (ViaCEP, ver `lookupCep`) e o cursor
 * vai para o fim da rua, para o cliente digitar o número.
 *
 * Os campos são controlados: o formulário que usa este componente deve
 * enviar com `onSubmit` (sem o `action` do form), senão o React 19 limpa os
 * campos depois de um erro de validação.
 */
export function AddressFields({ initial }: { initial?: Partial<AddressValues> }) {
  const [values, setValues] = useState<AddressValues>({
    recipient: initial?.recipient ?? "",
    postalCode: formatCep(initial?.postalCode ?? ""),
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    phone: initial?.phone ?? "",
  });
  const [cep, setCep] = useState<CepStatus>({ kind: "idle" });
  const line1Ref = useRef<HTMLInputElement>(null);
  // Rua que o CEP preencheu: se o cliente não mexeu nela, um CEP novo pode trocá-la.
  const autoLine1 = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  // Valores atuais para a resposta do CEP, que chega depois do clique.
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  });

  const set = (field: keyof AddressValues) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  useEffect(() => () => pending.current?.abort(), []);

  async function onCepChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = formatCep(e.target.value);
    const digits = cepDigits(masked);
    const changed = digits !== cepDigits(values.postalCode);
    setValues((v) => ({ ...v, postalCode: masked }));
    if (!changed) return;

    pending.current?.abort();
    if (digits.length !== 8) {
      setCep({ kind: "idle" });
      return;
    }

    const controller = new AbortController();
    pending.current = controller;
    setCep({ kind: "loading" });
    const result = await lookupCep(digits, { signal: controller.signal });
    if (controller.signal.aborted) return;

    if (!result.ok) {
      setCep({
        kind: "error",
        text:
          result.reason === "not_found"
            ? "Não achamos esse CEP. Confira os números ou preencha o endereço à mão."
            : "Não deu para buscar o CEP agora. Preencha o endereço à mão.",
      });
      return;
    }

    const { street, district, city, state } = result.address;
    const line1 = street ? `${street}, ` : null;
    // Só troca a rua se ela estiver vazia ou ainda for a que o CEP preencheu:
    // não apaga o que o cliente digitou.
    const current = latest.current.line1;
    const fillLine1 =
      line1 !== null && (current.trim() === "" || current === autoLine1.current);
    setValues((v) => ({ ...v, city, state, line1: fillLine1 && line1 ? line1 : v.line1 }));
    if (fillLine1) autoLine1.current = line1;
    setCep({
      kind: "found",
      text: [district, `${city}/${state}`].filter(Boolean).join(" · "),
    });

    // Cursor no fim da rua, depois da vírgula: falta só o número.
    requestAnimationFrame(() => {
      const input = line1Ref.current;
      if (!input || !fillLine1) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="recipient">Destinatário</Label>
        <Input
          id="recipient"
          name="recipient"
          required
          autoComplete="name"
          value={values.recipient}
          onChange={set("recipient")}
          placeholder="Nome completo"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="postalCode">CEP</Label>
        <Input
          id="postalCode"
          name="postalCode"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          value={values.postalCode}
          onChange={onCepChange}
          placeholder="00000-000"
          maxLength={9}
          aria-describedby="cep-status"
        />
      </div>
      <p
        id="cep-status"
        aria-live="polite"
        className={`self-end pb-2 text-xs ${
          cep.kind === "error" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {cep.kind === "loading"
          ? "Buscando o endereço..."
          : cep.kind === "found" || cep.kind === "error"
            ? cep.text
            : "Digite o CEP para preencher o endereço."}
      </p>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="line1">Endereço</Label>
        <Input
          id="line1"
          name="line1"
          ref={line1Ref}
          required
          autoComplete="address-line1"
          value={values.line1}
          onChange={set("line1")}
          placeholder="Rua, número"
        />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        <Label htmlFor="line2">Complemento</Label>
        <Input
          id="line2"
          name="line2"
          autoComplete="address-line2"
          value={values.line2}
          onChange={set("line2")}
          placeholder="Apto, bloco — opcional"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="city">Cidade</Label>
        <Input
          id="city"
          name="city"
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={set("city")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="state">UF</Label>
        <Input
          id="state"
          name="state"
          required
          maxLength={2}
          autoComplete="address-level1"
          value={values.state}
          onChange={(e) => setValues((v) => ({ ...v, state: e.target.value.toUpperCase() }))}
          placeholder="SP"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={set("phone")}
          placeholder="Opcional"
        />
      </div>
    </div>
  );
}
