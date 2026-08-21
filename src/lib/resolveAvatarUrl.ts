import { getSignedImageUrl } from "@/lib/profile.functions";

/**
 * Resolve avatar_url para uma URL renderizável.
 * - vazio/inválido -> null (usa fallback com iniciais)
 * - http(s):// -> retorna como está
 * - path relativo do bucket privado "avatars" -> gera signed URL curta
 */
export async function resolveAvatarUrl(avatarUrl?: string | null): Promise<string | null> {
  const v = (avatarUrl ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return null; // evita path local do Vite
  try {
    const { url } = await getSignedImageUrl({ data: { bucket: "avatars", path: v } });
    return url ?? null;
  } catch {
    return null;
  }
}
