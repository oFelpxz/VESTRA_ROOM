import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCartWithItems } from "@/lib/cart";
import { calculateShipping } from "@/lib/shipping";
import { formatBRL, formatCep } from "@/lib/format";
import { deleteAddressAction } from "@/lib/address-actions";
import { listMySavedPaymentMethods } from "@/lib/payment-method-actions";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { OrderSummary } from "@/components/checkout/order-summary";
import { AddressForm } from "@/components/checkout/address-form";
import { PaymentStep } from "@/components/checkout/payment-step";

type Step = "address" | "review" | "payment";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; addressId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/checkout");

  const userId = session.user.id;

  const cart = await getActiveCartWithItems(userId);
  const items = cart?.items ?? [];
  if (items.length === 0) {
    redirect("/carrinho");
  }

  const sp = await searchParams;
  const requestedStep = (sp.step as Step) || "address";

  // Endereços do usuário — o padrão vem primeiro e é reaproveitado
  // automaticamente quando nenhum endereço foi escolhido explicitamente.
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const addressId = sp.addressId ?? defaultAddress?.id;

  // Determina o step efetivo (não permite pular sem endereço)
  let step: Step = requestedStep;
  if (step !== "address" && !addressId) step = "address";

  // Endereço selecionado (se aplicável)
  const selectedAddress = addressId
    ? addresses.find((a) => a.id === addressId)
    : undefined;
  if (step !== "address" && !selectedAddress) step = "address";

  const savedMethods =
    step === "payment"
      ? (await listMySavedPaymentMethods()).map((m) => ({
          id: m.id,
          brand: m.brand,
          last4: m.last4,
          expMonth: m.expMonth,
          expYear: m.expYear,
          holderName: m.holderName,
          isDefault: m.isDefault,
        }))
      : [];

  // Totais (para resumo)
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  );
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const shipping = calculateShipping({
    subtotal,
    itemCount,
    postalCode: selectedAddress?.postalCode,
  });
  const total = subtotal + shipping.amount;

  const summaryItems = items.map((i) => ({
    id: i.id,
    productName: i.productVariant.product.name,
    color: i.productVariant.color,
    size: i.productVariant.size,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    imageUrl: i.productVariant.product.images[0]?.url ?? null,
  }));

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA ROOM
      </p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase tracking-tight md:text-5xl">
        Checkout
      </h1>

      <div className="mt-6">
        <CheckoutStepper current={step} addressId={addressId} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          {step === "address" && (
            <AddressStepBlock
              addresses={addresses}
              selectedId={addressId}
            />
          )}

          {step === "review" && selectedAddress && (
            <ReviewStepBlock
              address={selectedAddress}
              subtotal={subtotal}
              shippingAmount={shipping.amount}
              total={total}
            />
          )}

          {step === "payment" && selectedAddress && (
            <div className="flex flex-col gap-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Método de pagamento
              </p>
              <PaymentStep addressId={selectedAddress.id} savedMethods={savedMethods} />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <OrderSummary
            items={summaryItems}
            subtotal={subtotal}
            shipping={shipping.amount}
            shippingReason={shipping.reason}
            total={total}
            estimatedDays={shipping.estimatedDays}
          />
        </aside>
      </div>
    </section>
  );
}

// -------------------- Step 1: Endereço --------------------

function AddressStepBlock({
  addresses,
  selectedId,
}: {
  addresses: {
    id: string;
    recipient: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  }[];
  selectedId?: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Endereço de entrega
        </p>

        {addresses.length === 0 ? (
          <div className="mt-4 rounded-sm border border-dashed border-border p-6 text-sm text-muted-foreground">
            Você ainda não tem endereços cadastrados. Preencha abaixo para
            continuar.
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => {
              const selected = selectedId === a.id;
              return (
                <li
                  key={a.id}
                  className={`relative flex h-full flex-col gap-1 rounded-sm border p-4 transition-colors ${
                    selected
                      ? "border-foreground bg-secondary/50"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {/* Área clicável de seleção — link cobre o card */}
                  <Link
                    href={`/checkout?step=review&addressId=${a.id}`}
                    aria-label={`Selecionar endereço de ${a.recipient}`}
                    className="absolute inset-0 z-0"
                  />

                  <div className="pointer-events-none relative z-10 flex flex-col gap-1">
                    <p className="text-sm font-medium">{a.recipient}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.line1}
                      {a.line2 ? ` · ${a.line2}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.city} · {a.state} · CEP {formatCep(a.postalCode)}
                    </p>
                  </div>

                  <div className="relative z-10 mt-3 flex items-center justify-between">
                    <span className="pointer-events-none text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70">
                      {selected ? "Selecionado" : "Selecionar"}
                    </span>
                    <form action={deleteAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="relative z-10 rounded-sm border border-foreground/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground/60 transition-colors hover:border-destructive hover:text-destructive"
                      >
                        Remover
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {addresses.length === 0 ? "Novo endereço" : "Adicionar outro endereço"}
        </p>
        <div className="mt-4 rounded-sm border border-border p-6">
          <AddressForm redirectStep="review" />
        </div>
      </div>
    </div>
  );
}

// -------------------- Step 2: Revisão --------------------

function ReviewStepBlock({
  address,
  subtotal,
  shippingAmount,
  total,
}: {
  address: {
    id: string;
    recipient: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  subtotal: number;
  shippingAmount: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Entregar em
          </p>
          <Link
            href="/checkout?step=address"
            className="text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground underline-offset-4 hover:underline"
          >
            Trocar
          </Link>
        </div>
        <div className="mt-4 rounded-sm border border-border p-5 text-sm">
          <p className="font-medium">{address.recipient}</p>
          <p className="mt-1 text-muted-foreground">
            {address.line1}
            {address.line2 ? ` · ${address.line2}` : ""}
          </p>
          <p className="text-muted-foreground">
            {address.city} · {address.state} · CEP {formatCep(address.postalCode)}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Valores
        </p>
        <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
          <li className="flex items-baseline justify-between py-3">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </li>
          <li className="flex items-baseline justify-between py-3">
            <span className="text-muted-foreground">Frete</span>
            <span>
              {shippingAmount === 0 ? "Grátis" : formatBRL(shippingAmount)}
            </span>
          </li>
          <li className="flex items-baseline justify-between py-3">
            <span className="font-semibold uppercase tracking-wide">
              Total
            </span>
            <span className="font-heading text-lg font-bold">
              {formatBRL(total)}
            </span>
          </li>
        </ul>
      </div>

      <Link
        href={`/checkout?step=payment&addressId=${address.id}`}
        className="inline-flex h-12 w-fit items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
      >
        Ir para pagamento
      </Link>
    </div>
  );
}
