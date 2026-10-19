import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, parseSettingsForm, SETTINGS_FIELDS } from "./store-settings";
import { defaultPrivacyPolicy, defaultReturnPolicy, parsePolicy } from "./policies";

function form(over: Record<string, string> = {}) {
  const base = Object.fromEntries(
    SETTINGS_FIELDS.map((f) => [f, String(DEFAULT_SETTINGS[f] ?? "")]),
  );
  return { ...base, ...over };
}

describe("parseSettingsForm (item 25)", () => {
  it("aceita os valores padrão", () => {
    const r = parseSettingsForm(form());
    assert.ok("data" in r);
    assert.deepEqual(r.data, DEFAULT_SETTINGS);
  });

  it("aceita vírgula decimal e arredonda", () => {
    const r = parseSettingsForm(form({ freeShippingFrom: "249,999", fitToleranceCm: "1,25" }));
    assert.ok("data" in r);
    assert.equal(r.data.freeShippingFrom, 250);
    assert.equal(r.data.fitToleranceCm, 1.3);
  });

  it("política vazia vira null (texto padrão)", () => {
    const r = parseSettingsForm(form({ returnPolicy: "   ", privacyPolicy: "Texto" }));
    assert.ok("data" in r);
    assert.equal(r.data.returnPolicy, null);
    assert.equal(r.data.privacyPolicy, "Texto");
  });

  it("barra arrependimento abaixo de 7 dias e defeito abaixo de 90", () => {
    assert.ok("error" in parseSettingsForm(form({ regretDays: "6" })));
    assert.ok("error" in parseSettingsForm(form({ defectDays: "30" })));
  });

  it("barra número não inteiro nos prazos", () => {
    const r = parseSettingsForm(form({ exchangeDays: "10,5" }));
    assert.ok("error" in r && r.error.includes("inteiro"));
  });

  it("barra CNPJ, e-mail e telefone inválidos", () => {
    assert.ok("error" in parseSettingsForm(form({ cnpj: "123" })));
    assert.ok("error" in parseSettingsForm(form({ email: "sem-arroba" })));
    assert.ok("error" in parseSettingsForm(form({ phone: "4000" })));
  });

  it("barra tolerância fora de 0 a 10 cm", () => {
    assert.ok("error" in parseSettingsForm(form({ fitToleranceCm: "11" })));
    assert.ok("error" in parseSettingsForm(form({ fitToleranceCm: "-1" })));
  });
});

describe("políticas padrão (item 25)", () => {
  it("usam os prazos e o e-mail das configurações", () => {
    const s = { ...DEFAULT_SETTINGS, regretDays: 10, email: "a@b.com" };
    const text = defaultReturnPolicy(s);
    assert.ok(text.includes("10 dias"));
    assert.ok(text.includes("a@b.com"));
    assert.ok(defaultPrivacyPolicy(s).includes("a@b.com"));
  });

  it("parsePolicy separa títulos, parágrafos e listas", () => {
    const blocks = parsePolicy("## Título\nlinha 1\nlinha 2\n- a\n- b\n\nfim");
    assert.deepEqual(blocks, [
      { kind: "heading", text: "Título" },
      { kind: "paragraph", text: "linha 1 linha 2" },
      { kind: "list", items: ["a", "b"] },
      { kind: "paragraph", text: "fim" },
    ]);
  });
});
