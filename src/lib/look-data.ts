import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { resolveModelUrl } from "@/lib/storage";
import { sortSizes } from "@/lib/sizes";
import { categoriesOfKind, type ChartRow } from "@/lib/fit-regions";
import { ACCESSORY_CATEGORY } from "@/lib/looks";
import { BRAND_LOOKS, type BrandLook } from "@/lib/brand-looks";
import type { Prisma } from "@/generated/prisma/client";

/** Peça que pode completar um look no provador (item 15). */
export type LookProduct = {
  id: string;
  slug: string;
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
  return lookProducts({ category: { slug: { in: categoriesOfKind(kind) } } });
}

/** Acessórios à venda (touca), a terceira peça opcional do look. */
export function getLookAccessories(): Promise<LookProduct[]> {
  return lookProducts({ category: { slug: ACCESSORY_CATEGORY } });
}

/** Peça de um look pronto, já com o produto do banco. */
export type BrandLookItem = { role: "top" | "bottom" | "accessory"; product: LookProduct; color: string };
export type ResolvedBrandLook = BrandLook & { items: BrandLookItem[] };

/**
 * Looks prontos da marca com as peças à venda. Um look sai da lista se faltar
 * alguma peça ou cor (produto pausado, cor apagada).
 */
export async function getBrandLooks(): Promise<ResolvedBrandLook[]> {
  const slugs = [...new Set(BRAND_LOOKS.flatMap((l) => [l.top, l.bottom, l.accessory]))]
    .flatMap((p) => (p ? [p.product] : []));
  const products = await lookProducts({ slug: { in: slugs } });
  return BRAND_LOOKS.flatMap((look) => {
    const items: BrandLookItem[] = [];
    for (const [role, piece] of [["top", look.top], ["bottom", look.bottom], ["accessory", look.accessory]] as const) {
      if (!piece) continue;
      const product = products.find((p) => p.slug === piece.product);
      if (!product?.colors.includes(piece.color)) return [];
      items.push({ role, product, color: piece.color });
    }
    return [{ ...look, items }];
  });
}

async function lookProducts(where: Prisma.ProductWhereInput): Promise<LookProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...where,
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
    slug: p.slug,
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
