/**
 * Server-side validation of a just-uploaded storage object. Reads the
 * object's metadata via `storage.from(bucket).list(...)` and verifies
 * MIME type / size against an allow-list. On failure the object is
 * removed and an Error is thrown.
 *
 * This closes the gap where clients upload directly to Supabase Storage
 * with only client-side ACCEPT / MAX_SIZE checks in place.
 */
export async function assertUploadedObject(
  sb: any,
  bucket: string,
  filePath: string,
  opts: { allowedMimeTypes: string[]; maxBytes: number },
): Promise<void> {
  const slash = filePath.lastIndexOf("/");
  const folder = slash >= 0 ? filePath.slice(0, slash) : "";
  const name = slash >= 0 ? filePath.slice(slash + 1) : filePath;

  const { data: rows, error } = await sb.storage
    .from(bucket)
    .list(folder, { search: name, limit: 1 });

  const fail = async (reason: string) => {
    try {
      await sb.storage.from(bucket).remove([filePath]);
    } catch {
      /* best-effort cleanup */
    }
    throw new Error(reason);
  };

  if (error) await fail(`Falha ao validar arquivo enviado: ${error.message}`);
  const obj = (rows ?? []).find((r: any) => r?.name === name);
  if (!obj) await fail("Arquivo enviado não encontrado no bucket.");

  const mime: string | undefined =
    obj.metadata?.mimetype || obj.metadata?.contentType;
  const size: number | undefined = obj.metadata?.size;

  if (!mime || !opts.allowedMimeTypes.includes(mime)) {
    await fail(`Tipo de arquivo não permitido${mime ? `: ${mime}` : ""}.`);
  }
  if (typeof size === "number" && size > opts.maxBytes) {
    await fail(
      `Arquivo excede o tamanho máximo permitido (${Math.round(
        opts.maxBytes / (1024 * 1024),
      )} MB).`,
    );
  }
}
