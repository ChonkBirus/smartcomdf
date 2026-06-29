import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotaStatus =
  | "UPLOADED" | "PROCESSING" | "PARSED" | "REVIEWED" | "CONFIRMED" | "FAILED" | "CANCELLED";

export type NotaItemStatus = "PENDING" | "MATCHED" | "NEW" | "IGNORED";

export type NotaDocument = {
  id: string;
  status: NotaStatus;
  original_name: string | null;
  file_path: string;
  mime_type: string | null;
  ai_supplier_name: string | null;
  ai_supplier_cnpj: string | null;
  ai_invoice_number: string | null;
  ai_issue_date: string | null;
  ai_total_amount: number | null;
  ai_confidence: number | null;
  ai_model: string | null;
  supplier_id: string | null;
  location_id: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  confirmed_at: string | null;
};

export type NotaItem = {
  id: string;
  document_id: string;
  line_no: number | null;
  raw_code: string | null;
  raw_name: string;
  raw_unit: string | null;
  raw_quantity: number | null;
  raw_unit_cost: number | null;
  raw_total: number | null;
  matched_item_id: string | null;
  matched_item_name?: string | null;
  matched_item_sku?: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  status: NotaItemStatus;
  confirmed_quantity: number | null;
  confirmed_unit_cost: number | null;
  new_item_payload: any;
  created_item_id: string | null;
};

// ============================================================
// LIST
// ============================================================
export const listNotaDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa vinculada.");
    const { data, error } = await sb
      .from("nota_documents")
      .select(
        "id, status, original_name, file_path, mime_type, ai_supplier_name, ai_supplier_cnpj, ai_invoice_number, ai_issue_date, ai_total_amount, ai_confidence, ai_model, supplier_id, location_id, error_message, created_at, processed_at, confirmed_at",
      )
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      ai_total_amount: r.ai_total_amount !== null ? Number(r.ai_total_amount) : null,
      ai_confidence: r.ai_confidence !== null ? Number(r.ai_confidence) : null,
    })) as NotaDocument[];
  });

// ============================================================
// GET ONE
// ============================================================
export const getNotaDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa vinculada.");
    const { data: doc, error } = await sb
      .from("nota_documents").select("*").eq("id", data.id).eq("company_id", profile.company_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return null;

    const { data: items, error: ie } = await sb
      .from("nota_document_items")
      .select("*, matched:matched_item_id(name, sku)")
      .eq("document_id", data.id)
      .order("line_no", { ascending: true, nullsFirst: true })
      .order("created_at");
    if (ie) throw new Error(ie.message);

    // Signed URL for preview
    let signedUrl: string | null = null;
    if (doc.file_path) {
      const { data: signed } = await sb.storage
        .from("nota-documents")
        .createSignedUrl(doc.file_path, 60 * 30);
      signedUrl = signed?.signedUrl ?? null;
    }

    return {
      doc: {
        ...doc,
        ai_total_amount: doc.ai_total_amount !== null ? Number(doc.ai_total_amount) : null,
        ai_confidence: doc.ai_confidence !== null ? Number(doc.ai_confidence) : null,
      } as NotaDocument,
      items: (items ?? []).map((it: any) => ({
        ...it,
        raw_quantity: it.raw_quantity !== null ? Number(it.raw_quantity) : null,
        raw_unit_cost: it.raw_unit_cost !== null ? Number(it.raw_unit_cost) : null,
        raw_total: it.raw_total !== null ? Number(it.raw_total) : null,
        confirmed_quantity: it.confirmed_quantity !== null ? Number(it.confirmed_quantity) : null,
        confirmed_unit_cost: it.confirmed_unit_cost !== null ? Number(it.confirmed_unit_cost) : null,
        match_confidence: it.match_confidence !== null ? Number(it.match_confidence) : null,
        matched_item_name: it.matched?.name ?? null,
        matched_item_sku: it.matched?.sku ?? null,
      })) as NotaItem[],
      signedUrl,
    };
  });

