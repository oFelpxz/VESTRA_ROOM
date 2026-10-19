import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { companionKind, lookRoles, parseLookName, LOOK_NAME_LIMIT } from "./looks";

describe("parseLookName", () => {
  it("limpa espaços e exige nome", () => {
    assert.deepEqual(parseLookName("  Look   de sábado "), { name: "Look de sábado" });
    assert.ok("error" in parseLookName("   "));
    assert.ok("error" in parseLookName(null));
  });

  it("limita o tamanho", () => {
    assert.ok("name" in parseLookName("a".repeat(LOOK_NAME_LIMIT)));
    assert.ok("error" in parseLookName("a".repeat(LOOK_NAME_LIMIT + 1)));
  });
});

describe("lookRoles", () => {
  it("põe cada peça no seu lugar, em qualquer ordem", () => {
    const top = { kind: "top" as const, value: "camiseta" };
    const bottom = { kind: "bottom" as const, value: "calça" };
    assert.deepEqual(lookRoles(top, bottom), { top: "camiseta", bottom: "calça" });
    assert.deepEqual(lookRoles(bottom, top), { top: "camiseta", bottom: "calça" });
  });

  it("recusa duas de cima, vestido ou acessório", () => {
    assert.equal(lookRoles({ kind: "top", value: 1 }, { kind: "top", value: 2 }), null);
    assert.equal(lookRoles({ kind: "dress", value: 1 }, { kind: "bottom", value: 2 }), null);
    assert.equal(lookRoles({ kind: "other", value: 1 }, { kind: "top", value: 2 }), null);
  });
});

describe("companionKind", () => {
  it("de cima pede de baixo e vice-versa", () => {
    assert.equal(companionKind("top"), "bottom");
    assert.equal(companionKind("bottom"), "top");
    assert.equal(companionKind("dress"), null);
  });
});
