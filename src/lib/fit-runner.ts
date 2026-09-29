import type { AvatarParams } from "@/lib/avatar-builder";
import type { Grade } from "@/lib/garment-fit";
import { dress, type FitBody, type FitPart, type Fitted } from "./garment-dress";

/**
 * Leva o caimento para um Web Worker e só manda o pedido mais recente: se o
 * cliente troca de tamanho várias vezes enquanto uma conta roda, as do meio
 * são puladas. Sem worker (ou se ele falhar ao carregar), calcula na própria
 * página, como antes.
 */

export type FitRequest = {
  id: number;
  morphs: AvatarParams["morphs"];
  totalHeight: number;
  grade: Grade;
};

export type FitWorkerMessage =
  | { type: "init"; body: FitBody; parts: FitPart[] }
  | { type: "fit"; request: FitRequest };

export class FitRunner {
  private worker: Worker | null = null;
  private current: FitRequest | null = null;
  private next: FitRequest | null = null;
  private lastId = 0;
  private disposed = false;

  constructor(
    private body: FitBody,
    private parts: FitPart[],
    private onResult: (fitted: Fitted) => void,
    private onError: (error: unknown) => void,
  ) {
    try {
      this.worker = new Worker(
        new URL("./garment-fit.worker.ts", import.meta.url),
      );
    } catch {
      return; // navegador sem worker: fica no cálculo na página
    }
    this.worker.onmessage = (e: MessageEvent<{ id: number; fitted: Fitted }>) => {
      if (e.data.id === this.current?.id) this.done(e.data.fitted);
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.worker?.terminate();
      this.worker = null;
      if (this.current) this.runHere(this.current);
    };
    this.post({ type: "init", body, parts });
  }

  request(morphs: FitRequest["morphs"], totalHeight: number, grade: Grade) {
    const r = { id: ++this.lastId, morphs, totalHeight, grade };
    if (this.current) this.next = r;
    else this.start(r);
  }

  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
  }

  private post(msg: FitWorkerMessage) {
    this.worker?.postMessage(msg);
  }

  private start(r: FitRequest) {
    this.current = r;
    if (this.worker) this.post({ type: "fit", request: r });
    else this.runHere(r);
  }

  /** Fora do worker: adia um instante para não travar dentro do render. */
  private runHere(r: FitRequest) {
    setTimeout(() => {
      if (this.disposed || this.current !== r) return;
      try {
        this.done(dress(this.body, this.parts, r.morphs, r.totalHeight, r.grade));
      } catch (error) {
        this.current = null;
        this.onError(error);
      }
    }, 0);
  }

  private done(fitted: Fitted) {
    if (this.disposed) return;
    this.current = null;
    this.onResult(fitted);
    const n = this.next;
    this.next = null;
    if (n) this.start(n);
  }
}