// ============================================================
// CREATE (after upload)
// ============================================================
export const createNotaDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      file_path: z.string().min(1),
      original_name: z.string().min(1),
      mime_type: z.string().min(1),
      file_size: z.number().int().nonnegative(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");

    const { data: row, error } = await sb.from("nota_documents").insert({
      company_id: profile.company_id,
      uploaded_by: context.userId,
      file_path: data.file_path,
      original_name: data.original_name,
      mime_type: data.mime_type,
      file_size: data.file_size,
      status: "UPLOADED",
    }).select("id").single();
    if (error) throw new Error(error.message);

    await sb.rpc("log_audit", {
      _module: "smart_receiving", _action: "upload", _record_id: row.id,
      _new_data: { original_name: data.original_name, mime_type: data.mime_type },
    });

    return { id: row.id as string };
  });

// ============================================================
// UPLOAD + CREATE in one server call (avoids Preview proxy stripping auth on
// direct browser → Supabase Storage uploads)
// ============================================================
export const uploadNotaFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      original_name: z.string().min(1).max(255),
      mime_type: z.string().min(1).max(120),
      file_size: z.number().int().positive().max(20 * 1024 * 1024),
      file_base64: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    const cid = profile?.company_id;
    if (!cid) throw new Error("Sem empresa.");

    const buf = Buffer.from(data.file_base64, "base64");
    const ext = (data.original_name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const path = `${cid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await sb.storage
      .from("nota-documents")
      .upload(path, buf, { contentType: data.mime_type || "application/octet-stream", upsert: false });
    if (upErr) throw new Error("Falha no upload: " + upErr.message);

    const { data: row, error } = await sb.from("nota_documents").insert({
      company_id: cid,
      uploaded_by: context.userId,
      file_path: path,
      original_name: data.original_name,
      mime_type: data.mime_type,
      file_size: data.file_size,
      status: "UPLOADED",
    }).select("id").single();
    if (error) {
      await sb.storage.from("nota-documents").remove([path]).catch(() => {});
      throw new Error(error.message);
    }

    await sb.rpc("log_audit", {
      _module: "smart_receiving", _action: "upload", _record_id: row.id,
      _new_data: { original_name: data.original_name, mime_type: data.mime_type },
    });

    return { id: row.id as string, file_path: path };
  });

// ============================================================
// PARSE with AI (Lovable AI Gateway - Gemini multimodal)
// ============================================================
const AI_SYSTEM_PROMPT = `Você é um assistente especializado em ler notas fiscais brasileiras (NF-e, NFC-e, cupons fiscais e recibos) de empresas de segurança eletrônica.
Sua tarefa é extrair com precisão os dados estruturados em JSON.

REGRAS:
- Retorne APENAS um objeto JSON válido, sem markdown, sem texto explicativo.
- Use ponto decimal para números (ex: 1234.50).
- Datas no formato YYYY-MM-DD.
- Se um campo não estiver presente, use null (NÃO invente).
- Quantidades, preços unitários e totais devem ser numéricos.
- Para "unit" use abreviações comuns: UN, PC, M, KG, CX, MT.
- Inclua TODOS os itens da nota, mesmo que sejam muitos.

SCHEMA:
{
  "supplier_name": string | null,
  "supplier_cnpj": string | null,
  "invoice_number": string | null,
  "issue_date": string | null,
  "total_amount": number | null,
  "confidence": number,
  "items": [
    {
      "code": string | null,
      "name": string,
      "unit": string | null,
      "quantity": number | null,
      "unit_cost": number | null,
      "total": number | null
    }
  ]
}`;

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t.trim();
}

export const parseNotaDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { data: doc } = await sb.from("nota_documents").select("*").eq("id", data.id).maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.status === "CONFIRMED") throw new Error("Documento já confirmado.");

    await sb.from("nota_documents").update({ status: "PROCESSING", error_message: null }).eq("id", data.id);

    try {
      // Download file from storage
      const { data: blob, error: dErr } = await sb.storage.from("nota-documents").download(doc.file_path);
      if (dErr || !blob) throw new Error("Falha ao baixar arquivo: " + (dErr?.message ?? "vazio"));
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const mime = doc.mime_type || "application/pdf";

      const isImage = mime.startsWith("image/");
      const contentBlock = isImage
        ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
        : { type: "file", file: { filename: doc.original_name || "nota.pdf", file_data: `data:${mime};base64,${base64}` } };

      const model = "google/gemini-2.5-flash";
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "raw-fetch",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Extraia os dados desta nota fiscal em JSON conforme o schema." },
                contentBlock,
              ],
            },
          ],
        }),
      });

      if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns minutos.");
      if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`IA falhou (${resp.status}): ${errText.slice(0, 300)}`);
      }

      const aiJson: any = await resp.json();
      const raw = aiJson.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(stripJsonFence(typeof raw === "string" ? raw : JSON.stringify(raw)));

      // Look up existing items to suggest matches (and learned corrections)
      const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
      const cid = profile.company_id;

      const { data: corrections } = await sb
        .from("ai_parser_corrections")
        .select("source_text, source_code, target_id, target_label")
        .eq("company_id", cid)
        .eq("source_type", "item")
        .order("last_used_at", { ascending: false })
        .limit(500);
      const corrMap = new Map<string, string>();
      for (const c of corrections ?? []) {
        corrMap.set((c.source_text || "").toLowerCase().trim(), c.target_id);
        if (c.source_code) corrMap.set(("CODE:" + c.source_code).toLowerCase(), c.target_id);
      }

      const { data: itemsCatalog } = await sb
        .from("items")
        .select("id, name, sku, unit, cost_price")
        .eq("active", true).eq("controls_stock", true).eq("item_type", "PRODUCT")
        .limit(2000);
      const catalog = (itemsCatalog ?? []) as any[];

      function findMatch(rawName: string, rawCode?: string | null) {
        const nameLc = (rawName || "").toLowerCase().trim();
        if (rawCode) {
          const learned = corrMap.get(("CODE:" + rawCode).toLowerCase());
          if (learned) return { id: learned, conf: 0.99, reason: "Aprendido (código)" };
          const bySku = catalog.find((x) => (x.sku || "").toLowerCase() === rawCode.toLowerCase());
          if (bySku) return { id: bySku.id, conf: 0.95, reason: "Código bate com SKU" };
        }
        const learned = corrMap.get(nameLc);
        if (learned) return { id: learned, conf: 0.95, reason: "Aprendido (nome)" };
        const exact = catalog.find((x) => (x.name || "").toLowerCase() === nameLc);
        if (exact) return { id: exact.id, conf: 0.9, reason: "Nome idêntico" };
        // fuzzy: contains
        const words = nameLc.split(/\s+/).filter((w) => w.length > 2);
        let best: { id: string; score: number } | null = null;
        for (const it of catalog) {
          const itName = (it.name || "").toLowerCase();
          let hits = 0;
          for (const w of words) if (itName.includes(w)) hits++;
          const score = words.length ? hits / words.length : 0;
          if (score >= 0.6 && (!best || score > best.score)) best = { id: it.id, score };
        }
        if (best) return { id: best.id, conf: 0.5 + best.score * 0.3, reason: "Similaridade textual" };
        return null;
      }

      // Match supplier (learned only)
      let supplierMatchId: string | null = null;
      if (parsed.supplier_cnpj || parsed.supplier_name) {
        const { data: supByCnpj } = parsed.supplier_cnpj
          ? await sb.from("suppliers").select("id").eq("cpf_cnpj", String(parsed.supplier_cnpj).replace(/\D/g, "")).maybeSingle()
          : { data: null };
        if (supByCnpj?.id) supplierMatchId = supByCnpj.id;
      }

      // Update doc
      await sb.from("nota_documents").update({
        status: "PARSED",
        ai_supplier_name: parsed.supplier_name ?? null,
        ai_supplier_cnpj: parsed.supplier_cnpj ?? null,
        ai_invoice_number: parsed.invoice_number ?? null,
        ai_issue_date: parsed.issue_date ?? null,
        ai_total_amount: parsed.total_amount ?? null,
        ai_confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        ai_raw: parsed,
        ai_model: model,
        processed_at: new Date().toISOString(),
        supplier_id: supplierMatchId,
      }).eq("id", data.id);

      // Replace items
      await sb.from("nota_document_items").delete().eq("document_id", data.id);

      const rows = (parsed.items ?? []).map((it: any, idx: number) => {
        const match = findMatch(it.name ?? "", it.code ?? null);
        const auto = (match?.conf ?? 0) >= 0.85;
        return {
          document_id: data.id,
          company_id: cid,
          line_no: idx + 1,
          raw_code: it.code ?? null,
          raw_name: String(it.name ?? "").slice(0, 500) || `Item ${idx + 1}`,
          raw_unit: it.unit ?? null,
          raw_quantity: it.quantity ?? null,
          raw_unit_cost: it.unit_cost ?? null,
          raw_total: it.total ?? null,
          matched_item_id: match?.id ?? null,
          match_confidence: match?.conf ?? null,
          match_reason: match?.reason ?? null,
          status: auto ? "MATCHED" : "PENDING",
          confirmed_quantity: it.quantity ?? null,
          confirmed_unit_cost: it.unit_cost ?? null,
        };
      });
      if (rows.length) {
        const { error: ie } = await sb.from("nota_document_items").insert(rows);
        if (ie) throw new Error(ie.message);
      }

      await sb.rpc("log_audit", { _module: "smart_receiving", _action: "parse", _record_id: data.id, _new_data: { items: rows.length, model } });

      return { ok: true, items: rows.length };
    } catch (e: any) {
      await sb.from("nota_documents").update({
        status: "FAILED",
        error_message: String(e?.message ?? e).slice(0, 1000),
      }).eq("id", data.id);
      throw e;
    }
  });

// ============================================================
// UPDATE single item (during review)
// ============================================================
export const updateNotaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["PENDING", "MATCHED", "NEW", "IGNORED"]).optional(),
      matched_item_id: z.string().uuid().nullable().optional(),
      confirmed_quantity: z.number().nonnegative().nullable().optional(),
      confirmed_unit_cost: z.number().nonnegative().nullable().optional(),
      new_item_payload: z
        .object({
          name: z.string().min(1),
          sku: z.string().optional(),
          unit: z.string().optional(),
          cost_price: z.number().nonnegative().optional(),
          sale_price: z.number().nonnegative().optional(),
          minimum_stock: z.number().nonnegative().optional(),
        })
        .nullable()
        .optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload: Record<string, any> = {};
    for (const k of ["status", "matched_item_id", "confirmed_quantity", "confirmed_unit_cost", "new_item_payload"] as const) {
      if (data[k] !== undefined) payload[k] = data[k];
    }
    const { error } = await sb.from("nota_document_items").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// UPDATE document supplier/location (during review)
// ============================================================
export const updateNotaDocumentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      supplier_id: z.string().uuid().nullable().optional(),
      location_id: z.string().uuid().nullable().optional(),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload: Record<string, any> = { status: "REVIEWED" };
    for (const k of ["supplier_id", "location_id", "notes"] as const) {
      if (data[k] !== undefined) payload[k] = data[k];
    }
    const { error } = await sb.from("nota_documents").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// CONFIRM (creates items + stock entries via RPC)
// ============================================================
export const confirmNotaReceiving = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      location_id: z.string().uuid(),
      supplier_id: z.string().uuid().optional(),
      notes: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: res, error } = await sb.rpc("confirm_nota_receiving", {
      _doc_id: data.id,
      _location_id: data.location_id,
      _supplier_id: data.supplier_id ?? null,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return res as { movements: string[]; created_items: string[] };
  });

// ============================================================
// DELETE
// ============================================================
export const deleteNotaDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: doc } = await sb.from("nota_documents").select("file_path, status").eq("id", data.id).maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.status === "CONFIRMED") throw new Error("Notas confirmadas não podem ser excluídas.");
    if (doc.file_path) {
      await sb.storage.from("nota-documents").remove([doc.file_path]);
    }
    const { error } = await sb.from("nota_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "smart_receiving", _action: "delete", _record_id: data.id });
    return { ok: true };
  });

// ============================================================
// Search items (for manual match dropdown)
// ============================================================
export const searchItemsForMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("items")
      .select("id, name, sku, unit")
      .eq("active", true).eq("controls_stock", true).eq("item_type", "PRODUCT")
      .order("name").limit(50);
    const t = data.query?.trim();
    if (t) q = q.or(`name.ilike.%${t}%,sku.ilike.%${t}%,barcode.ilike.%${t}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
