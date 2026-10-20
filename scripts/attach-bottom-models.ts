import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Liga os moldes das peças de baixo (feitos com scripts/molde/calca.py) aos
// produtos e cria a tabela de medidas deles, que o provador usa para a folga
// de cada tamanho e o caimento por região (cintura, quadril, barra).
//
// Uso: npx tsx scripts/attach-bottom-models.ts

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

type Row = {
  size: string;
  waist: [number, number];
  hip: [number, number];
  leg: [number, number] | null;
};

// Numeração 38–44: +4 cm de cintura e quadril por número. A perna (entrepernas)
// só vale para a calça; na bermuda o comprimento não depende dela.
const CALCA: Row[] = [
  { size: "38", waist: [74, 78], hip: [92, 96], leg: [76, 80] },
  { size: "40", waist: [78, 82], hip: [96, 100], leg: [78, 82] },
  { size: "42", waist: [82, 86], hip: [100, 104], leg: [80, 84] },
  { size: "44", waist: [86, 90], hip: [104, 108], leg: [82, 86] },
];
const BERMUDA: Row[] = CALCA.map((r) => ({ ...r, leg: null }));

const pieces = [
  { slug: "cargo-pant-02", fileUrl: "/models/cargo_pant_02.glb", chart: CALCA },
  { slug: "bermuda-utility", fileUrl: "/models/bermuda_utility.glb", chart: BERMUDA },
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
      data: { status: "ACTIVE", has3DModel: true, availableForVirtualTryOn: true },
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
      waistMinCm: r.waist[0],
      waistMaxCm: r.waist[1],
      hipMinCm: r.hip[0],
      hipMaxCm: r.hip[1],
      legLengthMinCm: r.leg?.[0] ?? null,
      legLengthMaxCm: r.leg?.[1] ?? null,
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
