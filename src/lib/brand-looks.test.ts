import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_LOOKS,
  brandLookBySlug,
  brandLookPieces,
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
