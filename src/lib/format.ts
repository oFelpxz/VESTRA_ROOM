export function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return cep;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}
