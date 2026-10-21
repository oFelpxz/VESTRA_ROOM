import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Liga as peças de cima derivadas dos moldes (ex.: scripts/derivar-oversized.ts)
// aos produtos e cria a tabela de medidas delas (medidas do corpo de quem
// veste cada tamanho), que o provador usa para o caimento por região.
//
// Uso: npx tsx scripts/attach-top-models.ts

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type Row = { size: string; chest: [number, number]; waist: [number, number] };

// Mesmo corpo por tamanho da Boxy Tee 01 (o molde é o mesmo); a peça é que
// sobra mais. A Oversized Shirt é vendida em P, M e G.
const OVERSIZED: Row[] = [
  { size: "P", chest: [86, 90], waist: [70, 76] },
  { size: "M", chest: [91, 98], waist: [77, 84] },
  { size: "G", chest: [99, 106], waist: [85, 92] },
];

const pieces = [
  { slug: "oversized-shirt", fileUrl: "/models/oversized_shirt.glb", chart: OVERSIZED },
];

async function main() {
  for (const { slug, fileUrl, chart } of pieces) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { model3D: true, sizeChart: true },
    });
    if (!product) {
      console.log(`Produto nao encontrado: ${slug}`);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { has3DModel: true, availableForVirtualTryOn: true },
    });

    if (product.model3D) {
      await prisma.model3D.update({
        where: { productId: product.id },
        data: {
          fileUrl,
          format: "GLB",
          status: "VALIDATED",
          version: product.model3D.version + 1,
        },
      });
    } else {
      await prisma.model3D.create({
        data: { productId: product.id, fileUrl, format: "GLB", status: "VALIDATED" },
      });
    }

    const measures = chart.map((r) => ({
      size: r.size,
      chestMinCm: r.chest[0],
      chestMaxCm: r.chest[1],
      waistMinCm: r.waist[0],
      waistMaxCm: r.waist[1],
    }));
    if (product.sizeChart) {
      await prisma.$transaction([
        prisma.sizeChartMeasure.deleteMany({ where: { sizeChartId: product.sizeChart.id } }),
        prisma.sizeChartMeasure.createMany({
          data: measures.map((m) => ({ ...m, sizeChartId: product.sizeChart!.id })),
        }),
      ]);
    } else {
      await prisma.sizeChart.create({
        data: {
          productId: product.id,
          name: `Tabela ${product.name}`,
          measures: { create: measures },
        },
      });
    }

    console.log(`${product.name}: ${fileUrl} · tabela ${chart.map((r) => r.size).join("/")}`);
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
