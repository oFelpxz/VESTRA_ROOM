import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Copia a tabela de medidas de um produto para outro (substitui a do destino).
// A Relugar T-Shirt usa o mesmo modelo 3D da Boxy Tee 01, então usa a mesma
// tabela (aprovado em 20/10).
//
// Uso: npx tsx scripts/copy-size-chart.ts boxy-tee-01 relugar-t-shirt

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const [fromSlug, toSlug] = process.argv.slice(2);
  if (!fromSlug || !toSlug) throw new Error("uso: copy-size-chart.ts <slug-origem> <slug-destino>");

  const from = await prisma.product.findUnique({
    where: { slug: fromSlug },
    include: { sizeChart: { include: { measures: true } } },
  });
  const to = await prisma.product.findUnique({
    where: { slug: toSlug },
    include: { sizeChart: true },
  });
  if (!from?.sizeChart) throw new Error(`Sem tabela de medidas: ${fromSlug}`);
  if (!to) throw new Error(`Produto nao encontrado: ${toSlug}`);

  // Sem id, tabela e data: a medida é criada de novo na tabela de destino.
  const measures = from.sizeChart.measures.map((row) => {
    const m: Partial<typeof row> = { ...row };
    delete m.id;
    delete m.sizeChartId;
    delete m.createdAt;
    return m as Omit<typeof row, "id" | "sizeChartId" | "createdAt">;
  });

  if (to.sizeChart) {
    await prisma.$transaction([
      prisma.sizeChartMeasure.deleteMany({ where: { sizeChartId: to.sizeChart.id } }),
      prisma.sizeChartMeasure.createMany({
        data: measures.map((m) => ({ ...m, sizeChartId: to.sizeChart!.id })),
      }),
    ]);
  } else {
    await prisma.sizeChart.create({
      data: { productId: to.id, name: `Tabela ${to.name}`, measures: { create: measures } },
    });
  }
  console.log(`${to.name}: tabela ${measures.map((m) => m.size).join("/")} (copiada de ${from.name})`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
