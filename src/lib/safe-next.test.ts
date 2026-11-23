import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("aceita um caminho da loja, com busca", () => {
    assert.equal(safeNextPath("/checkout"), "/checkout");
    assert.equal(safeNextPath("/produto/abc/provador?look=1"), "/produto/abc/provador?look=1");
  });

  it("sem valor, vai para o perfil", () => {
    assert.equal(safeNextPath(null), "/perfil");
    assert.equal(safeNextPath(""), "/perfil");
  });

  it("recusa link para fora da loja", () => {
    assert.equal(safeNextPath("//golpe.com"), "/perfil");
    assert.equal(safeNextPath("/\\golpe.com"), "/perfil");
    assert.equal(safeNextPath("javascript:alert(1)"), "/perfil");
    assert.equal(safeNextPath("checkout"), "/perfil");
  });

  it("do callbackUrl completo do NextAuth, fica só o caminho", () => {
    assert.equal(safeNextPath("http://localhost:3000/perfil/pedidos?x=1"), "/perfil/pedidos?x=1");
    assert.equal(safeNextPath("https://golpe.com/admin"), "/admin");
  });

  it("não volta para o login nem para o cadastro", () => {
    assert.equal(safeNextPath("/login?next=/x"), "/perfil");
    assert.equal(safeNextPath("/cadastro"), "/perfil");
  });
});
