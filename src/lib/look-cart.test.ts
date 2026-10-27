import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLookCart, lookCartIds } from "./look-cart";

const v = (id: string, stockQuantity = 5, active = true) => ({ id, active, stockQuantity, label: `Peça ${id}` });
const none = new Map<string, number>();

test("ids do formulário: sem vazios, sem repetidos, até 3", () => {
  assert.deepEqual(lookCartIds(["a", "", " b ", "a", null, "c", "d"]), ["a", "b", "c"]);
});

test("look com as peças à venda e em estoque entra todo", () => {
  assert.equal(checkLookCart(["a", "b", "c"], [v("a"), v("b"), v("c")], none), null);
});

test("uma peça só não é look, salvo o vestido salvo", () => {
  assert.match(checkLookCart(["a"], [v("a")], none)!, /todas as peças/);
  assert.equal(checkLookCart(["a"], [v("a")], none, 1), null);
  assert.match(checkLookCart([], [], none, 1)!, /todas as peças/);
});

test("peça desativada ou que sumiu barra o look inteiro", () => {
  assert.equal(checkLookCart(["a", "b"], [v("a"), v("b", 5, false)], none), "Peça b está indisponível.");
  assert.match(checkLookCart(["a", "x"], [v("a")], none)!, /indisponível/);
});

test("estoque conta o que já está na sacola", () => {
  assert.equal(checkLookCart(["a", "b"], [v("a"), v("b", 0)], none), "Peça b esgotou.");
  assert.match(checkLookCart(["a", "b"], [v("a"), v("b", 2)], new Map([["b", 2]]))!, /já está na sua sacola/);
  assert.equal(checkLookCart(["a", "b"], [v("a"), v("b", 3)], new Map([["b", 2]])), null);
});
