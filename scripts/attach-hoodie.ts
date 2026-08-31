/**
 * Anexa o modelo 3D `public/models/hoodie_black.glb` a um produto existente.
 *
 * Uso:
 *   npx tsx scripts/attach-hoodie.ts                  # usa "hoodie-core" como default
 *   npx tsx scripts/attach-hoodie.ts boxy-tee-01      # passa slug específico
 *
 * O script:
 *   - Marca o produto como `has3DModel = true` e `availableForVirtualTryOn = true`
 *   - Sobe status pra ACTIVE (se estava DRAFT/INACTIVE)
 *   - Cria ou atualiza Model3D apontando pra /models/hoodie_black.glb
 *   - Garante que o modelo está VALIDATED (cliente já pode usar no provador)
 *   - Cria SizeChart com peito/cintura/quadril/braço/perna se não existir
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const HOODIE_FILE = "/models/hoodie_black.glb";

async function main() {
  const slug = process.argv[2] ?? "hoodie-core";

  console.log(`\n→ Procurando produto com slug "${slug}"...`);

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { model3D: true, sizeChart: true, variants: true },
  });

  if (!product) {
    console.log(`✗ Produto "${slug}" não encontrado.`);
    console.log("  Use um destes slugs existentes:");
    const all = await prisma.product.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    for (const p of all) {
      console.log(`    - ${p.slug.padEnd(24)}  (${p.name})`);
    }
    process.exit(1);
  }

  console.log(`✓ Produto encontrado: ${product.name} (${product.id})`);
  console.log(`  Status atual: ${product.status}`);
  console.log(`  has3DModel: ${product.has3DModel}`);
  console.log(`  availableForVirtualTryOn: ${product.availableForVirtualTryOn}`);
  console.log(`  variantes: ${product.variants.length}`);
  console.log(`  modelo 3D atual: ${product.model3D?.fileUrl ?? "(nenhum)"}`);

  // 1. Atualiza flags do produto
  await prisma.product.update({
    where: { id: product.id },
    data: {
      status: "ACTIVE",
      has3DModel: true,
      availableForVirtualTryOn: true,
    },
  });
  console.log(`✓ Produto marcado como ACTIVE + has3DModel + availableForVirtualTryOn`);

  // 2. Sobe / atualiza Model3D
  if (product.model3D) {
    await prisma.model3D.update({
      where: { productId: product.id },
      data: {
        fileUrl: HOODIE_FILE,
        format: "GLB",
        status: "VALIDATED",
        version: product.model3D.version + 1,
      },
    });
    console.log(`✓ Model3D atualizado (v${product.model3D.version + 1}, VALIDATED)`);
  } else {
    await prisma.model3D.create({
      data: {
        productId: product.id,
        fileUrl: HOODIE_FILE,
        format: "GLB",
        version: 1,
        status: "VALIDATED",
      },
    });
    console.log(`✓ Model3D criado (v1, VALIDATED)`);
  }

  // 3. Garante SizeChart com 5 eixos (peito/cintura/quadril/braço/perna)
  if (!product.sizeChart) {
    await prisma.sizeChart.create({
      data: {
        productId: product.id,
        name: `Tabela de medidas — ${product.name}`,
        measures: {
          create: [
            { size: "P",  chestMinCm: 86,  chestMaxCm: 90,  waistMinCm: 70, waistMaxCm: 76,  hipMinCm: 88,  hipMaxCm: 94,  armLengthMinCm: 56, armLengthMaxCm: 60, legLengthMinCm: 74, legLengthMaxCm: 78 },
            { size: "M",  chestMinCm: 91,  chestMaxCm: 98,  waistMinCm: 77, waistMaxCm: 84,  hipMinCm: 95,  hipMaxCm: 100, armLengthMinCm: 60, armLengthMaxCm: 64, legLengthMinCm: 78, legLengthMaxCm: 82 },
            { size: "G",  chestMinCm: 99,  chestMaxCm: 106, waistMinCm: 85, waistMaxCm: 92,  hipMinCm: 101, hipMaxCm: 106, armLengthMinCm: 63, armLengthMaxCm: 67, legLengthMinCm: 81, legLengthMaxCm: 85 },
            { size: "GG", chestMinCm: 107, chestMaxCm: 114, waistMinCm: 93, waistMaxCm: 100, hipMinCm: 107, hipMaxCm: 113, armLengthMinCm: 66, armLengthMaxCm: 70, legLengthMinCm: 84, legLengthMaxCm: 88 },
          ],
        },
      },
    });
    console.log(`✓ SizeChart criada com 4 tamanhos (P/M/G/GG) e 5 eixos`);
  } else {
    console.log(`✓ SizeChart já existia — não foi sobrescrita`);
  }

  // 4. Garante variantes mínimas se o produto não tiver
  if (product.variants.length === 0) {
    const sizes = ["P", "M", "G", "GG"];
    const colors = ["Preto", "Cinza"];
    for (const color of colors) {
      for (const size of sizes) {
        const sku = `${product.slug}-${color}-${size}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-");
        await prisma.productVariant.upsert({
          where: { sku },
          update: { stockQuantity: 10 },
          create: {
            productId: product.id,
            sku,
            color,
            size,
            stockQuantity: 10,
            status: "ACTIVE",
          },
        });
      }
    }
    console.log(`✓ Variantes criadas (${colors.length} cores x ${sizes.length} tamanhos)`);
  } else {
    console.log(`✓ Produto já tinha ${product.variants.length} variantes — não foram tocadas`);
  }

  console.log(`\n✅ Pronto! O produto "${product.name}" está pronto para o provador VESTRA FIT.`);
  console.log(`   Acesse: /produto/${product.slug}/provador\n`);
}

main()
  .catch((e) => {
    console.error("\n❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
