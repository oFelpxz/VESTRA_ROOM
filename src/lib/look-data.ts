import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { resolveModelUrl } from "@/lib/storage";
import { sortSizes } from "@/lib/sizes";
import { categoriesOfKind, type ChartRow } from "@/lib/fit-regions";
import { ACCESSORY_CATEGORY } from "@/lib/looks";

/** Peça que pode completar um look no provador (item 15). */
export type LookProduct = {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  variants: { id: string; color: string; size: string; stockQuantity: number }[];
  sizeChart: ChartRow[];
  /** Molde 3D validado (veste no avatar junto com a peça do provador). */
  modelUrl: string | null;
};

/** Peças à venda de um tipo (as de baixo para quem prova uma de cima, e vice-versa). */
export function getLookCompanions(kind: "top" | "bottom"): Promise<LookProduct[]> {
  return lookProducts(categoriesOfKind(kind));
}

/** Acessórios à venda (touca), a terceira peça opcional do look. */
export function getLookAccessories(): Promise<LookProduct[]> {
  return lookProducts([ACCESSORY_CATEGORY]);
}

async function lookProducts(categories: string[]): Promise<LookProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      category: { slug: { in: categories } },
      variants: { some: { status: "ACTIVE" } },
    },
    include: {
      images: { orderBy: { position: "asc" }, take: 1 },
      variants: { where: { status: "ACTIVE" } },
      sizeChart: { include: { measures: { orderBy: { createdAt: "asc" } } } },
      model3D: { select: { fileUrl: true, status: true } },
    },
    orderBy: { name: "asc" },
    take: 40,
  });

  return Promise.all(products.map(async (p) => ({
    id: p.id,
    name: p.name,
    price: formatBRL(Number(p.promotionalPrice ?? p.basePrice)),
    imageUrl: p.images[0]?.url ?? null,
    colors: [...new Set(p.variants.map((v) => v.color))],
    sizes: sortSizes([...new Set(p.variants.map((v) => v.size))]),
    variants: p.variants.map((v) => ({
      id: v.id,
      color: v.color,
      size: v.size,
      stockQuantity: v.stockQuantity,
    })),
    sizeChart: (p.sizeChart?.measures ?? []).map((m) => ({
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
    modelUrl:
      p.has3DModel && p.availableForVirtualTryOn && p.model3D?.status === "VALIDATED"
        ? await resolveModelUrl(p.model3D.fileUrl)
        : null,
  })));
}

/** Look do cliente aberto no provador (`?look=`), visto do lado de uma peça. */
export type OpenLook = {
  id: string;
  name: string;
  /** Variante da peça deste provador. */
  ownVariantId: string | null;
  /** Variante da outra peça. */
  companionVariantId: string | null;
  companionProductId: string | null;
  /** Acessório do look (touca), se tiver. */
  accessoryVariantId: string | null;
};

export async function getOpenLook(
  lookId: string,
  userId: string,
  productId: string,
): Promise<OpenLook | null> {
  const look = await prisma.savedLook.findFirst({
    where: { id: lookId, userId },
    include: {
      topVariant: { select: { id: true, productId: true } },
      bottomVariant: { select: { id: true, productId: true } },
    },
  });
  if (!look) return null;
  const [own, other] =
    look.topVariant?.productId === productId
      ? [look.topVariant, look.bottomVariant]
      : look.bottomVariant?.productId === productId
        ? [look.bottomVariant, look.topVariant]
        : [null, null];
  if (!own) return null;
  return {
    id: look.id,
    name: look.name,
    ownVariantId: own.id,
    companionVariantId: other?.id ?? null,
    companionProductId: other?.productId ?? null,
    accessoryVariantId: look.accessoryVariantId,
  };
}
