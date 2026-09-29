/**
 * Web Worker do provador: calcula o caimento (`dress`) fora da thread da
 * página, para a tela não travar a cada troca de tamanho ou medida.
 * Recebe o corpo e a peça uma vez ("init") e depois só os pedidos ("fit").
 * Quem conversa com ele é `FitRunner` (src/lib/fit-runner.ts).
 */
import { dress, type FitBody, type FitPart } from "./garment-dress";
import type { FitRequest, FitWorkerMessage } from "./fit-runner";

// `self` aqui é o escopo do worker; o tsconfig do projeto só tem os tipos da
// página, então descrevemos só o que usamos.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<FitWorkerMessage>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

let body: FitBody | null = null;
let parts: FitPart[] = [];

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "init") {
    body = msg.body;
    parts = msg.parts;
    return;
  }
  if (!body) return;
  const r: FitRequest = msg.request;
  const fitted = dress(body, parts, r.morphs, r.totalHeight, r.grade);
  ctx.postMessage({ id: r.id, fitted }, [
    fitted.body.buffer,
    fitted.cloth.buffer,
  ]);
};
