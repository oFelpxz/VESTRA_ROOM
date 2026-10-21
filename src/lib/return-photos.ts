import { signModelUrl, storageConfigured } from "@/lib/storage";

/**
 * Links temporários (10 min) das fotos de uma troca. O bucket é privado:
 * só quem já passou pela checagem da página (dono ou Admin) chega aqui.
 */
export async function signReturnPhotos(photos: { id: string; path: string }[]) {
  if (!storageConfigured() || photos.length === 0) return [];
  const signed = await Promise.all(
    photos.map(async (p) => {
      try {
        return { id: p.id, url: await signModelUrl(p.path, 600) };
      } catch (e) {
        console.error("[trocas] não assinou a foto", p.path, e);
        return null;
      }
    }),
  );
  return signed.filter((p): p is { id: string; url: string } => p !== null);
}
