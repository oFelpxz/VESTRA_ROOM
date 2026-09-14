import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const productModels = [
  { slug: "tech-vest", fileUrl: "/models/tech_vest.glb" },
  { slug: "track-jacket", fileUrl: "/models/track_jacket.glb" },
];

async function main() {
  for (const { slug, fileUrl } of productModels) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { model3D: true },
    });

    if (!product) {
      console.log(`Produto nao encontrado: ${slug}`);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        status: "ACTIVE",
        has3DModel: true,
        availableForVirtualTryOn: true,
      },
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
        data: {
          productId: product.id,
          fileUrl,
          format: "GLB",
          status: "VALIDATED",
        },
      });
    }

    console.log(`${product.name}: ${fileUrl}`);
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
