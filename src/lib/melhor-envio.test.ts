import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateBody, parseServices, pickModalities } from "./melhor-envio";
import { optionsFromCarriers, orderShippingLabel } from "./shipping";

// Formato real da resposta do sandbox (resumido).
const response = [
  { id: 1, name: "PAC", price: "24.50", custom_price: "24.50", delivery_time: 8, custom_delivery_time: 8, company: { name: "Correios" } },
  { id: 2, name: "SEDEX", price: "41.20", custom_price: "41.20", delivery_time: 3, custom_delivery_time: 3, company: { name: "Correios" } },
  { id: 3, name: ".Package", price: "22.10", custom_price: "22.10", delivery_time: 9, custom_delivery_time: 9, company: { name: "Jadlog" } },
  { id: 4, name: ".Com", error: "Transportadora não atende este trecho.", company: { name: "Jadlog" } },
];

describe("Melhor Envio (item 18)", () => {
  it("lê os serviços e descarta os que não atendem o CEP", () => {
    const services = parseServices(response);
    assert.deepEqual(services.map((s) => s.name), ["Correios PAC", "Correios SEDEX", "Jadlog .Package"]);
    assert.equal(services[0].price, 24.5);
    assert.equal(services[1].days, 3);
    assert.deepEqual(parseServices({ message: "Unauthenticated." }), []);
  });

  it("Econômico = mais barato; Expresso = mais rápido", () => {
    const picked = pickModalities(parseServices(response))!;
    assert.equal(picked.ECONOMICO.name, "Jadlog .Package");
    assert.equal(picked.EXPRESSO?.name, "Correios SEDEX");
  });

  it("sem serviço mais rápido, não há Expresso", () => {
    const picked = pickModalities([{ id: 1, name: "PAC", price: 20, days: 5 }])!;
    assert.equal(picked.EXPRESSO, null);
    assert.equal(pickModalities([]), null);
  });

  it("monta o pacote com as peças e o seguro pelo valor", () => {
    const body = calculateBody({ fromCep: "01310100", toCep: "20040020", itemCount: 3, subtotal: 300 });
    assert.equal(body.products[0].quantity, 3);
    assert.equal(body.products[0].insurance_value, 100);
    assert.equal(body.to.postal_code, "20040020");
  });
});

describe("optionsFromCarriers", () => {
  const services = parseServices(response);

  it("preço e prazo reais da transportadora", () => {
    const [eco, exp] = optionsFromCarriers(services, 150);
    assert.equal(eco.amount, 22.1);
    assert.equal(eco.estimatedDays, 9);
    assert.equal(eco.label, "Econômico · Jadlog .Package");
    assert.equal(exp.amount, 41.2);
    assert.equal(exp.service, "Correios SEDEX");
  });

  it("Econômico continua grátis a partir de R$ 300; Expresso não", () => {
    const [eco, exp] = optionsFromCarriers(services, 300);
    assert.equal(eco.amount, 0);
    assert.equal(eco.free, true);
    assert.equal(exp.free, false);
  });

  it("rótulo do frete gravado no pedido", () => {
    assert.equal(
      orderShippingLabel({ shippingMethod: "EXPRESSO", shippingService: "Correios SEDEX", shippingDays: 3 }),
      "Expresso · Correios SEDEX · até 3 dias úteis",
    );
    assert.equal(orderShippingLabel({ shippingMethod: "ECONOMICO" }), "Econômico");
  });
});
