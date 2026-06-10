"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ProductFormState = {
  error?: string;
  success?: boolean;
};

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function str(v: FormDataEntryValue | null): string {
  return v === null ? "" : String(v).trim();
}

function optionalStr(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

function decimal(v: FormDataEntryValue | null): number | null {
  const s = str(v).replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function int(v: FormDataEntryValue | null): number {
  const n = Number(str(v));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// ---------- Produtos ----------

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const name = str(formData.get("name"));
  const categoryId = str(formData.get("categoryId"));
  const basePrice = decimal(formData.get("basePrice"));

  if (!name) return { error: "Informe o nome do produto." };
  if (!categoryId) return { error: "Selecione uma categoria." };
  if (basePrice === null) return { error: "Informe um preço base válido." };

  const baseSlug = slugify(name);
  if (!baseSlug) return { error: "Nome inválido." };

  // Garante slug único
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const promotionalPrice = decimal(formData.get("promotionalPrice"));
  const description = optionalStr(formData.get("description"));
  const brand = optionalStr(formData.get("brand"));
  const availableForVirtualTryOn =
    str(formData.get("availableForVirtualTryOn")) === "on";

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      brand,
      basePrice,
      promotionalPrice,
      categoryId,
      availableForVirtualTryOn,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/produtos");
  redirect(`/admin/produtos/${product.id}`);
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return { error: "Produto não encontrado." };

  const name = str(formData.get("name"));
  const categoryId = str(formData.get("categoryId"));
  const basePrice = decimal(formData.get("basePrice"));

  if (!name) return { error: "Informe o nome do produto." };
  if (!categoryId) return { error: "Selecione uma categoria." };
  if (basePrice === null) return { error: "Informe um preço base válido." };

  await prisma.product.update({
    where: { id },
    data: {
      name,
      categoryId,
      basePrice,
      promotionalPrice: decimal(formData.get("promotionalPrice")),
      description: optionalStr(formData.get("description")),
      brand: optionalStr(formData.get("brand")),
      availableForVirtualTryOn:
        str(formData.get("availableForVirtualTryOn")) === "on",
    },
  });

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}`);
  return { success: true };
}

export async function publishProductAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { where: { status: "ACTIVE" }, select: { id: true } },
      images: { select: { id: true } },
    },
  });
  if (!product) return;
  if (product.variants.length === 0 || product.images.length === 0) {
    // sem variantes ou imagens — não publica
    return;
  }

  await prisma.product.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/catalogo");
}

export async function unpublishProductAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  await prisma.product.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/catalogo");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const hasOrders = await prisma.orderItem.count({
    where: { productVariant: { productId: id } },
  });

  if (hasOrders > 0) {
    // Soft delete: apenas inativa
    await prisma.product.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  } else {
    await prisma.product.delete({ where: { id } });
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/catalogo");
  redirect("/admin/produtos");
}

// ---------- Variantes ----------

export async function addVariantAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const productId = str(formData.get("productId"));
  const sku = str(formData.get("sku")).toUpperCase();
  const color = str(formData.get("color"));
  const size = str(formData.get("size"));
  const stockQuantity = int(formData.get("stockQuantity"));
  const price = decimal(formData.get("price"));

  if (!productId) return { error: "Produto inválido." };
  if (!sku) return { error: "Informe o SKU." };
  if (!color) return { error: "Informe a cor." };
  if (!size) return { error: "Informe o tamanho." };

  const exists = await prisma.productVariant.findUnique({ where: { sku } });
  if (exists) return { error: "Já existe uma variante com esse SKU." };

  await prisma.productVariant.create({
    data: {
      productId,
      sku,
      color,
      size,
      price,
      stockQuantity,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/admin/produtos/${productId}`);
  return { success: true };
}

export async function updateVariantStockAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  const stockQuantity = int(formData.get("stockQuantity"));
  if (!id) return;

  const variant = await prisma.productVariant.update({
    where: { id },
    data: { stockQuantity },
    select: { productId: true },
  });

  revalidatePath(`/admin/produtos/${variant.productId}`);
}

export async function toggleVariantStatusAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const v = await prisma.productVariant.findUnique({
    where: { id },
    select: { status: true, productId: true },
  });
  if (!v) return;

  await prisma.productVariant.update({
    where: { id },
    data: { status: v.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath(`/admin/produtos/${v.productId}`);
}

export async function removeVariantAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const inUse = await prisma.orderItem.count({
    where: { productVariantId: id },
  });

  const v = await prisma.productVariant.findUnique({
    where: { id },
    select: { productId: true },
  });
  if (!v) return;

  if (inUse > 0) {
    await prisma.productVariant.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  } else {
    await prisma.productVariant.delete({ where: { id } });
  }

  revalidatePath(`/admin/produtos/${v.productId}`);
}

// ---------- Imagens ----------

export async function addProductImageAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const productId = str(formData.get("productId"));
  const url = str(formData.get("url"));
  const altText = optionalStr(formData.get("altText"));
  const position = int(formData.get("position"));

  if (!productId) return { error: "Produto inválido." };
  if (!url) return { error: "Informe a URL da imagem." };
  if (!/^https?:\/\/|^\/.+/.test(url)) {
    return { error: "URL inválida (use http(s):// ou caminho /...)." };
  }

  await prisma.productImage.create({
    data: { productId, url, altText, position },
  });

  revalidatePath(`/admin/produtos/${productId}`);
  return { success: true };
}

export async function removeProductImageAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const img = await prisma.productImage.delete({
    where: { id },
    select: { productId: true },
  });

  revalidatePath(`/admin/produtos/${img.productId}`);
}
