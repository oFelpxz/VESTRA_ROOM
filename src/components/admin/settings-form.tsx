"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsFormState } from "@/lib/settings-actions";
import type { EditableSettings } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SettingsFormState = {};

const textareaClass =
  "rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-sm border border-border p-5">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </legend>
      <div className="mt-2 grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  name,
  label,
  hint,
  defaultValue,
  wide,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  wide?: boolean;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? "md:col-span-2" : ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} required {...rest} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsForm({
  settings,
  defaultReturnPolicy,
  defaultPrivacyPolicy,
}: {
  settings: EditableSettings;
  defaultReturnPolicy: string;
  defaultPrivacyPolicy: string;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initialState);
  // No erro, mostra o que foi digitado; senão, o que está salvo (decimais com vírgula).
  const v = (k: keyof EditableSettings) => {
    if (state.values) return state.values[k] ?? "";
    const value = settings[k];
    if (value == null) return "";
    return typeof value === "number" ? String(value).replace(".", ",") : value;
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Section title="Dados da loja">
        <Field name="storeName" label="Nome" defaultValue={v("storeName")} maxLength={80} />
        <Field name="cnpj" label="CNPJ" defaultValue={v("cnpj")} placeholder="00.000.000/0001-00" />
        <Field name="email" label="E-mail de contato" type="email" defaultValue={v("email")} />
        <Field name="phone" label="Telefone" defaultValue={v("phone")} placeholder="(11) 4000-0000" />
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="returnAddress">Endereço para devoluções</Label>
          <textarea
            id="returnAddress"
            name="returnAddress"
            rows={4}
            required
            maxLength={500}
            defaultValue={v("returnAddress")}
            className={textareaClass}
          />
          <p className="text-xs text-muted-foreground">
            Vai nas instruções de envio quando uma troca é aprovada.
          </p>
        </div>
      </Section>

      <Section title="Prazos (dias a partir da entrega)">
        <Field
          name="regretDays"
          label="Arrependimento"
          type="number"
          min={7}
          max={365}
          defaultValue={v("regretDays")}
          hint="Mínimo 7 (Código de Defesa do Consumidor). Reembolso total."
        />
        <Field
          name="exchangeDays"
          label="Troca de tamanho ou cor"
          type="number"
          min={1}
          max={365}
          defaultValue={v("exchangeDays")}
        />
        <Field
          name="defectDays"
          label="Defeito"
          type="number"
          min={90}
          max={730}
          defaultValue={v("defectDays")}
          hint="Mínimo 90 (produto durável)."
        />
        <Field
          name="boletoDays"
          label="Dias para pagar o boleto"
          type="number"
          min={1}
          max={30}
          defaultValue={v("boletoDays")}
        />
      </Section>

      <Section title="Vendas e estoque">
        <Field
          name="freeShippingFrom"
          label="Frete grátis a partir de (R$)"
          inputMode="decimal"
          defaultValue={v("freeShippingFrom")}
          hint="Vale para o frete econômico. 0 = sempre grátis."
        />
        <Field
          name="lowStockThreshold"
          label="Estoque baixo padrão"
          type="number"
          min={0}
          max={1000}
          defaultValue={v("lowStockThreshold")}
          hint="Só para variantes novas; as existentes mantêm o seu."
        />
      </Section>

      <Section title="Provador">
        <Field
          name="fitToleranceCm"
          label="Tolerância do caimento (cm)"
          inputMode="decimal"
          defaultValue={v("fitToleranceCm")}
          hint="Diferença até a qual a peça ainda conta como Regular em cada região. De 0 a 10."
        />
      </Section>

      <fieldset className="rounded-sm border border-border p-5">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Políticas
        </legend>
        <p className="mt-2 text-xs text-muted-foreground">
          Deixe vazio para usar o texto padrão (que já usa os prazos acima). Linha em
          branco separa parágrafos, &quot;## &quot; no começo vira título e &quot;- &quot; vira
          item de lista.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="returnPolicy">Trocas e devoluções (/trocas)</Label>
          <textarea
            id="returnPolicy"
            name="returnPolicy"
            rows={10}
            defaultValue={v("returnPolicy")}
            placeholder={defaultReturnPolicy}
            className={textareaClass}
          />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="privacyPolicy">Privacidade (/privacidade)</Label>
          <textarea
            id="privacyPolicy"
            name="privacyPolicy"
            rows={10}
            defaultValue={v("privacyPolicy")}
            placeholder={defaultPrivacyPolicy}
            className={textareaClass}
          />
        </div>
      </fieldset>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-sm bg-acid/20 px-3 py-2 text-sm text-foreground">
          Configurações salvas.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando..." : "Salvar configurações"}
      </Button>
    </form>
  );
}
