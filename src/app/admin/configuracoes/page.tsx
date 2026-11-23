import { SettingsForm } from "@/components/admin/settings-form";
import { defaultPrivacyPolicy, defaultReturnPolicy } from "@/lib/policies";
import { getStoreSettings } from "@/lib/store-settings-db";

export default async function AdminConfiguracoesPage() {
  const settings = await getStoreSettings();

  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Configurações
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dados da loja, prazos, políticas e provador. As mudanças valem na hora para
        toda a loja.
      </p>
      <div className="mt-8">
        <SettingsForm
          settings={settings}
          defaultReturnPolicy={defaultReturnPolicy(settings)}
          defaultPrivacyPolicy={defaultPrivacyPolicy(settings)}
        />
      </div>
    </div>
  );
}
