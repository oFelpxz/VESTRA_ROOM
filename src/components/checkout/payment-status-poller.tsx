"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = {
  orderStatus: string;
  paymentStatus: string | null;
};

export function PaymentStatusPoller({
  orderId,
  initial,
}: {
  orderId: string;
  initial: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => {
    if (status.paymentStatus === "PAID") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/simulate?orderId=${orderId}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        setStatus(data);
        if (data.paymentStatus === "PAID") {
          router.refresh();
        }
      } catch {
        // ignora
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [orderId, status.paymentStatus, router]);

  const paid = status.paymentStatus === "PAID";

  return (
    <div
      className={`flex items-center gap-3 rounded-sm border p-4 ${
        paid
          ? "border-acid bg-acid/10"
          : "border-border bg-muted/40"
      }`}
    >
      <span
        className={`inline-block size-2 rounded-full ${
          paid ? "bg-acid" : "animate-pulse bg-muted-foreground"
        }`}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {paid ? "Pagamento confirmado" : "Aguardando confirmação..."}
        </p>
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Status atual · {status.paymentStatus ?? "desconhecido"}
        </p>
      </div>
    </div>
  );
}
