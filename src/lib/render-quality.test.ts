import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liteMode } from "./render-quality";

describe("liteMode", () => {
  it("computador: sempre completo, sem trocar sozinho", () => {
    assert.deepEqual(liteMode({ search: "", touch: false, cores: 2, memory: 2 }), { lite: false, auto: false });
  });

  it("celular bom: completo, mas pode ficar leve se travar", () => {
    assert.deepEqual(liteMode({ search: "", touch: true, cores: 8, memory: 8 }), { lite: false, auto: true });
  });

  it("celular com poucos núcleos ou pouca memória: começa leve", () => {
    assert.equal(liteMode({ search: "", touch: true, cores: 4 }).lite, true);
    assert.equal(liteMode({ search: "", touch: true, cores: 8, memory: 2 }).lite, true);
  });

  it("iPhone (sem deviceMemory, 6 núcleos): completo", () => {
    assert.equal(liteMode({ search: "", touch: true, cores: 6 }).lite, false);
  });

  it("?leve=1 e ?leve=0 mandam", () => {
    assert.deepEqual(liteMode({ search: "?look=x&leve=1", touch: false }), { lite: true, auto: false });
    assert.deepEqual(liteMode({ search: "?leve=0", touch: true, cores: 2 }), { lite: false, auto: false });
  });
});
