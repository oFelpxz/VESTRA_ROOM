import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";

export type ProductFilters = {
  categoria?: string;
  tamanho?: string;
  cor?: string;
  preco?: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  price: string;
  tags: string[];
};

export type SizeChartRow = {
  size: string;
  chestMinCm: number | null;
  chestMaxCm: number | null;
  waistMinCm: number | null;
  waistMaxCm: number | null;
  hipMinCm: number | null;
  hipMaxCm: number | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  category: string;
  price: string;
  promotionalPrice: string | null;
  colors: string[];
  sizes: string[];
  tags: string[];
  has3D: boolean;
  modelUrl: string | null;
  sizeChart: { name: string; rows: SizeChartRow[] } | null;
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
  const sizes = [...new Set(variants.map((v) => v.size))].sort();
  const colors = [...new Set(variants.map((v) => v.color))].sort();
  return { sizes, colors };
}

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
    },
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) => {
    const tags: string[] = [];
    if (p.has3DModel) tags.push("3D DISPONÍVEL");
    if (p.availableForVirtualTryOn) tags.push("VESTRA FIT");

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: formatBRL(Number(p.basePrice)),
      tags,
    };
  });
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
    },
  });

  if (!product) return null;

  const colors = [...new Set(product.variants.map((v) => v.color))];
  const sizes = [...new Set(product.variants.map((v) => v.size))];

  const tags: string[] = [];
  if (product.has3DModel) tags.push("3D DISPONÍVEL");
  if (product.availableForVirtualTryOn) tags.push("VESTRA FIT");

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category.name,
    price: formatBRL(Number(product.basePrice)),
    promotionalPrice: product.promotionalPrice
      ? formatBRL(Number(product.promotionalPrice))
      : null,
    colors,
    sizes,
    tags,
    has3D: product.has3DModel,
    modelUrl: product.model3D?.fileUrl ?? null,
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
          })),
        }
      : null,
  };
}
