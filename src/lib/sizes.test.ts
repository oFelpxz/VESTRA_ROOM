import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortSizes } from "./sizes";

describe("sortSizes", () => {
  it("põe letras na ordem de vestuário, não na do cadastro", () => {
    assert.deepEqual(sortSizes(["G", "GG", "P", "M"]), ["P", "M", "G", "GG"]);
  });

  it("letras, depois números, depois o resto", () => {
    assert.deepEqual(sortSizes(["Único", "42", "M", "38", "PP"]), ["PP", "M", "38", "42", "Único"]);
  });

  it("não altera a lista recebida", () => {
    const sizes = ["G", "P"];
    sortSizes(sizes);
    assert.deepEqual(sizes, ["G", "P"]);
  });
});
