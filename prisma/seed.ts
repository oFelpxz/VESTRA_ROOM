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
  { name: "Camisas", slug: "camisas" },
  { name: "Calças", slug: "calcas" },
  { name: "Bermudas", slug: "bermudas" },
  { name: "Saias", slug: "saias" },
  { name: "Vestidos", slug: "vestidos" },
  { name: "Moletons", slug: "moletons" },
  { name: "Jaquetas", slug: "jaquetas" },
  { name: "Acessórios", slug: "acessorios" },
];

// Política de troca padrão — usada quando o produto não tem uma específica.
const DEFAULT_RETURN_POLICY =
  "Troca ou devolução em até 30 dias corridos após o recebimento, peça sem uso e com etiqueta.";

type SeedProduct = {
  name: string;
  slug: string;
  categorySlug: string;
  basePrice: number;
  colors: string[];
  sizes: string[];
  has3D?: boolean;
  modelUrl?: string;
  description?: string;
  gender?: "MASCULINO" | "FEMININO" | "UNISSEX";
  collection?: string;
  material?: string;
  composition?: string;
  careInstructions?: string;
  returnPolicy?: string;
  maxInstallments?: number;
};

const products: SeedProduct[] = [
  {
    name: "Boxy Tee 01",
    slug: "boxy-tee-01",
    categorySlug: "camisetas",
    basePrice: 189,
    colors: ["Preto", "Off-white"],
    sizes: ["P", "M", "G", "GG"],
    has3D: true,
    gender: "UNISSEX",
    collection: "Verão 26",
    material: "Algodão",
    composition: "100% algodão penteado, 180g/m²",
    careInstructions: "Lavar à máquina até 30°C, não usar alvejante, secar à sombra.",
    maxInstallments: 3,
  },
  {
    name: "Cargo Pant 02",
    slug: "cargo-pant-02",
    categorySlug: "calcas",
    basePrice: 349,
    colors: ["Preto", "Bege"],
    sizes: ["38", "40", "42", "44"],
    gender: "UNISSEX",
    collection: "Inverno 26",
    material: "Algodão",
    composition: "98% algodão, 2% elastano",
    careInstructions: "Lavar do avesso, não usar secadora.",
    maxInstallments: 6,
  },
  {
    name: "Hoodie Core",
    slug: "hoodie-core",
    categorySlug: "moletons",
    basePrice: 299,
    colors: ["Preto", "Cinza", "Branco"],
    sizes: ["P", "M", "G", "GG"],
    has3D: true,
    description:
      "Moletom com capuz em algodão pesado, caimento boxy e bolso canguru duplo. Peça-âncora do provador VESTRA FIT — vista no seu avatar em 3D antes de comprar.",
    gender: "UNISSEX",
    collection: "Inverno 26",
    material: "Algodão",
    composition: "80% algodão, 20% poliéster, moletom flanelado",
    careInstructions: "Lavar à máquina até 30°C, secar à sombra, não passar no estampado.",
    maxInstallments: 6,
  },
  {
    name: "Oversized Shirt",
    slug: "oversized-shirt",
    categorySlug: "camisetas",
    basePrice: 229,
    colors: ["Off-white"],
    sizes: ["P", "M", "G"],
    gender: "UNISSEX",
    collection: "Verão 26",
    material: "Algodão",
    composition: "100% algodão penteado, 220g/m²",
    careInstructions: "Lavar à máquina até 30°C.",
    maxInstallments: 3,
  },
  {
    name: "Track Jacket",
    slug: "track-jacket",
    categorySlug: "jaquetas",
    basePrice: 399,
    colors: ["Preto"],
    sizes: ["P", "M", "G", "GG"],
    has3D: true,
    modelUrl: "/models/track_jacket.glb",
    gender: "UNISSEX",
    collection: "Inverno 26",
    material: "Poliéster",
    composition: "100% poliéster reciclado, forro em mesh",
    careInstructions: "Lavar à máquina até 30°C, não usar ferro no zíper.",
    maxInstallments: 6,
  },
  {
    name: "Knit Beanie",
    slug: "knit-beanie",
    categorySlug: "acessorios",
    basePrice: 89,
    colors: ["Preto", "Cinza"],
    sizes: ["Único"],
    gender: "UNISSEX",
    collection: "Inverno 26",
    material: "Acrílico",
    composition: "100% acrílico",
    careInstructions: "Lavar à mão, não torcer.",
    maxInstallments: 2,
  },
  {
    name: "Wide Denim",
    slug: "wide-denim",
    categorySlug: "calcas",
    basePrice: 329,
    colors: ["Azul"],
    sizes: ["38", "40", "42"],
    gender: "FEMININO",
    collection: "Verão 26",
    material: "Denim",
    composition: "100% algodão, denim rígido",
    careInstructions: "Lavar do avesso em água fria.",
    maxInstallments: 6,
  },
  {
    name: "Tech Vest",
    slug: "tech-vest",
    categorySlug: "jaquetas",
    basePrice: 279,
    colors: ["Preto", "Verde"],
    sizes: ["P", "M", "G"],
    has3D: true,
    modelUrl: "/models/tech_vest.glb",
    gender: "MASCULINO",
    collection: "Inverno 26",
    material: "Nylon",
    composition: "100% nylon ripstop, acabamento repelente à água",
    careInstructions: "Lavar à máquina até 30°C, não usar secadora.",
    maxInstallments: 6,
  },
  // --- categorias novas (item 08) ---
  {
    name: "Camisa Studio",
    slug: "camisa-studio",
    categorySlug: "camisas",
    basePrice: 259,
    colors: ["Branco", "Azul"],
    sizes: ["P", "M", "G", "GG"],
    gender: "MASCULINO",
    collection: "Verão 26",
    material: "Algodão",
    composition: "70% algodão, 30% viscose",
    careInstructions: "Lavar à máquina até 30°C, passar morno.",
    maxInstallments: 4,
  },
  {
    name: "Bermuda Utility",
    slug: "bermuda-utility",
    categorySlug: "bermudas",
    basePrice: 199,
    colors: ["Bege", "Preto"],
    sizes: ["38", "40", "42", "44"],
    gender: "MASCULINO",
    collection: "Verão 26",
    material: "Algodão",
    composition: "100% algodão sarja",
    careInstructions: "Lavar à máquina até 30°C.",
    maxInstallments: 3,
  },
  {
    name: "Saia Midi Plissada",
    slug: "saia-midi-plissada",
    categorySlug: "saias",
    basePrice: 219,
    colors: ["Preto", "Verde"],
    sizes: ["P", "M", "G"],
    gender: "FEMININO",
    collection: "Verão 26",
    material: "Poliéster",
    composition: "100% poliéster plissado",
    careInstructions: "Lavar à mão, não torcer, secar pendurada.",
    maxInstallments: 3,
  },
  {
    name: "Vestido Slip Acetinado",
    slug: "vestido-slip-acetinado",
    categorySlug: "vestidos",
    basePrice: 289,
    colors: ["Preto", "Off-white"],
    sizes: ["P", "M", "G"],
    gender: "FEMININO",
    collection: "Verão 26",
    material: "Poliéster",
    composition: "95% poliéster, 5% elastano, acetinado",
    careInstructions: "Lavar à mão em água fria, não usar alvejante.",
    maxInstallments: 4,
  },
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
        gender: p.gender,
        collection: p.collection,
        material: p.material,
        composition: p.composition,
        careInstructions: p.careInstructions,
        returnPolicy: p.returnPolicy ?? DEFAULT_RETURN_POLICY,
        maxInstallments: p.maxInstallments,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description:
          p.description ??
          "Peça VESTRA ROOM. Roupas criadas para serem vistas em todos os ângulos.",
        brand: "VESTRA ROOM",
        basePrice: p.basePrice,
        status: "ACTIVE",
        has3DModel: Boolean(p.has3D),
        availableForVirtualTryOn: Boolean(p.has3D),
        categoryId: category.id,
        gender: p.gender,
        collection: p.collection,
        material: p.material,
        composition: p.composition,
        careInstructions: p.careInstructions,
        returnPolicy: p.returnPolicy ?? DEFAULT_RETURN_POLICY,
        maxInstallments: p.maxInstallments,
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
          // SVG inline como placeholder — sem precisar de arquivo físico
          url:
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#E7E2DA"/><text x="200" y="250" text-anchor="middle" font-family="monospace" font-size="14" fill="#8A8A8A" letter-spacing="4">VESTRA ROOM</text></svg>`,
            ),
          altText: p.name,
          position: 0,
        },
      });
    }

    // Modelo 3D + tabela de medidas para os produtos com 3D
    if (p.has3D) {
      const modelUrl = p.modelUrl ?? "/models/hoodie_black.glb";

      await prisma.model3D.upsert({
        where: { productId: product.id },
        update: { fileUrl: modelUrl, status: "VALIDATED" },
        create: {
          productId: product.id,
          fileUrl: modelUrl,
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
                { size: "P", chestMinCm: 86, chestMaxCm: 90, waistMinCm: 70, waistMaxCm: 76, hipMinCm: 88, hipMaxCm: 94, armLengthMinCm: 56, armLengthMaxCm: 60, legLengthMinCm: 74, legLengthMaxCm: 78 },
                { size: "M", chestMinCm: 91, chestMaxCm: 98, waistMinCm: 77, waistMaxCm: 84, hipMinCm: 95, hipMaxCm: 100, armLengthMinCm: 60, armLengthMaxCm: 64, legLengthMinCm: 78, legLengthMaxCm: 82 },
                { size: "G", chestMinCm: 99, chestMaxCm: 106, waistMinCm: 85, waistMaxCm: 92, hipMinCm: 101, hipMaxCm: 106, armLengthMinCm: 63, armLengthMaxCm: 67, legLengthMinCm: 81, legLengthMaxCm: 85 },
                { size: "GG", chestMinCm: 107, chestMaxCm: 114, waistMinCm: 93, waistMaxCm: 100, hipMinCm: 107, hipMaxCm: 113, armLengthMinCm: 66, armLengthMaxCm: 70, legLengthMinCm: 84, legLengthMaxCm: 88 },
              ],
            },
          },
        });
      }
    }
  }

  // 3. Usuários de teste (admin, operador de estoque, modelador 3D, cliente)
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

  const operatorPassword = await bcrypt.hash("estoque123", 10);
  await prisma.user.upsert({
    where: { email: "estoque@vestra.room" },
    update: { role: "STOCK_OPERATOR" },
    create: {
      name: "Operador de Estoque",
      email: "estoque@vestra.room",
      passwordHash: operatorPassword,
      role: "STOCK_OPERATOR",
    },
  });

  const modelerPassword = await bcrypt.hash("modelo123", 10);
  await prisma.user.upsert({
    where: { email: "modelador@vestra.room" },
    update: { role: "MODEL_3D" },
    create: {
      name: "Modelador 3D",
      email: "modelador@vestra.room",
      passwordHash: modelerPassword,
      role: "MODEL_3D",
    },
  });

  const customerPassword = await bcrypt.hash("cliente123", 10);
  const customer = await prisma.user.upsert({
    where: { email: "cliente@vestra.room" },
    update: {},
    create: {
      name: "Cliente Teste",
      email: "cliente@vestra.room",
      passwordHash: customerPassword,
      role: "CUSTOMER",
    },
  });

  // Perfil de medidas do cliente demo — pronto para entrar no provador
  await prisma.measurementProfile.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      heightCm: 175,
      weightKg: 72,
      chestCm: 96,
      waistCm: 82,
      hipCm: 96,
      shoulderCm: 46,
      armLengthCm: 62,
      legLengthCm: 80,
      fitPreference: "REGULAR",
      acceptedTerms: true,
    },
  });

  // 4. Avaliações de exemplo (item 09) — dado de demonstração, sem passar
  // pela verificação de compra (que só vale para avaliações criadas pela UI).
  const reviewSeed: { slug: string; rating: number; comment: string }[] = [
    { slug: "boxy-tee-01", rating: 5, comment: "Caimento perfeito, tecido grosso e não desbota." },
    { slug: "hoodie-core", rating: 5, comment: "O provador 3D bateu certinho com o tamanho que comprei." },
  ];
  for (const r of reviewSeed) {
    const product = await prisma.product.findUnique({ where: { slug: r.slug } });
    if (!product) continue;
    await prisma.review.upsert({
      where: { productId_userId: { productId: product.id, userId: customer.id } },
      update: {},
      create: {
        productId: product.id,
        userId: customer.id,
        rating: r.rating,
        comment: r.comment,
        status: "APPROVED",
      },
    });
  }

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
