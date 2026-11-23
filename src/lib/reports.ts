/**
 * Relatórios do Admin (item 24). Funções puras — período, situação do
 * estoque e montagem do CSV — para poder testar sem banco.
 */

import { spDayKey } from "@/lib/dashboard";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mesmo fuso fixo do painel: Brasília, -03:00, sem horário de verão. */
const SP_OFFSET = "-03:00";
/** Período máximo de um relatório, para a consulta não ficar pesada. */
export const MAX_REPORT_DAYS = 366;
export const DEFAULT_REPORT_DAYS = 30;

export type ReportRange = {
  /** AAAA-MM-DD, dias de Brasília, inclusivos. */
  from: string;
  to: string;
  /** Instantes UTC para a consulta: start <= createdAt < end. */
  start: Date;
  end: Date;
  days: number;
  /** Aviso quando o período pedido foi corrigido. */
  notice?: string;
};

function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function spMidnight(day: string) {
  return new Date(`${day}T00:00:00${SP_OFFSET}`);
}

function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * `?de=AAAA-MM-DD&ate=AAAA-MM-DD`. Sem datas: últimos 30 dias até hoje.
 * Datas inválidas, invertidas, no futuro ou período longo demais são
 * corrigidos, com um aviso.
 */
export function parseReportRange(
  rawFrom: unknown,
  rawTo: unknown,
  now: Date,
): ReportRange {
  const today = spDayKey(now);
  const notices: string[] = [];

  let to = isDay(rawTo) ? rawTo : today;
  if (rawTo !== undefined && rawTo !== "" && !isDay(rawTo)) {
    notices.push("Data final inválida; usamos hoje.");
  }

  let from = isDay(rawFrom) ? rawFrom : addDays(to, -(DEFAULT_REPORT_DAYS - 1));
  if (rawFrom !== undefined && rawFrom !== "" && !isDay(rawFrom)) {
    notices.push(`Data inicial inválida; usamos ${DEFAULT_REPORT_DAYS} dias.`);
  }
  if (from > to) {
    [from, to] = [to, from];
    notices.push("As datas estavam invertidas; trocamos a ordem.");
  }
  if (to > today) {
    to = today;
    notices.push("O período não pode passar de hoje; usamos hoje no fim.");
  }
  if (from > today) from = today;

  let days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  if (days > MAX_REPORT_DAYS) {
    from = addDays(to, -(MAX_REPORT_DAYS - 1));
    days = MAX_REPORT_DAYS;
    notices.push(`O período máximo é de ${MAX_REPORT_DAYS} dias.`);
  }

  return {
    from,
    to,
    start: spMidnight(from),
    end: spMidnight(addDays(to, 1)),
    days,
    ...(notices.length > 0 ? { notice: notices.join(" ") } : {}),
  };
}

/** DD/MM/AAAA a partir de AAAA-MM-DD. */
export function formatDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export type StockSituation = "Esgotado" | "Baixo" | "OK";

/** Mesma regra da tela de Estoque: abaixo do limite é baixo; 0 é esgotado. */
export function stockSituation(quantity: number, threshold: number): StockSituation {
  if (quantity <= 0) return "Esgotado";
  if (quantity < threshold) return "Baixo";
  return "OK";
}

/** Número com vírgula e 2 casas, sem "R$", para o Excel somar a coluna. */
export function csvMoney(value: number) {
  return value.toFixed(2).replace(".", ",");
}

type Cell = string | number | null | undefined;

function csvCell(value: Cell) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Texto digitado por cliente (nome, cupom) começando com = + - @ viraria
  // fórmula no Excel. Números da própria loja passam direto.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV no formato que o Excel em português abre direto: separador ";",
 * vírgula decimal e BOM no início para os acentos aparecerem certos.
 */
export function toCsv(header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
