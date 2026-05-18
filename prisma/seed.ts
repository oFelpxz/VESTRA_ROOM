import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

// Seed roda fora do Next.js — usa conexão DIRETA (5432) para evitar
// problemas de prepared statements com o pooler.
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Camisetas", slug: "camisetas" },
  { name: "Calças", slug: "calcas" },
  { name: "Moletons", slug: "moletons" },
  { name: "Jaquetas", slug: "jaquetas" },
  { name: "Acessórios", slug: "acessorios" },
];

type SeedProduct = {
  name: string;
  slug: string;
  categorySlug: string;
  basePrice: number;
  colors: string[];
  sizes: string[];
  has3D?: boolean;
};

const products: SeedProduct[] = [
  { name: "Boxy Tee 01", slug: "boxy-tee-01", categorySlug: "camisetas", basePrice: 189, colors: ["Preto", "Off-white"], sizes: ["P", "M", "G", "GG"], has3D: true },
  { name: "Cargo Pant 02", slug: "cargo-pant-02", categorySlug: "calcas", basePrice: 349, colors: ["Preto", "Areia"], sizes: ["38", "40", "42", "44"] },
  { name: "Hoodie Core", slug: "hoodie-core", categorySlug: "moletons", basePrice: 299, colors: ["Preto", "Cinza"], sizes: ["P", "M", "G", "GG"], has3D: true },
  { name: "Oversized Shirt", slug: "oversized-shirt", categorySlug: "camisetas", basePrice: 229, colors: ["Off-white"], sizes: ["P", "M", "G"] },
  { name: "Track Jacket", slug: "track-jacket", categorySlug: "jaquetas", basePrice: 399, colors: ["Preto"], sizes: ["P", "M", "G", "GG"], has3D: true },
  { name: "Knit Beanie", slug: "knit-beanie", categorySlug: "acessorios", basePrice: 89, colors: ["Preto", "Cinza"], sizes: ["Único"] },
  { name: "Wide Denim", slug: "wide-denim", categorySlug: "calcas", basePrice: 329, colors: ["Azul"], sizes: ["38", "40", "42"] },
  { name: "Tech Vest", slug: "tech-vest", categorySlug: "jaquetas", basePrice: 279, colors: ["Preto", "Verde"], sizes: ["P", "M", "G"], has3D: true },
];

async function main() {
  // 1. Categorias
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }

  // 2. Produtos + variantes + imagem + (3D / size chart quando aplicável)
  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: p.categorySlug },
    });

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        basePrice: p.basePrice,
        status: "ACTIVE",
        has3DModel: Boolean(p.has3D),
        availableForVirtualTryOn: Boolean(p.has3D),
        categoryId: category.id,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description:
          "Peça VESTRA ROOM. Roupas criadas para serem vistas em todos os ângulos.",
        brand: "VESTRA ROOM",
        basePrice: p.basePrice,
        status: "ACTIVE",
        has3DModel: Boolean(p.has3D),
        availableForVirtualTryOn: Boolean(p.has3D),
        categoryId: category.id,
      },
    });

    // Variantes (cor x tamanho)
    for (const color of p.colors) {
      for (const size of p.sizes) {
        const sku = `${p.slug}-${color}-${size}`
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

    // Imagem placeholder
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id },
    });
    if (!existingImage) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: "/models/placeholder.png",
          altText: p.name,
          position: 0,
        },
      });
    }

    // Modelo 3D + tabela de medidas para os produtos com 3D
    if (p.has3D) {
      await prisma.model3D.upsert({
        where: { productId: product.id },
        update: { fileUrl: "/models/hoodie_black.glb", status: "VALIDATED" },
        create: {
          productId: product.id,
          fileUrl: "/models/hoodie_black.glb",
          format: "GLB",
          status: "VALIDATED",
        },
      });

      const existingChart = await prisma.sizeChart.findUnique({
        where: { productId: product.id },
      });
      if (!existingChart) {
        await prisma.sizeChart.create({
          data: {
            productId: product.id,
            name: `Tabela de medidas — ${p.name}`,
            measures: {
              create: [
                { size: "P", chestMinCm: 86, chestMaxCm: 90, waistMinCm: 70, waistMaxCm: 76 },
                { size: "M", chestMinCm: 91, chestMaxCm: 98, waistMinCm: 77, waistMaxCm: 84 },
                { size: "G", chestMinCm: 99, chestMaxCm: 106, waistMinCm: 85, waistMaxCm: 92 },
                { size: "GG", chestMinCm: 107, chestMaxCm: 114, waistMinCm: 93, waistMaxCm: 100 },
              ],
            },
          },
        });
      }
    }
  }

  // 3. Usuários de teste (admin + cliente)
  const adminPassword = await bcrypt.hash("vestra123", 10);
  await prisma.user.upsert({
    where: { email: "admin@vestra.room" },
    update: { role: "ADMIN" },
    create: {
      name: "Admin VESTRA",
      email: "admin@vestra.room",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const customerPassword = await bcrypt.hash("cliente123", 10);
  await prisma.user.upsert({
    where: { email: "cliente@vestra.room" },
    update: {},
    create: {
      name: "Cliente Teste",
      email: "cliente@vestra.room",
      passwordHash: customerPassword,
      role: "CUSTOMER",
    },
  });

  console.log("Seed concluído:");
  console.log(`  ${categories.length} categorias`);
  console.log(`  ${products.length} produtos`);
  console.log("  Admin: admin@vestra.room / vestra123");
  console.log("  Cliente: cliente@vestra.room / cliente123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
