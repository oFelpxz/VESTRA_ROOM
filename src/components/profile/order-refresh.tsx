"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Faz refresh do server component a cada N segundos
 * enquanto o pedido não estiver em um estado terminal.
 */
export function OrderRefresh({
  status,
  intervalMs = 10000,
}: {
  status: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const terminal = status === "DELIVERED" || status === "CANCELED" || status === "REFUNDED";

  useEffect(() => {
    if (terminal) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [terminal, intervalMs, router]);

  return null;
}
