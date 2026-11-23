/**
 * Para onde mandar o cliente depois do login (`/login?next=/checkout`).
 *
 * Só aceita um caminho desta loja: um link de fora (`?next=https://golpe.com`
 * ou `//golpe.com`) viraria um redirecionamento aberto. O NextAuth manda o
 * endereço completo em `callbackUrl`; dele fica só o caminho.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/perfil"): string {
  const value = raw?.trim();
  if (!value) return fallback;
  let url: URL;
  try {
    url = new URL(value, "http://loja.invalid");
  } catch {
    return fallback;
  }
  // Caminho relativo: precisa começar com uma barra só (não "//" nem "/\").
  const relative = !/^[a-z][a-z\d+.-]*:/i.test(value);
  if (relative && (!value.startsWith("/") || /^\/[/\\]/.test(value))) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Voltar para o login ou o cadastro prenderia o cliente num laço.
  if (url.pathname === "/login" || url.pathname === "/cadastro") return fallback;
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
