"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteModelObject, isCloudObject } from "@/lib/storage";

export type Model3DFormState = { error?: string; success?: boolean };

async function requireModelAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "MODEL_3D") {
    throw new Error("Acesso negado.");
  }
  return session!.user!;
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

function str(v: FormDataEntryValue | null): string {
  return v === null ? "" : String(v).trim();
}

/**
 * Registra (ou substitui criando uma nova versão) o modelo 3D de um produto.
 * Chamada pelo client após o upload via /api/models-3d/upload.
 */
export async function registerModel3DAction(
  _prev: Model3DFormState,
  formData: FormData,
): Promise<Model3DFormState> {
  await requireModelAccess();

  const productId = str(formData.get("productId"));
  const fileUrl = str(formData.get("fileUrl"));
  const fileSizeRaw = str(formData.get("fileSizeMb"));
  const formatRaw = str(formData.get("format")).toUpperCase();

  if (!productId) return { error: "Produto inválido." };
  if (!fileUrl) return { error: "Arquivo inválido." };

  const format = formatRaw === "GLTF" ? "GLTF" : "GLB";
  const fileSizeMb = Number(fileSizeRaw) || null;

  const existing = await prisma.model3D.findUnique({ where: { productId } });

  if (existing) {
    // Guarda a versão atual no histórico (item 3D-02) antes de sobrescrever.
    await prisma.$transaction([
      prisma.model3DVersion.create({
        data: {
          model3DId: existing.id,
          version: existing.version,
          fileUrl: existing.fileUrl,
          format: existing.format,
          textureUrl: existing.textureUrl,
          fileSizeMb: existing.fileSizeMb,
        },
      }),
      prisma.model3D.update({
        where: { productId },
        data: {
          fileUrl,
          format,
          fileSizeMb,
          textureUrl: null,
          version: existing.version + 1,
          status: "PENDING",
        },
      }),
    ]);
  } else {
    await prisma.model3D.create({
      data: {
        productId,
        fileUrl,
        format,
        fileSizeMb,
        version: 1,
        status: "PENDING",
      },
    });
  }

  // Quando entra uma versão nova, produto não está mais "com 3D validado".
  await prisma.product.update({
    where: { id: productId },
    data: { has3DModel: false },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${productId}`);
  revalidatePath(`/admin/produtos/${productId}`);
  return { success: true };
}

export async function validateModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "VALIDATED" },
    select: { productId: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: true },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
  revalidatePath(`/admin/produtos/${model.productId}`);
  revalidatePath("/catalogo");
}

export async function rejectModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "REJECTED" },
    select: { productId: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: false },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
  revalidatePath(`/admin/produtos/${model.productId}`);
}

export async function markOptimizedAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.update({
    where: { id },
    data: { status: "OPTIMIZED" },
    select: { productId: true },
  });

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${model.productId}`);
}

/**
 * Restaura uma versão anterior do histórico (item 3D-02). A versão atual
 * também é preservada no histórico antes da troca, então dá pra ir e voltar.
 * O modelo restaurado volta para PENDING — precisa ser revalidado.
 */
export async function restoreModel3DVersionAction(formData: FormData) {
  await requireAdmin();

  const versionId = str(formData.get("versionId"));
  if (!versionId) return;

  const version = await prisma.model3DVersion.findUnique({
    where: { id: versionId },
    include: { model3D: true },
  });
  if (!version) return;

  const current = version.model3D;

  await prisma.$transaction([
    prisma.model3DVersion.create({
      data: {
        model3DId: current.id,
        version: current.version,
        fileUrl: current.fileUrl,
        format: current.format,
        textureUrl: current.textureUrl,
        fileSizeMb: current.fileSizeMb,
      },
    }),
    prisma.model3D.update({
      where: { id: current.id },
      data: {
        fileUrl: version.fileUrl,
        format: version.format,
        textureUrl: version.textureUrl,
        fileSizeMb: version.fileSizeMb,
        version: current.version + 1,
        status: "PENDING",
      },
    }),
    prisma.product.update({
      where: { id: current.productId },
      data: { has3DModel: false },
    }),
  ]);

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/modelos-3d/${current.productId}`);
  revalidatePath(`/admin/produtos/${current.productId}`);
}

/** Define quais tamanhos do produto têm simulação 3D validada (item 3D-02). */
export async function setAvailableSizesAction(formData: FormData) {
  await requireModelAccess();

  const productId = str(formData.get("productId"));
  if (!productId) return;

  const sizes = formData.getAll("sizes").map((s) => String(s));

  const model = await prisma.model3D.update({
    where: { productId },
    data: { availableSizes: sizes },
    select: { productId: true },
  });

  revalidatePath(`/admin/modelos-3d/${model.productId}`);
  revalidatePath(`/produto/${productId}`);
}

export async function deleteModel3DAction(formData: FormData) {
  await requireAdmin();

  const id = str(formData.get("id"));
  if (!id) return;

  const model = await prisma.model3D.delete({
    where: { id },
    select: { productId: true, fileUrl: true },
  });

  await prisma.product.update({
    where: { id: model.productId },
    data: { has3DModel: false },
  });

  // Remove o arquivo: objeto no Storage ou arquivo local em public/models
  if (isCloudObject(model.fileUrl)) {
    try {
      await deleteModelObject(model.fileUrl);
    } catch (e) {
      // não bloqueia a exclusão do registro
      console.error("Falha ao remover objeto do Storage:", e);
    }
  } else if (model.fileUrl.startsWith("/models/")) {
    try {
      const absolute = path.join(
        process.cwd(),
        "public",
        model.fileUrl.replace(/^\//, ""),
      );
      await unlink(absolute);
    } catch {
      // ignora se o arquivo não existir
    }
  }

  revalidatePath("/admin/modelos-3d");
  revalidatePath(`/admin/produtos/${model.productId}`);
}
