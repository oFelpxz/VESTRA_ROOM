import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_LIME, drawLogo, logoAspect, logoInks } from "./brand-logo";

/** Canvas de mentira: guarda o que foi escrito e com qual cor/fonte. */
function fakeCtx() {
  const texts: { text: string; fill: string; font: string }[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
    textAlign: "start",
    textBaseline: "alphabetic",
    strokes: 0,
    setTransform() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {},
    stroke() {
      ctx.strokes++;
    },
    measureText: (t: string) => ({ width: t.length * 7 }) as TextMetrics,
    fillText(text: string) {
      texts.push({ text, fill: String(ctx.fillStyle), font: ctx.font });
    },
  };
  return { ctx, texts };
}

const fonts = { script: "Marker", label: "Jost" };

describe("logo A1 da VESTRA", () => {
  it("peça escura: palavra e risco em lima, ROOM branco", () => {
    assert.deepEqual(logoInks("#111111"), { word: BRAND_LIME, line: BRAND_LIME, room: "#FFFFFF" });
  });

  it("peça clara: palavra quase preta, risco continua lima", () => {
    const inks = logoInks("#f2efe6");
    assert.equal(inks.word, "#111111");
    assert.equal(inks.line, BRAND_LIME);
  });

  it("peito: só Vestra e o risco, sem ROOM", () => {
    const { ctx, texts } = fakeCtx();
    drawLogo(ctx as never, "peito", 512, logoInks("#000000"), fonts);
    assert.deepEqual(texts.map((t) => t.text), ["Vestra"]);
    assert.match(texts[0].font, /Marker/);
    assert.equal(ctx.strokes, 1);
  });

  it("costas: ROOM letra a letra, centralizado, na fonte de apoio", () => {
    const { ctx, texts } = fakeCtx();
    drawLogo(ctx as never, "costas", 1024, logoInks("#000000"), fonts);
    assert.deepEqual(texts.map((t) => t.text), ["Vestra", "R", "O", "O", "M"]);
    assert.ok(texts.slice(1).every((t) => /Jost/.test(t.font) && t.fill === "#FFFFFF"));
  });

  it("a versão das costas é mais alta (cabe o ROOM)", () => {
    assert.ok(logoAspect("costas") < logoAspect("peito"));
  });
});
