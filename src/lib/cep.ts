/**
 * Busca de endereço pelo CEP, para preencher o formulário de endereço.
 *
 * Consulta o ViaCEP e, se ele estiver fora, a BrasilAPI — dois serviços
 * públicos e gratuitos, sem chave. A consulta sai do navegador do cliente e
 * leva só o CEP. Sem prisma: roda no navegador e nos testes.
 */

export type CepAddress = {
  /** Rua; vazio em CEP de cidade pequena (um CEP para a cidade toda). */
  street: string;
  district: string;
  city: string;
  state: string;
};

export type CepResult =
  | { ok: true; address: CepAddress }
  | { ok: false; reason: "not_found" | "unavailable" };

/** Só os dígitos, no máximo 8. */
export function cepDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

/** Máscara 00000-000 enquanto o cliente digita. */
export function formatCep(raw: string): string {
  const d = cepDigits(raw);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function complete(a: CepAddress): CepAddress | null {
  return a.city && /^[A-Z]{2}$/.test(a.state) ? a : null;
}

/** Resposta do ViaCEP (`{ erro: true }` quando o CEP não existe). */
export function parseViaCep(json: unknown): CepAddress | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  if (j.erro === true || j.erro === "true") return null;
  return complete({
    street: text(j.logradouro),
    district: text(j.bairro),
    city: text(j.localidade),
    state: text(j.uf).toUpperCase(),
  });
}

/** Resposta da BrasilAPI (`/api/cep/v1/{cep}`). */
export function parseBrasilApi(json: unknown): CepAddress | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  return complete({
    street: text(j.street),
    district: text(j.neighborhood),
    city: text(j.city),
    state: text(j.state).toUpperCase(),
  });
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/**
 * Procura o CEP (8 dígitos). "not_found": o serviço respondeu que o CEP não
 * existe; "unavailable": nenhum dos dois respondeu (sem internet, fora do ar).
 */
export async function lookupCep(
  cep: string,
  opts: { fetch?: Fetch; signal?: AbortSignal } = {},
): Promise<CepResult> {
  const digits = cepDigits(cep);
  if (digits.length !== 8) return { ok: false, reason: "not_found" };
  const get = opts.fetch ?? ((url, init) => fetch(url, init));
  const sources: [string, (json: unknown) => CepAddress | null][] = [
    [`https://viacep.com.br/ws/${digits}/json/`, parseViaCep],
    [`https://brasilapi.com.br/api/cep/v1/${digits}`, parseBrasilApi],
  ];

  let answered = false;
  for (const [url, parse] of sources) {
    if (opts.signal?.aborted) break;
    try {
      const res = await get(url, { signal: opts.signal });
      // ViaCEP responde 400 para CEP mal formado; BrasilAPI, 404 para o que não existe.
      if (res.status === 400 || res.status === 404) {
        answered = true;
        continue;
      }
      if (!res.ok) continue;
      const address = parse(await res.json());
      if (address) return { ok: true, address };
      answered = true;
    } catch {
      // Fora do ar ou cancelado: tenta o próximo.
    }
  }
  return { ok: false, reason: answered ? "not_found" : "unavailable" };
}
