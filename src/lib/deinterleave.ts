import * as THREE from "three";

/**
 * Arquivos gravados pelo gltf-transform (scripts/derivar-oversized.ts,
 * scripts/simplificar-modelo.ts) vêm com os atributos entrelaçados num buffer
 * só; o caimento lê `.array` como posições seguidas, então cada atributo vira
 * um array próprio.
 */
export function deinterleave(geometry: THREE.BufferGeometry) {
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    if (!("isInterleavedBufferAttribute" in attr)) continue;
    const { data, offset, itemSize, count, normalized } = attr;
    const Arr = attr.array.constructor as new (n: number) => THREE.TypedArray;
    const out = new Arr(count * itemSize);
    for (let i = 0; i < count; i++)
      for (let k = 0; k < itemSize; k++)
        out[i * itemSize + k] = data.array[i * data.stride + offset + k];
    geometry.setAttribute(name, new THREE.BufferAttribute(out, itemSize, normalized));
  }
}
