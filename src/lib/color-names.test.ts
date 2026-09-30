import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { colorToHex, UNKNOWN_COLOR } from "./color-names";

describe("colorToHex", () => {
  it("reconhece as cores do catálogo, sem ligar para maiúsculas, acento e hífen", () => {
    for (const name of ["Areia", "Azul", "Bege", "Branco", "Cinza", "Off-white", "Preto", "Verde", "White"])
      assert.notEqual(colorToHex(name), UNKNOWN_COLOR, name);
    assert.equal(colorToHex("Off-white"), colorToHex("off white"));
    assert.equal(colorToHex("LILÁS"), colorToHex("lilas"));
  });

  it("aceita o código da cor", () => {
    assert.equal(colorToHex("#6B1F2A"), "#6b1f2a");
    assert.equal(colorToHex("6b1f2a"), "#6b1f2a");
    assert.equal(colorToHex("#abc"), "#aabbcc");
  });

  it("nome composto: o próprio, ou a cor base dele", () => {
    assert.equal(colorToHex("Azul Marinho"), colorToHex("marinho"));
    assert.notEqual(colorToHex("Azul Marinho"), colorToHex("Azul"));
    assert.equal(colorToHex("Rosa Chiclete"), colorToHex("Rosa"));
    assert.equal(colorToHex("Verde Musgo Escuro"), colorToHex("Verde Musgo"));
  });

  it("nome desconhecido fica neutro", () => {
    assert.equal(colorToHex("Galáxia"), UNKNOWN_COLOR);
  });
});
