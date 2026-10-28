import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SKIN_TONE, SKIN_TONES, isSkinTone, skinTone } from "./skin-tones";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test("6 tons, ids únicos, do mais claro ao mais escuro", () => {
  assert.equal(SKIN_TONES.length, 6);
  assert.equal(new Set(SKIN_TONES.map((t) => t.id)).size, 6);
  for (let i = 1; i < SKIN_TONES.length; i++)
    assert.ok(luminance(SKIN_TONES[i].color) < luminance(SKIN_TONES[i - 1].color), SKIN_TONES[i].id);
});

test("o brilho da borda é mais fechado que a pele nos tons escuros", () => {
  for (const t of SKIN_TONES.slice(3)) assert.ok(luminance(t.sheen) < luminance(t.color) * 1.2, t.id);
});

test("íris castanha, mais escura que a pele e mais fechada nos tons escuros (lista 12)", () => {
  for (const t of SKIN_TONES) assert.ok(luminance(t.iris) < luminance(t.color) * 0.6, t.id);
  for (let i = 1; i < SKIN_TONES.length; i++)
    assert.ok(luminance(SKIN_TONES[i].iris) <= luminance(SKIN_TONES[i - 1].iris), SKIN_TONES[i].id);
});

test("sem escolha, ou tom que não existe mais, vale o padrão", () => {
  assert.equal(skinTone(null).id, DEFAULT_SKIN_TONE);
  assert.equal(skinTone("t9").id, DEFAULT_SKIN_TONE);
  assert.equal(skinTone("t5").color, "#7a5440");
  assert.equal(skinTone(DEFAULT_SKIN_TONE).color, "#d9bba4");
});

test("só aceita os ids da lista", () => {
  assert.equal(isSkinTone("t1"), true);
  assert.equal(isSkinTone("#ffffff"), false);
  assert.equal(isSkinTone(3), false);
});
