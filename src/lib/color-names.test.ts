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

  it("cores da lista 9 e as versões Street / Sport caem na cor base", () => {
    for (const name of ["Lima", "Índigo", "Azul Céu", "Vinho", "Verde Militar", "Cinza Mescla"])
      assert.notEqual(colorToHex(name), UNKNOWN_COLOR, name);
    assert.notEqual(colorToHex("Azul Céu"), colorToHex("Azul"));
    assert.equal(colorToHex("Preto Street"), colorToHex("Preto"));
    assert.equal(colorToHex("Cinza Mescla Street"), colorToHex("Cinza Mescla"));
    assert.equal(colorToHex("Off-white / Lima"), colorToHex("Off-white"));
    assert.equal(colorToHex("Preto / Lima"), colorToHex("Preto"));
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
