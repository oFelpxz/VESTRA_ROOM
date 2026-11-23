/**
 * Modo leve do provador: em celular fraco o 3D desliga o que mais pesa na
 * placa de vídeo — dobras e pesponto do tecido, sombras e a tela em
 * resolução dupla. A trama e a cor continuam.
 *
 * Liga sozinho de dois jeitos:
 * - no início, pelo aparelho: tela de toque com poucos núcleos ou pouca
 *   memória (`deviceMemory` só existe no Chrome);
 * - durante o uso, se o celular não segurar ~50 quadros por segundo
 *   (`PerformanceMonitor` em `tryon-scene.tsx`). Só em tela de toque: no
 *   computador da apresentação o visual nunca muda no meio.
 *
 * `?leve=1` na URL força o modo leve e `?leve=0` desliga (para comparar).
 *
 * Arquivo sem three.js e sem React para dar para testar no Node.
 */

export type DeviceInfo = {
  /** `location.search`. */
  search: string;
  /** Tela de toque (`pointer: coarse`). */
  touch: boolean;
  /** `navigator.hardwareConcurrency`. */
  cores?: number;
  /** `navigator.deviceMemory` (GB). */
  memory?: number;
};

export type LiteMode = {
  /** Começa leve. */
  lite: boolean;
  /** Pode ficar leve sozinho se o celular travar. */
  auto: boolean;
};

const FEW_CORES = 4;
const LOW_MEMORY = 4;

export function liteMode(d: DeviceInfo): LiteMode {
  const forced = new URLSearchParams(d.search).get("leve");
  if (forced === "1") return { lite: true, auto: false };
  if (forced === "0") return { lite: false, auto: false };
  if (!d.touch) return { lite: false, auto: false };
  const weak = (d.cores != null && d.cores <= FEW_CORES) || (d.memory != null && d.memory < LOW_MEMORY);
  return { lite: weak, auto: true };
}
