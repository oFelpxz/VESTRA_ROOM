/**
 * Enquadramento do corpo inteiro no provador (lista 11, item 9): qualquer
 * altura ocupa a mesma parte da tela, e na tela estreita (dois tamanhos lado
 * a lado) a câmera recua até os braços abertos caberem.
 */

/** Abertura vertical da câmera do provador, em graus. */
export const STUDIO_FOV = 38;

/** Parte da altura da tela que o corpo ocupa (cabelo e tênis entram na folga). */
const FILL_HEIGHT = 0.8;
/** Parte da largura da tela que os braços abertos podem ocupar. */
const FILL_WIDTH = 0.86;
/**
 * Largura do avatar de braços abertos ÷ altura. Medido na malha: 0,54–0,58
 * (do corpo baixo e magro ao grande); a manga larga do moletom soma um pouco.
 */
const ARM_SPAN = 0.62;

export type Home = { y: number; dist: number; targetY: number };

/** Câmera de frente para o corpo de `height` m numa tela de largura/altura `aspect`. */
export function frameBody(height: number, aspect: number, fov = STUDIO_FOV): Home {
  const view = 2 * Math.tan((fov * Math.PI) / 360); // altura vista a 1 m
  const byHeight = height / FILL_HEIGHT / view;
  const byWidth = (height * ARM_SPAN) / FILL_WIDTH / (view * Math.max(aspect, 0.1));
  return {
    dist: Math.max(byHeight, byWidth),
    // Um pouco acima do meio do corpo, olhando para o meio: como um fotógrafo de pé.
    y: height * 0.55,
    targetY: height * 0.5,
  };
}
