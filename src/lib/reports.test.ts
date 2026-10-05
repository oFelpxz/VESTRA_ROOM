import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  csvMoney,
  formatDay,
  MAX_REPORT_DAYS,
  parseReportRange,
  stockSituation,
  toCsv,
} from "./reports";

// 05/10/2026 às 22h em Brasília (01h do dia 06 em UTC).
const now = new Date("2026-10-06T01:00:00Z");

describe("parseReportRange", () => {
  it("sem datas: últimos 30 dias, contando hoje no horário de Brasília", () => {
    const r = parseReportRange(undefined, undefined, now);
    assert.equal(r.to, "2026-10-05");
    assert.equal(r.from, "2026-09-06");
    assert.equal(r.days, 30);
    assert.equal(r.notice, undefined);
  });

  it("o período vai da meia-noite do 1º dia até a meia-noite seguinte ao último", () => {
    const r = parseReportRange("2026-10-01", "2026-10-02", now);
    assert.equal(r.start.toISOString(), "2026-10-01T03:00:00.000Z");
    assert.equal(r.end.toISOString(), "2026-10-03T03:00:00.000Z");
    assert.equal(r.days, 2);
  });

  it("um dia só funciona", () => {
    const r = parseReportRange("2026-10-05", "2026-10-05", now);
    assert.equal(r.days, 1);
    assert.equal(r.notice, undefined);
  });

  it("datas invertidas são trocadas, com aviso", () => {
    const r = parseReportRange("2026-10-05", "2026-10-01", now);
    assert.equal(r.from, "2026-10-01");
    assert.equal(r.to, "2026-10-05");
    assert.ok(r.notice);
  });

  it("data final no futuro vira hoje", () => {
    const r = parseReportRange("2026-10-01", "2026-12-31", now);
    assert.equal(r.to, "2026-10-05");
    assert.ok(r.notice);
  });

  it("início no futuro com datas invertidas não passa de hoje", () => {
    const r = parseReportRange("2026-10-09", "2026-10-01", now);
    assert.equal(r.from, "2026-10-01");
    assert.equal(r.to, "2026-10-05");
  });

  it("as duas datas no futuro viram só hoje", () => {
    const r = parseReportRange("2026-11-01", "2026-11-30", now);
    assert.equal(r.from, "2026-10-05");
    assert.equal(r.to, "2026-10-05");
    assert.equal(r.days, 1);
  });

  it("data inexistente ou texto são ignorados, com aviso", () => {
    const r = parseReportRange("2026-02-30", "abc", now);
    assert.equal(r.to, "2026-10-05");
    assert.equal(r.days, 30);
    assert.ok(r.notice);
  });

  it("período longo demais é cortado no máximo", () => {
    const r = parseReportRange("2020-01-01", "2026-10-05", now);
    assert.equal(r.days, MAX_REPORT_DAYS);
    assert.equal(r.to, "2026-10-05");
    assert.ok(r.notice);
  });

  it("parâmetro repetido na URL (lista) não quebra", () => {
    const r = parseReportRange(["2026-10-01", "x"], undefined, now);
    assert.equal(r.days, 30);
  });
});

describe("stockSituation", () => {
  it("0 é esgotado, abaixo do limite é baixo, o resto está ok", () => {
    assert.equal(stockSituation(0, 5), "Esgotado");
    assert.equal(stockSituation(4, 5), "Baixo");
    assert.equal(stockSituation(5, 5), "OK");
  });
});

describe("toCsv", () => {
  it("começa com BOM, usa ; e termina linhas com CRLF", () => {
    const csv = toCsv(["Produto", "Valor"], [["Camiseta", csvMoney(199.9)]]);
    assert.equal(csv, "﻿Produto;Valor\r\nCamiseta;199,90\r\n");
  });

  it("põe entre aspas o que tem ; aspas ou quebra de linha", () => {
    const csv = toCsv(["a"], [['Tee "Core"; preta'], ["linha\n2"]]);
    assert.ok(csv.includes('"Tee ""Core""; preta"'));
    assert.ok(csv.includes('"linha\n2"'));
  });

  it("texto que viraria fórmula no Excel ganha um apóstrofo", () => {
    const csv = toCsv(["nome"], [["=HYPERLINK(1)"], ["@soma"], ["-2+3"]]);
    assert.ok(csv.includes("'=HYPERLINK(1)"));
    assert.ok(csv.includes("'@soma"));
    assert.ok(csv.includes("'-2+3"));
  });

  it("número e vazio", () => {
    assert.equal(toCsv(["a", "b", "c"], [[3, null, undefined]]).split("\r\n")[1], "3;;");
  });

  it("formatDay", () => {
    assert.equal(formatDay("2026-10-05"), "05/10/2026");
  });
});
