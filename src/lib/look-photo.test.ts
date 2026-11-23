import { test } from "node:test";
import assert from "node:assert/strict";
import { coverCrop, lookPhotoLayout, lookPhotoLines } from "./look-photo";

test("frente e costas lado a lado, do mesmo tamanho, abaixo do logo", () => {
  const l = lookPhotoLayout(4);
  assert.equal(l.front.w, l.back.w);
  assert.equal(l.front.y, l.back.y);
  assert.ok(l.front.x + l.front.w < l.back.x);
  assert.equal(l.back.x + l.back.w + l.pad, l.width);
  assert.ok(l.front.y >= l.header.h);
  assert.ok(l.logo.x > 0 && l.logo.x + l.logo.w < l.width && l.logo.y + l.logo.h <= l.header.h);
});

test("a lista fica embaixo das fotos e cabe na imagem", () => {
  const l = lookPhotoLayout(4);
  assert.equal(l.lines.length, 4);
  assert.ok(l.lines[0] > l.front.y + l.front.h);
  assert.ok(l.lines[3] < l.height);
  assert.ok(lookPhotoLayout(2).height < l.height);
});

test("recorte sem distorcer: tira das laterais numa cena larga", () => {
  const c = coverCrop(1600, 900, { w: 720, h: 960 });
  assert.equal(c.h, 900);
  assert.ok(Math.abs(c.w / c.h - 0.75) < 1e-9);
  assert.ok(Math.abs(c.x - (1600 - c.w) / 2) < 1e-9);
});

test("lista: uma linha por peça e a soma quando é look", () => {
  const lines = lookPhotoLines([
    { label: "Track Jacket (Preto / Lima, M)", price: 349.9 },
    { label: "Cargo Pant (Preto, 42)", price: 259.9 },
  ]);
  assert.equal(lines.length, 3);
  assert.equal(lines[2].strong, true);
  assert.match(lines[2].right, /609,80/);
  assert.equal(lookPhotoLines([{ label: "Boxy Tee", price: 99 }]).length, 1);
});
