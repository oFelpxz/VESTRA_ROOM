"use client";

import { usePathname } from "next/navigation";

// Páginas com chrome próprio (rails / shell próprio):
// não usam o Header/Footer global.
const SELF_CHROME = ["/", "/catalogo"];

export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selfChrome =
    SELF_CHROME.includes(pathname) || pathname.startsWith("/admin");
  if (selfChrome) return null;
  return <>{children}</>;
}
