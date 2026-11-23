import type { Metadata } from "next";
import { PolicyText } from "@/components/marketing/policy-text";
import { defaultReturnPolicy } from "@/lib/policies";
import { getStoreSettings } from "@/lib/store-settings-db";

export const metadata: Metadata = { title: "Trocas e devoluções" };

export default async function TrocasPage() {
  const settings = await getStoreSettings();
  const text = settings.returnPolicy ?? defaultReturnPolicy(settings);

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Política
      </p>
      <h1 className="font-heading mt-3 text-4xl font-bold uppercase tracking-tight md:text-6xl">
        Trocas e devoluções
      </h1>
      <div className="mt-8">
        <PolicyText text={text} />
      </div>
    </section>
  );
}
