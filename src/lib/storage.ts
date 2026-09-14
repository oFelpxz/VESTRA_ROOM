import { createClient } from "@supabase/supabase-js";

/**
 * Storage de modelos 3D em nuvem (item 26).
 *
 * Os modelos ficam num bucket PRIVADO do Supabase Storage. O `Model3D.fileUrl`
 * passa a guardar o caminho do objeto (ex.: `boxy-tee-01/v2.glb`), não uma URL.
 * A URL de carregamento é gerada sob demanda via `resolveModelUrl` (signed URL
 * temporária).
 *
 * Modelos antigos, salvos localmente em `public/models/*.glb`, continuam
 * funcionando: o `fileUrl` deles começa com `/` e é devolvido como está.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const MODELS_BUCKET = process.env.SUPABASE_MODELS_BUCKET ?? "models-3d";

/** Tempo de validade das signed URLs dos modelos (2h). */
const SIGNED_URL_TTL = 60 * 60 * 2;

export function storageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Supabase Storage não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** `true` = caminho de objeto no Storage; `false` = arquivo local em /public. */
export function isCloudObject(fileUrl: string): boolean {
  return !fileUrl.startsWith("/");
}

export async function uploadModelObject(
  objectPath: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const { error } = await admin()
    .storage.from(MODELS_BUCKET)
    .upload(objectPath, body, { contentType, upsert: true });
  if (error) {
    throw new Error(`Falha ao enviar para o Storage: ${error.message}`);
  }
  return objectPath;
}

export async function deleteModelObject(objectPath: string): Promise<void> {
  const { error } = await admin()
    .storage.from(MODELS_BUCKET)
    .remove([objectPath]);
  if (error) {
    throw new Error(`Falha ao remover do Storage: ${error.message}`);
  }
}

/** Gera uma signed URL temporária para um objeto do bucket privado. */
export async function signModelUrl(
  objectPath: string,
  expiresIn: number = SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await admin()
    .storage.from(MODELS_BUCKET)
    .createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) {
    throw new Error(`Falha ao assinar URL do modelo: ${error?.message ?? "?"}`);
  }
  return data.signedUrl;
}

/**
 * Resolve um `Model3D.fileUrl` para uma URL que o browser consegue carregar.
 * - objeto no Storage  -> signed URL temporária
 * - arquivo local (`/models/...`) -> devolve como está
 * - falha ao assinar   -> `null` (o viewer cai no placeholder)
 */
export async function resolveModelUrl(
  fileUrl: string | null | undefined,
): Promise<string | null> {
  if (!fileUrl) return null;
  if (!isCloudObject(fileUrl)) return fileUrl;
  try {
    return await signModelUrl(fileUrl);
  } catch (e) {
    console.error("resolveModelUrl:", e);
    return null;
  }
}
