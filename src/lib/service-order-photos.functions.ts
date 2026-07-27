import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceOrderPhoto = {
  id: string;
  company_id: string;
  service_order_id: string;
  photo_type: "BEFORE" | "DURING" | "AFTER" | "PROBLEM" | "MATERIAL" | "OTHER";
  file_url: string; // stored as storage path inside bucket
  file_name: string;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  signed_url?: string | null;
  uploaded_by_name?: string | null;
};

const BUCKET = "service-order-photos";
const SIGNED_TTL = 60 * 60; // 1h

export const listServiceOrderPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceOrderPhoto[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_photos")
      .select(`*, uploader:uploaded_by(full_name,email)`)
      .eq("service_order_id", data.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const photos = rows ?? [];
    const paths = photos.map((p: any) => p.file_url).filter(Boolean);
    let signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedMap.set(s.path, s.signedUrl);
      });
    }
    return photos.map((p: any) => ({
      ...p,
      signed_url: signedMap.get(p.file_url) ?? null,
      uploaded_by_name: p.uploader?.full_name ?? p.uploader?.email ?? null,
    }));
  });

export const registerServiceOrderPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    serviceOrderId: z.string().uuid(),
    photoType: z.enum(["BEFORE", "DURING", "AFTER", "PROBLEM", "MATERIAL", "OTHER"]),
    filePath: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().nonnegative().optional(),
    description: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { assertUploadedObject } = await import("@/lib/storage-validate.server");
    await assertUploadedObject(sb, BUCKET, data.filePath, {
      allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxBytes: 10 * 1024 * 1024,
    });
    const { data: row, error } = await sb.rpc("so_photo_register", {
      _so_id: data.serviceOrderId,
      _photo_type: data.photoType,
      _file_url: data.filePath,
      _file_name: data.fileName,
      _file_size: data.fileSize ?? null,
      _description: data.description ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteServiceOrderPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: path, error } = await sb.rpc("so_photo_delete", { _photo_id: data.photoId });
    if (error) throw new Error(error.message);
    if (path) {
      await sb.storage.from(BUCKET).remove([path]);
    }
    return { ok: true };
  });
