/**
 * Distância de cada vértice até a borda do tecido (barra, gola, punho, emenda
 * entre painéis, contorno de bolso) — o material usa para desenhar a barra
 * dobrada e o pesponto (`fabric.ts`).
 *
 * Para cada vértice: [distância até a borda mais próxima (m, até `cap`),
 * posição ao longo dessa borda (m)]. A posição ao longo da borda faz o
 * tracejado do pesponto andar paralelo à barra.
 *
 * Arquivo sem three.js para dar para testar no Node.
 */

/** Até onde (m) a distância é calculada; além disso fica `cap`. */
export const EDGE_CAP = 0.04;

export function edgeDistance(
  pos: ArrayLike<number>,
  index: ArrayLike<number> | null,
  cap = EDGE_CAP,
): Float32Array {
  const n = pos.length / 3;

  // Junta vértices na mesma posição (costura de UV/normal): senão a costura de
  // UV vira uma "borda" falsa no meio do tecido.
  const weld = new Int32Array(n);
  const seen = new Map<string, number>();
  const first: number[] = [];
  for (let v = 0; v < n; v++) {
    const key = `${Math.round(pos[3 * v] * 1e5)},${Math.round(pos[3 * v + 1] * 1e5)},${Math.round(pos[3 * v + 2] * 1e5)}`;
    let id = seen.get(key);
    if (id === undefined) {
      id = first.length;
      first.push(v);
      seen.set(key, id);
    }
    weld[v] = id;
  }
  const m = first.length;
  const P = (w: number, k: number) => pos[3 * first[w] + k];
  const dist = (a: number, b: number) => Math.hypot(P(a, 0) - P(b, 0), P(a, 1) - P(b, 1), P(a, 2) - P(b, 2));

  // Arestas e quantos triângulos usam cada uma: usada por um só = borda.
  const tri = index ? index.length / 3 : n / 3;
  const at = (i: number) => weld[index ? index[i] : i];
  const uses = new Map<number, number>();
  const adj: number[][] = Array.from({ length: m }, () => []);
  for (let t = 0; t < tri; t++) {
    const ids = [at(3 * t), at(3 * t + 1), at(3 * t + 2)];
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      if (a === b) continue;
      const key = a < b ? a * m + b : b * m + a;
      const c = uses.get(key) ?? 0;
      uses.set(key, c + 1);
      if (!c) {
        adj[a].push(b);
        adj[b].push(a);
      }
    }
  }
  const border: number[][] = Array.from({ length: m }, () => []);
  const edges: [number, number][] = [];
  const edgeOf = new Int32Array(m).fill(-1);
  for (const [key, c] of uses) {
    if (c !== 1) continue;
    const a = Math.floor(key / m);
    const b = key % m;
    border[a].push(b);
    border[b].push(a);
    if (edgeOf[a] < 0) edgeOf[a] = edges.length;
    if (edgeOf[b] < 0) edgeOf[b] = edges.length;
    edges.push([a, b]);
  }

  // Percorre cada contorno somando o comprimento.
  const along = new Float64Array(m).fill(-1);
  for (let s = 0; s < m; s++) {
    if (!border[s].length || along[s] >= 0) continue;
    let v = s;
    let len = 0;
    along[v] = 0;
    for (;;) {
      const next = border[v].find((u) => along[u] < 0);
      if (next === undefined) break;
      len += dist(v, next);
      along[next] = len;
      v = next;
    }
  }

  // Distância reta até o trecho de borda mais próximo. Cada vértice herda o
  // trecho do vizinho que chega primeiro (Dijkstra a partir das bordas,
  // parando em `cap`); somar as arestas da malha fazia a linha ziguezaguear
  // (o pesponto e a dobra da barra saíam ondulados).
  const toEdge = (v: number, e: number): [number, number] => {
    const [a, b] = edges[e];
    const ab = [P(b, 0) - P(a, 0), P(b, 1) - P(a, 1), P(b, 2) - P(a, 2)];
    const av = [P(v, 0) - P(a, 0), P(v, 1) - P(a, 1), P(v, 2) - P(a, 2)];
    const ll = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = ll > 0 ? Math.min(Math.max((av[0] * ab[0] + av[1] * ab[1] + av[2] * ab[2]) / ll, 0), 1) : 0;
    const dist = Math.hypot(av[0] - ab[0] * t, av[1] - ab[1] * t, av[2] - ab[2] * t);
    // Posição ao longo: entre as duas pontas (na aresta que fecha o contorno
    // o "ao longo" dá um salto; aí fica a ponta mais perto).
    const len = Math.sqrt(ll);
    const step = along[b] - along[a];
    const pos = Math.abs(Math.abs(step) - len) < len * 0.5 + 1e-9 ? along[a] + step * t : t < 0.5 ? along[a] : along[b];
    return [dist, pos];
  };
  const d = new Float64Array(m).fill(Infinity);
  const src = new Float64Array(m);
  const srcEdge = new Int32Array(m).fill(-1);
  const heap: [number, number][] = [];
  const push = (k: number, w: number) => {
    heap.push([k, w]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };
  for (let w = 0; w < m; w++)
    if (along[w] >= 0) {
      d[w] = 0;
      src[w] = along[w];
      srcEdge[w] = edgeOf[w];
      push(0, w);
    }
  while (heap.length) {
    const [k, w] = pop();
    if (k > d[w] || k >= cap) continue;
    for (const u of adj[w]) {
      if (d[u] === 0) continue;
      const [nk, at] = toEdge(u, srcEdge[w]);
      if (nk < d[u]) {
        d[u] = nk;
        src[u] = at;
        srcEdge[u] = srcEdge[w];
        push(nk, u);
      }
    }
  }

  const out = new Float32Array(n * 2);
  for (let v = 0; v < n; v++) {
    const w = weld[v];
    out[2 * v] = Math.min(d[w], cap);
    out[2 * v + 1] = src[w];
  }
  return out;
}

/**
 * Atributo `fabricEdge` do material: [EDGE_CAP − distância, posição ao longo
 * da borda]. Parte que é quase toda borda (ribana, malha retalhada) fica 0,
 * sem acabamento — o pesponto viraria rabisco.
 */
export function fabricEdgeAttribute(pos: ArrayLike<number>, index: ArrayLike<number> | null): Float32Array {
  const e = edgeDistance(pos, index);
  let near = 0;
  for (let i = 0; i < e.length; i += 2) if (e[i] < 0.02) near++;
  const strip = near > 0.6 * (e.length / 2);
  for (let i = 0; i < e.length; i += 2) e[i] = strip ? 0 : EDGE_CAP - e[i];
  return e;
}
