/**
 * Valida um destino de redirecionamento vindo da URL. Só aceita endereço do
 * próprio site: sem isso, o link de login viraria um redirecionador aberto,
 * útil para phishing ("entre no Vestra Room" → site falso).
 *
 * A comparação é pelo host resolvido, o que barra `//evil.com`,
 * `https://evil.com`, `/\evil.com` e `javascript:`. Retorna só o caminho.
 */
export function resolveSafePath(raw: unknown, host: string): string | null {
  if (typeof raw !== "string" || raw === "" || !host) return null;

  let url: URL;
  try {
    url = new URL(raw, `http://${host}`);
  } catch {
    return null;
  }
  if (url.host !== host) return null;
  // Voltar para o próprio login/cadastro só criaria um laço.
  if (url.pathname === "/login" || url.pathname === "/cadastro") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
