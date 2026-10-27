import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Cores e versões da identidade Sport + Street (lista 9). O nome da cor diz a
// versão (src/lib/garment-prints.ts): "... Street" = logo nas costas e no
// peito; "... / Lima" = logo no peito e faixa lima nas mangas.
//
// Só cria o que falta, nos tamanhos que a peça já tem, com estoque de teste;
// não apaga nem muda variante nenhuma. Rodar de novo não duplica.
//
// Uso: npx tsx scripts/add-lista9-colors.ts

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const TEST_STOCK = 10;

const COLORS: Record<string, string[]> = {
  // Street
  "boxy-tee-01": ["Preto Street", "Off-white Street"],
  "relugar-t-shirt": ["Preto Street"],
  "hoodie-core": ["Preto Street", "Cinza Mescla Street"],
  "tech-vest": ["Preto Street", "Verde Militar Street"],
  // Sport
  "track-jacket": ["Preto / Lima", "Off-white / Lima"],
  // Calças e bermuda: só cores
  "cargo-pant-02": ["Preto", "Verde Militar"],
  "wide-denim": ["Índigo", "Preto"],
  "bermuda-utility": ["Preto", "Cinza Mescla"],
  // Clean: só cores
  "vestido-slip-acetinado": ["Vinho", "Lima"],
  "saia-midi-plissada": ["Preto", "Verde Militar"],
  "camisa-studio": ["Off-white", "Azul Céu"],
  "knit-beanie": ["Lima", "Preto"],
};

function slugPart(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  for (const [slug, colors] of Object.entries(COLORS)) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { variants: { select: { color: true, size: true, sku: true } } },
    });
    if (!product) {
      console.log(`Produto nao encontrado: ${slug}`);
      continue;
    }
    const sizes = [...new Set(product.variants.map((v) => v.size))];
    const has = new Set(product.variants.map((v) => `${v.color}|${v.size}`));
    for (const color of colors) {
      let created = 0;
      for (const size of sizes) {
        if (has.has(`${color}|${size}`)) continue;
        const sku = `${slug}-${slugPart(color)}-${slugPart(size)}`;
        if (await prisma.productVariant.findUnique({ where: { sku } })) continue;
        await prisma.productVariant.create({
          data: { productId: product.id, sku, color, size, stockQuantity: TEST_STOCK },
        });
        created++;
      }
      console.log(`${product.name} · ${color}: ${created} tamanho(s) novo(s)`);
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
