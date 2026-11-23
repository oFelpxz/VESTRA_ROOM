import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cepDigits, formatCep, lookupCep, parseBrasilApi, parseViaCep } from "./cep";

const viaCep = {
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  bairro: "Bela Vista",
  localidade: "São Paulo",
  uf: "SP",
};

describe("máscara do CEP", () => {
  it("formata enquanto digita", () => {
    assert.equal(formatCep("01310"), "01310");
    assert.equal(formatCep("013101"), "01310-1");
    assert.equal(formatCep("01310100"), "01310-100");
  });

  it("ignora o que não é número e corta em 8 dígitos", () => {
    assert.equal(cepDigits("01.310-100 999"), "01310100");
    assert.equal(formatCep("ab01310100"), "01310-100");
  });
});

describe("respostas dos serviços", () => {
  it("lê o ViaCEP", () => {
    assert.deepEqual(parseViaCep(viaCep), {
      street: "Avenida Paulista",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
  });

  it("ViaCEP com erro é CEP inexistente", () => {
    assert.equal(parseViaCep({ erro: true }), null);
    assert.equal(parseViaCep({ erro: "true" }), null);
  });

  it("CEP de cidade pequena vem sem rua, mas vale", () => {
    const a = parseViaCep({ logradouro: "", bairro: "", localidade: "Borá", uf: "SP" });
    assert.equal(a?.street, "");
    assert.equal(a?.city, "Borá");
  });

  it("lê a BrasilAPI", () => {
    const a = parseBrasilApi({
      street: "Avenida Paulista",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "sp",
    });
    assert.equal(a?.state, "SP");
  });
});

const respond = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("lookupCep", () => {
  it("acha no ViaCEP sem chamar a BrasilAPI", async () => {
    const urls: string[] = [];
    const r = await lookupCep("01310-100", {
      fetch: (url) => {
        urls.push(url);
        return respond(200, viaCep);
      },
    });
    assert.equal(r.ok && r.address.city, "São Paulo");
    assert.deepEqual(urls, ["https://viacep.com.br/ws/01310100/json/"]);
  });

  it("ViaCEP fora do ar: usa a BrasilAPI", async () => {
    const r = await lookupCep("01310100", {
      fetch: (url) =>
        url.includes("viacep")
          ? Promise.reject(new Error("rede"))
          : respond(200, { street: "Av. Paulista", city: "São Paulo", state: "SP" }),
    });
    assert.equal(r.ok && r.address.street, "Av. Paulista");
  });

  it("CEP que não existe", async () => {
    const r = await lookupCep("99999999", {
      fetch: (url) => (url.includes("viacep") ? respond(200, { erro: true }) : respond(404, {})),
    });
    assert.deepEqual(r, { ok: false, reason: "not_found" });
  });

  it("os dois fora do ar", async () => {
    const r = await lookupCep("01310100", { fetch: () => Promise.reject(new Error("rede")) });
    assert.deepEqual(r, { ok: false, reason: "unavailable" });
  });

  it("CEP incompleto nem consulta", async () => {
    let called = false;
    const r = await lookupCep("0131", {
      fetch: () => {
        called = true;
        return respond(200, viaCep);
      },
    });
    assert.equal(r.ok, false);
    assert.equal(called, false);
  });
});
