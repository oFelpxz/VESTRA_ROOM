import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { resolveModelUrl } from "@/lib/storage";
import { sortSizes } from "@/lib/sizes";

export type ProductFilters = {
  categoria?: string;
  tamanho?: string;
  cor?: string;
  preco?: string;
  genero?: string;
  colecao?: string;
  material?: string;
  provador?: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  price: string;
  tags: string[];
  imageUrl: string | null;
  modelUrl: string | null;
};

export type SizeChartRow = {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
  armLengthMinCm: number | null;
  armLengthMaxCm: number | null;
  legLengthMinCm: number | null;
  legLengthMaxCm: number | null;
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  category: string;
  price: string;
  priceNumber: number;
  promotionalPrice: string | null;
  promotionalPriceNumber: number | null;
  colors: string[];
  sizes: string[];
  variants: {
    id: string;
    color: string;
    size: string;
    stockQuantity: number;
  }[];
  tags: string[];
  has3D: boolean;
  modelUrl: string | null;
  model3DAvailableSizes: string[];
  sizeChart: { name: string; rows: SizeChartRow[] } | null;
  gender: "MASCULINO" | "FEMININO" | "UNISSEX" | null;
  collection: string | null;
  composition: string | null;
  careInstructions: string | null;
  returnPolicy: string | null;
  maxInstallments: number | null;
  reviews: { average: number | null; count: number; items: ReviewItem[] };
};

// Faixas de preço (presets usados nos filtros).
const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  "ate-200": { max: 200 },
  "200-350": { min: 200, max: 350 },
  "350-mais": { min: 350 },
};

export const PRICE_OPTIONS = [
  { value: "ate-200", label: "Até R$ 200" },
  { value: "200-350", label: "R$ 200 – 350" },
  { value: "350-mais", label: "R$ 350+" },
];

export async function getCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function getFilterOptions() {
  const variants = await prisma.productVariant.findMany({
    select: { size: true, color: true },
  });
  const sizes = sortSizes([...new Set(variants.map((v) => v.size))]);
  const colors = [...new Set(variants.map((v) => v.color))].sort();

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { gender: true, collection: true, material: true },
  });
  const genders = [...new Set(products.map((p) => p.gender).filter((g): g is NonNullable<typeof g> => g != null))];
  const collections = [...new Set(products.map((p) => p.collection).filter((c): c is string => Boolean(c)))].sort();
  const materials = [...new Set(products.map((p) => p.material).filter((c): c is string => Boolean(c)))].sort();

  return { sizes, colors, genders, collections, materials };
}

export const GENDER_LABEL: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  UNISSEX: "Unissex",
};

export async function getProducts(
  filters: ProductFilters = {},
): Promise<CatalogProduct[]> {
  const range = filters.preco ? PRICE_RANGES[filters.preco] : undefined;

  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.categoria
        ? { category: { slug: filters.categoria } }
        : {}),
      ...(filters.tamanho || filters.cor
        ? {
            variants: {
              some: {
                ...(filters.tamanho ? { size: filters.tamanho } : {}),
                ...(filters.cor ? { color: filters.cor } : {}),
              },
            },
          }
        : {}),
      ...(range
        ? {
            basePrice: {
              ...(range.min !== undefined ? { gte: range.min } : {}),
              ...(range.max !== undefined ? { lte: range.max } : {}),
            },
          }
        : {}),
      ...(filters.genero ? { gender: filters.genero as "MASCULINO" | "FEMININO" | "UNISSEX" } : {}),
      ...(filters.colecao ? { collection: filters.colecao } : {}),
      ...(filters.material ? { material: filters.material } : {}),
      ...(filters.provador ? { availableForVirtualTryOn: true } : {}),
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      model3D: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    products.map(async (p) => {
      const tags: string[] = [];
      if (p.has3DModel) tags.push("3D DISPONÍVEL");
      if (p.availableForVirtualTryOn) tags.push("VESTRA FIT");

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: formatBRL(Number(p.basePrice)),
        tags,
        imageUrl: p.images[0]?.url ?? null,
        modelUrl: p.has3DModel
          ? await resolveModelUrl(p.model3D?.fileUrl ?? null)
          : null,
      };
    }),
  );
}

export async function getProductDetail(
  slugOrId: string,
): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    include: {
      category: true,
      images: { orderBy: { position: "asc" } },
      variants: { where: { status: "ACTIVE" } },
      model3D: true,
      sizeChart: { include: { measures: { orderBy: { createdAt: "asc" } } } },
      reviews: {
        where: { status: "APPROVED" },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) return null;

  const colors = [...new Set(product.variants.map((v) => v.color))];
  const sizes = sortSizes([...new Set(product.variants.map((v) => v.size))]);

  const tags: string[] = [];
  if (product.has3DModel) tags.push("3D DISPONÍVEL");
  if (product.availableForVirtualTryOn) tags.push("VESTRA FIT");

  const approvedReviews = product.reviews;
  const reviewAverage =
    approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : null;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category.name,
    price: formatBRL(Number(product.basePrice)),
    priceNumber: Number(product.basePrice),
    promotionalPrice: product.promotionalPrice
      ? formatBRL(Number(product.promotionalPrice))
      : null,
    promotionalPriceNumber: product.promotionalPrice
      ? Number(product.promotionalPrice)
      : null,
    colors,
    sizes,
    variants: product.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      stockQuantity: v.stockQuantity,
    })),
    tags,
    has3D: product.has3DModel,
    modelUrl: await resolveModelUrl(product.model3D?.fileUrl ?? null),
    model3DAvailableSizes: product.model3D?.availableSizes ?? [],
    gender: product.gender,
    collection: product.collection,
    composition: product.composition,
    careInstructions: product.careInstructions,
    returnPolicy: product.returnPolicy,
    maxInstallments: product.maxInstallments,
    reviews: {
      average: reviewAverage,
      count: approvedReviews.length,
      items: approvedReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        authorName: r.user.name,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    sizeChart: product.sizeChart
      ? {
          name: product.sizeChart.name,
          rows: product.sizeChart.measures.map((m) => ({
            size: m.size,
            chestMinCm: m.chestMinCm,
            chestMaxCm: m.chestMaxCm,
            waistMinCm: m.waistMinCm,
            waistMaxCm: m.waistMaxCm,
            hipMinCm: m.hipMinCm,
            hipMaxCm: m.hipMaxCm,
            armLengthMinCm: m.armLengthMinCm,
            armLengthMaxCm: m.armLengthMaxCm,
            legLengthMinCm: m.legLengthMinCm,
            legLengthMaxCm: m.legLengthMaxCm,
          })),
        }
      : null,
  };
}
