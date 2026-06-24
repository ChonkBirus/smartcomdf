import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceOrderSignature = {
  id: string;
  company_id: string;
  service_order_id: string;
  signature_type: "CUSTOMER" | "TECHNICIAN";
  signer_name: string;
  signer_document: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signature_file_url: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_at: string;
  created_at: string;
  signed_url?: string | null;
};

const BUCKET = "service-order-signatures";
const SIGNED_TTL = 60 * 60;

export const listServiceOrderSignatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceOrderSignature[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_signatures")
      .select("*")
      .eq("service_order_id", data.id)
      .order("signed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const sigs = rows ?? [];
    const paths = sigs.map((s: any) => s.signature_file_url).filter(Boolean);
    const signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedMap.set(s.path, s.signedUrl);
      });
    }
    return sigs.map((s: any) => ({ ...s, signed_url: signedMap.get(s.signature_file_url) ?? null }));
  });

export const collectCustomerSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        serviceOrderId: z.string().uuid(),
        signerName: z.string().trim().min(2).max(120),
        signerDocument: z.string().trim().max(32).optional(),
        signerEmail: z.string().trim().email().optional().or(z.literal("")),
        signerPhone: z.string().trim().max(32).optional(),
        signaturePath: z.string().min(1),
        userAgent: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let ip: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      ip =
        getRequestHeader("cf-connecting-ip") ||
        getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
        getRequestHeader("x-real-ip") ||
        null;
    } catch {
      ip = null;
    }
    const { data: row, error } = await sb.rpc("so_collect_signature", {
      _so_id: data.serviceOrderId,
      _signature_type: "CUSTOMER",
      _signer_name: data.signerName,
      _signature_file_url: data.signaturePath,
      _signer_document: data.signerDocument ?? null,
      _signer_email: data.signerEmail || null,
      _signer_phone: data.signerPhone ?? null,
      _ip_address: ip,
      _user_agent: data.userAgent ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });
