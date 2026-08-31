"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AdminFormState = { error?: string; success?: boolean };

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

function num(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------- Categorias ----------

export async function createCategoryAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da categoria." };

  const slug = slugify(name);
  if (!slug) return { error: "Nome inválido." };

  const exists = await prisma.category.findUnique({ where: { slug } });
  if (exists) return { error: "Já existe uma categoria com esse nome." };

  await prisma.category.create({ data: { name, slug } });
  revalidatePath("/admin/categorias");
  return { success: true };
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    // Não deleta categoria que ainda tem produtos.
    return;
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categorias");
}

// ---------- Tabela de medidas ----------

const SIZES = ["P", "M", "G", "GG"] as const;

export async function saveSizeChartAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Selecione um produto." };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { error: "Produto não encontrado." };

  const rows = SIZES.map((s) => ({
    size: s,
    chestMinCm: num(formData.get(`${s}_chestMin`)),
    chestMaxCm: num(formData.get(`${s}_chestMax`)),
    waistMinCm: num(formData.get(`${s}_waistMin`)),
    waistMaxCm: num(formData.get(`${s}_waistMax`)),
    hipMinCm: num(formData.get(`${s}_hipMin`)),
    hipMaxCm: num(formData.get(`${s}_hipMax`)),
    armLengthMinCm: num(formData.get(`${s}_armLengthMin`)),
    armLengthMaxCm: num(formData.get(`${s}_armLengthMax`)),
    legLengthMinCm: num(formData.get(`${s}_legLengthMin`)),
    legLengthMaxCm: num(formData.get(`${s}_legLengthMax`)),
  }));

  const chart = await prisma.sizeChart.upsert({
    where: { productId },
    update: { name: "Tabela de medidas" },
    create: { productId, name: "Tabela de medidas" },
  });

  await prisma.sizeChartMeasure.deleteMany({
    where: { sizeChartId: chart.id },
  });
  await prisma.sizeChartMeasure.createMany({
    data: rows.map((r) => ({ ...r, sizeChartId: chart.id })),
  });

  revalidatePath("/admin/medidas");
  return { success: true };
}
