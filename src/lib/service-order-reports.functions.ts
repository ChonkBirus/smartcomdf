import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceOrderReport = {
  id: string;
  company_id: string;
  service_order_id: string;
  report_number: string;
  status: "DRAFT" | "GENERATED" | "SIGNED" | "SENT" | "CANCELLED";
  public_token: string | null;
  pdf_file_url: string | null;
  pdf_file_name: string | null;
  generated_by: string | null;
  generated_at: string | null;
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  signed_pdf_url?: string | null;
};

export type ServiceOrderReportSendEvent = {
  id: string;
  report_id: string;
  channel: "WHATSAPP" | "EMAIL" | "COPY_LINK" | "PDF_DOWNLOAD" | "MANUAL";
  status: "SENT" | "FAILED" | "COPIED" | "DOWNLOADED";
  recipient_name: string | null;
  recipient_contact: string | null;
  message: string | null;
  sent_at: string;
  sent_by: string | null;
};

const BUCKET = "service-order-reports";
const SIGNED_TTL = 60 * 60;

async function withSignedPdf(sb: any, rep: any): Promise<ServiceOrderReport> {
  if (!rep?.pdf_file_url) return { ...rep, signed_pdf_url: null };
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(rep.pdf_file_url, SIGNED_TTL);
  return { ...rep, signed_pdf_url: data?.signedUrl ?? null };
}

export const getServiceOrderReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ service_order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceOrderReport | null> => {
    const sb = context.supabase as any;
    const { data: rep, error } = await sb
      .from("service_order_reports")
      .select("*")
      .eq("service_order_id", data.service_order_id)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rep) return null;
    return await withSignedPdf(sb, rep);
  });

export const generateServiceOrderFinalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ service_order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceOrderReport> => {
    const sb = context.supabase as any;
    const { data: rep, error } = await sb.rpc("so_generate_final_report", {
      _service_order_id: data.service_order_id,
    });
    if (error) throw new Error(error.message);
    return await withSignedPdf(sb, rep);
  });

export const uploadServiceOrderReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      report_id: z.string().uuid(),
      company_id: z.string().uuid(),
      service_order_id: z.string().uuid(),
      file_name: z.string().min(1),
      file_base64: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ServiceOrderReport> => {
    const sb = context.supabase as any;
    const path = `${data.company_id}/${data.service_order_id}/${data.report_id}.pdf`;
    const bin = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bin, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: rep, error } = await sb.rpc("so_attach_report_pdf", {
      _report_id: data.report_id,
      _pdf_path: path,
      _pdf_name: data.file_name,
    });
    if (error) throw new Error(error.message);
    return await withSignedPdf(sb, rep);
  });

export const logServiceOrderReportSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      report_id: z.string().uuid(),
      channel: z.enum(["WHATSAPP", "EMAIL", "COPY_LINK", "PDF_DOWNLOAD", "MANUAL"]),
      status: z.enum(["SENT", "FAILED", "COPIED", "DOWNLOADED"]),
      recipient_name: z.string().nullable().optional(),
      recipient_contact: z.string().nullable().optional(),
      message: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: ev, error } = await sb.rpc("so_log_report_send", {
      _report_id: data.report_id,
      _channel: data.channel,
      _status: data.status,
      _recipient_name: data.recipient_name ?? null,
      _recipient_contact: data.recipient_contact ?? null,
      _message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return ev as ServiceOrderReportSendEvent;
  });

export const listServiceOrderReportSendEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ report_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ServiceOrderReportSendEvent[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_report_send_events")
      .select("*")
      .eq("report_id", data.report_id)
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* -------------------- PUBLIC (no auth) -------------------- */

export const getPublicServiceOrderReport = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(16) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: payload, error } = await sb.rpc("get_public_so_report", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!payload) throw new Error("Relatório não encontrado.");
    const p: any = payload;
    // Sign PDF and assets using service role only when needed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let pdfUrl: string | null = null;
    if (p.report?.pdf_file_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("service-order-reports")
        .createSignedUrl(p.report.pdf_file_url, 60 * 60);
      pdfUrl = signed?.signedUrl ?? null;
    }
    const photoPaths: string[] = (p.photos ?? []).map((ph: any) => ph.storage_path).filter(Boolean);
    const signedPhotos = new Map<string, string>();
    if (photoPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("service-order-photos")
        .createSignedUrls(photoPaths, 60 * 60);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedPhotos.set(s.path, s.signedUrl);
      });
    }
    const sigPaths: string[] = (p.signatures ?? []).map((s: any) => s.signature_file_url).filter(Boolean);
    const signedSigs = new Map<string, string>();
    if (sigPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("service-order-signatures")
        .createSignedUrls(sigPaths, 60 * 60);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedSigs.set(s.path, s.signedUrl);
      });
    }
    return {
      ...p,
      report: { ...p.report, signed_pdf_url: pdfUrl },
      photos: (p.photos ?? []).map((ph: any) => ({ ...ph, signed_url: signedPhotos.get(ph.storage_path) ?? null })),
      signatures: (p.signatures ?? []).map((s: any) => ({ ...s, signed_url: signedSigs.get(s.signature_file_url) ?? null })),
    };
  });
