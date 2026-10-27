import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_LOOKS,
  brandLookBySlug,
  brandLookOutfit,
  brandLookPieces,
  brandLookStart,
  brandLookTotal,
  brandLookTryOnHref,
  brandLooksWith,
  lineOfTop,
} from "./brand-looks";

test("4 looks: 2 Street e 2 Sport, slugs únicos", () => {
  assert.equal(BRAND_LOOKS.length, 4);
  assert.equal(BRAND_LOOKS.filter((l) => l.line === "street").length, 2);
  assert.equal(BRAND_LOOKS.filter((l) => l.line === "sport").length, 2);
  assert.equal(new Set(BRAND_LOOKS.map((l) => l.slug)).size, 4);
});

test("a cor da peça de cima é da linha do look", () => {
  for (const look of BRAND_LOOKS) assert.equal(lineOfTop(look), look.line, look.slug);
});

test("peças: cima, baixo e a touca quando tem", () => {
  const dia = brandLookBySlug("street-dia")!;
  assert.deepEqual(brandLookPieces(dia).map((p) => p.product), ["boxy-tee-01", "wide-denim"]);
  const noite = brandLookBySlug("street-noite")!;
  assert.equal(brandLookPieces(noite).length, 3);
  assert.equal(brandLookBySlug("nao-existe"), null);
});

test("looks que levam um produto", () => {
  assert.deepEqual(brandLooksWith("track-jacket").map((l) => l.slug), ["sport-pista", "sport-verao"]);
  assert.deepEqual(brandLooksWith("knit-beanie").length, 3);
  assert.deepEqual(brandLooksWith("saia-midi-plissada"), []);
});

test("look no manequim: cada peça no seu lugar, com cor e estampa", () => {
  const outfit = brandLookOutfit([
    { role: "top", modelUrl: "/models/track_jacket.glb", color: "Preto / Lima" },
    { role: "bottom", modelUrl: "/models/cargo.glb", color: "Preto" },
    { role: "accessory", modelUrl: "/models/beanie.glb", color: "Lima" },
  ])!;
  assert.equal(outfit.top?.url, "/models/track_jacket.glb");
  assert.equal(outfit.top?.look, "sport");
  assert.equal(outfit.bottom?.look, null);
  assert.match(outfit.accessory!.color, /^#/);
});

test("look no manequim: sem o 3D de uma peça não veste", () => {
  assert.equal(
    brandLookOutfit([
      { role: "top", modelUrl: "/models/boxy.glb", color: "Off-white Street" },
      { role: "bottom", modelUrl: null, color: "Índigo" },
    ]),
    null,
  );
  assert.equal(brandLookOutfit([{ role: "accessory", modelUrl: "/models/beanie.glb", color: "Lima" }]), null);
});

test("preço do look é a soma das peças, sem desconto", () => {
  assert.equal(brandLookTotal([199.9, 249.9, 89.9]), 539.7);
  assert.equal(brandLookTotal([]), 0);
});

test("experimentar o look abre o provador da peça de cima", () => {
  assert.equal(brandLookTryOnHref(brandLookBySlug("sport-verao")!), "/produto/track-jacket/provador?marca=sport-verao");
});

test("provador aberto no look: cor da peça, a outra peça e a touca", () => {
  const offered = [
    { id: "c1", slug: "cargo-pant-02", colors: ["Preto", "Verde Militar"] },
    { id: "b1", slug: "knit-beanie", colors: ["Preto", "Lima"] },
  ];
  const start = brandLookStart(brandLookBySlug("sport-pista")!, "track-jacket", offered)!;
  assert.equal(start.ownColor, "Preto / Lima");
  assert.deepEqual(start.companion, { productId: "c1", color: "Preto" });
  assert.deepEqual(start.accessory, { productId: "b1", color: "Lima" });
});

test("provador da peça de baixo: a outra é a de cima", () => {
  const offered = [{ id: "h1", slug: "hoodie-core", colors: ["Preto Street"] }];
  const start = brandLookStart(brandLookBySlug("street-noite")!, "cargo-pant-02", offered)!;
  assert.equal(start.ownColor, "Verde Militar");
  assert.deepEqual(start.companion, { productId: "h1", color: "Preto Street" });
  assert.equal(start.accessory, null);
});

test("provador fora do look, ou peça sem a cor à venda, não entra", () => {
  assert.equal(brandLookStart(brandLookBySlug("street-dia")!, "track-jacket", []), null);
  const start = brandLookStart(brandLookBySlug("street-dia")!, "boxy-tee-01", [
    { id: "w1", slug: "wide-denim", colors: ["Preto"] },
  ])!;
  assert.equal(start.companion, null);
});
