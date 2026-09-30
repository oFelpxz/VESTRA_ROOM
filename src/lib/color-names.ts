/**
 * Nome da cor da variante (como cadastrado no admin) → tom aproximado, para
 * pintar a peça 3D no provador. Aceita também o código da cor ("#6b1f2a"),
 * nomes compostos ("Azul Marinho", "Verde Musgo") e, se o nome composto não
 * estiver na lista, a cor base dele ("Azul Petróleo Claro" → azul petróleo;
 * "Rosa Chiclete" → rosa).
 */

// Chaves já normalizadas (ver `normalize`): minúsculas, sem acento, espaços.
const COLOR_HEX: Record<string, string> = {
  // neutros
  preto: "#1a1a1a",
  "preto lavado": "#2e2e2e",
  branco: "#f4f1ea",
  "off white": "#ece6d8",
  offwhite: "#ece6d8",
  creme: "#efe3c8",
  gelo: "#e6e6e1",
  cinza: "#9c9c9c",
  "cinza claro": "#c4c4c2",
  "cinza escuro": "#5c5c5c",
  "cinza mescla": "#a3a3a3",
  mescla: "#a3a3a3",
  grafite: "#474a4d",
  chumbo: "#3f4144",
  // terrosos
  areia: "#cdb896",
  bege: "#d4c4a8",
  caqui: "#b5a37a",
  nude: "#d9b8a0",
  caramelo: "#a86a32",
  marrom: "#5a3a26",
  chocolate: "#4a2c1d",
  cafe: "#4b3326",
  terracota: "#b0583a",
  ferrugem: "#9a4a24",
  // azuis
  azul: "#2a4a8a",
  "azul marinho": "#1c2a48",
  marinho: "#1c2a48",
  "azul claro": "#8fb3d9",
  "azul bebe": "#a9c8e8",
  "azul royal": "#2849a8",
  "azul petroleo": "#1f4f5a",
  jeans: "#4a6485",
  // verdes
  verde: "#2a7a3a",
  "verde musgo": "#56613a",
  "verde militar": "#4b5320",
  "verde oliva": "#6b6b3a",
  oliva: "#6b6b3a",
  "verde agua": "#8fd1c1",
  "verde bandeira": "#1f8a3a",
  "verde escuro": "#1f4a2a",
  // vermelhos, rosas, roxos
  vermelho: "#a02a2a",
  vinho: "#5e1a26",
  bordo: "#6b1f2a",
  marsala: "#7a3a3e",
  rosa: "#d48aa8",
  "rosa claro": "#ecc3d0",
  "rosa bebe": "#f0cfd8",
  pink: "#d9468a",
  coral: "#e8775f",
  lilas: "#b8a2d0",
  lavanda: "#b3a7d6",
  roxo: "#5b3a7a",
  // amarelos, laranjas
  amarelo: "#e0b840",
  mostarda: "#c49a2c",
  laranja: "#e0782c",
  // em inglês
  white: "#f4f1ea",
  black: "#1a1a1a",
  gray: "#9c9c9c",
  grey: "#9c9c9c",
  navy: "#1c2a48",
  blue: "#2a4a8a",
  red: "#a02a2a",
  green: "#2a7a3a",
  olive: "#6b6b3a",
  beige: "#d4c4a8",
  sand: "#cdb896",
  brown: "#5a3a26",
  yellow: "#e0b840",
  orange: "#e0782c",
  purple: "#5b3a7a",
};

/** Cor usada quando o nome não é reconhecido. */
export const UNKNOWN_COLOR = "#3a3a3a";

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function colorToHex(name: string): string {
  const hex = name.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return `#${h.toLowerCase()}`;
  }
  const key = normalize(name);
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  // nome composto fora da lista: o maior pedaço do começo que está na lista
  const words = key.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const hit = COLOR_HEX[words.slice(0, n).join(" ")];
    if (hit) return hit;
  }
  return UNKNOWN_COLOR;
}
