import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizePostgrestSearch } from "@/lib/postgrest-sanitize";

export type QuoteStatus =
  | "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "REJECTED"
  | "CANCELLED" | "EXPIRED" | "CONVERTED";

export type QuoteItemKind = "PRODUCT" | "SERVICE" | "LABOR" | "OTHER";

export type Quote = {
  id: string;
  company_id: string;
  customer_id: string;
  customer_name?: string;
  quote_number: string;
  status: QuoteStatus;
  title: string | null;
  issue_date: string;
  valid_until: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  warranty_terms: string | null;
  completion_estimate: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  labor_cost: number;
  discount: number;
  items_subtotal: number;
  total_amount: number;
  approved_at: string | null;
  cancelled_at: string | null;
  public_token: string;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_document: string | null;
  first_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  payment_status: QuotePaymentStatus;
  financial_status: QuoteFinancialStatus;
  paid_amount: number;
  project_id: string | null;
  down_payment_percent: number;
  down_payment_amount: number;
  remaining_amount: number;
  payment_approved_at: string | null;
  diagnosis_problem: string | null;
  diagnosis_need: string | null;
  diagnosis_environment: string | null;
  diagnosis_objective: string | null;
  diagnosis_critical_points: string | null;
  diagnosis_technical_notes: string | null;
};

export type QuotePaymentStatus =
  | "NOT_STARTED" | "WAITING_PAYMENT" | "PAYMENT_APPROVED"
  | "PAYMENT_REJECTED" | "PAYMENT_CANCELLED";

export type QuoteFinancialStatus =
  | "PENDING" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "REFUNDED";


export type QuoteHistoryEvent = {
  id: string;
  quote_id: string;
  event_type: string;
  actor_label: string | null;
  meta: Record<string, any>;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  company_id: string;
  quote_id: string;
  item_id: string | null;
  kind: QuoteItemKind;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
  position: number;
  image_path: string | null;
};

const itemLineSchema = z.object({
  id: z.string().uuid().optional(),
  item_id: z.string().uuid().nullable().optional(),
  kind: z.enum(["PRODUCT", "SERVICE", "LABOR", "OTHER"]).default("PRODUCT"),
  name: z.string().trim().min(1, "Nome obrigatório.").max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantity: z.number().positive("Quantidade > 0."),
  unit_price: z.number().min(0),
  cost_price: z.number().min(0).default(0),
  position: z.number().int().min(0).default(0),
  image_path: z.string().trim().max(500).optional().nullable(),
});


const quoteSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid("Selecione um cliente."),
  title: z.string().trim().max(200).optional().nullable(),
  issue_date: z.string().min(1),
  valid_until: z.string().optional().nullable(),
  payment_terms: z.string().trim().max(1000).optional().nullable(),
  delivery_terms: z.string().trim().max(1000).optional().nullable(),
  warranty_terms: z.string().trim().max(1000).optional().nullable(),
  completion_estimate: z.string().trim().max(300).optional().nullable(),
  customer_notes: z.string().trim().max(4000).optional().nullable(),
  internal_notes: z.string().trim().max(4000).optional().nullable(),
  labor_cost: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  diagnosis_problem: z.string().trim().max(2000).optional().nullable(),
  diagnosis_need: z.string().trim().max(2000).optional().nullable(),
  diagnosis_environment: z.string().trim().max(2000).optional().nullable(),
  diagnosis_objective: z.string().trim().max(2000).optional().nullable(),
  diagnosis_critical_points: z.string().trim().max(2000).optional().nullable(),
  diagnosis_technical_notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(itemLineSchema).min(1, "Adicione pelo menos um item."),
});

const nz = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

// ============================================================
// CATALOG (products + services with prices) for quote form
// ============================================================
export type QuoteCatalogItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  item_type: "PRODUCT" | "SERVICE";
  sale_price: number;
  cost_price: number;
  description: string | null;
  image_path: string | null;
  controls_stock: boolean;
  stock_quantity: number | null;
};

export const listQuoteCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data: inputData, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    
    const s = sanitizePostgrestSearch(inputData.search ?? "");
    let query = sb
      .from("items")
      .select("id, name, sku, unit, item_type, sale_price, cost_price, description, controls_stock, stock_quantity, image_path")
      .eq("company_id", profile.company_id)
      .is("deleted_at", null)
      .eq("active", true)
      .in("item_type", ["PRODUCT", "SERVICE"]);

    if (s) {
      query = query.or(`sku.ilike.${s},name.ilike.%${s}%,sku.ilike.%${s}%`);
    }

    query = query.limit(50);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let itemsRaw = (data ?? []) as any[];
    if (s) {
      const searchLower = s.toLowerCase();
      itemsRaw.sort((a, b) => {
        const aSku = (a.sku || "").toLowerCase();
        const bSku = (b.sku || "").toLowerCase();
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();

        // 1. SKU exact match
        const aSkuExact = aSku === searchLower;
        const bSkuExact = bSku === searchLower;
        if (aSkuExact && !bSkuExact) return -1;
        if (!aSkuExact && bSkuExact) return 1;

        // 2. Name starts with
        const aNameStarts = aName.startsWith(searchLower);
        const bNameStarts = bName.startsWith(searchLower);
        if (aNameStarts && !bNameStarts) return -1;
        if (!aNameStarts && bNameStarts) return 1;

        // 3. Name contains
        const aNameContains = aName.includes(searchLower);
        const bNameContains = bName.includes(searchLower);
        if (aNameContains && !bNameContains) return -1;
        if (!aNameContains && bNameContains) return 1;

        // 4. SKU starts with
        const aSkuStarts = aSku.startsWith(searchLower);
        const bSkuStarts = bSku.startsWith(searchLower);
        if (aSkuStarts && !bSkuStarts) return -1;
        if (!aSkuStarts && bSkuStarts) return 1;

        // 5. SKU contains
        const aSkuContains = aSku.includes(searchLower);
        const bSkuContains = bSku.includes(searchLower);
        if (aSkuContains && !bSkuContains) return -1;
        if (!aSkuContains && bSkuContains) return 1;

        // 6. Default: alphabetical by name
        return aName.localeCompare(bName);
      });
    } else {
      itemsRaw.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    // Keep only the top 50 after sorting
    const topItems = itemsRaw.slice(0, 50);
    const ids = topItems.map((r: any) => r.id);

    const imgMap = new Map<string, string>();
    const stockMap = new Map<string, number>();
    if (ids.length > 0) {
      const productIds = topItems
        .filter((r: any) => r.item_type === "PRODUCT" && r.controls_stock)
        .map((r: any) => r.id);

      const [{ data: imgs }, { data: bal }] = await Promise.all([
        sb.from("item_images")
          .select("item_id, file_path, is_primary, created_at")
          .in("item_id", ids)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
        productIds.length
          ? sb.from("stock_balances")
              .select("item_id, quantity")
              .eq("company_id", profile.company_id)
              .in("item_id", productIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      (imgs ?? []).forEach((im: any) => {
        if (!imgMap.has(im.item_id)) imgMap.set(im.item_id, im.file_path);
      });
      (bal ?? []).forEach((b: any) => {
        stockMap.set(b.item_id, (stockMap.get(b.item_id) || 0) + Number(b.quantity || 0));
      });
    }
    return topItems.map((r: any) => ({
      id: r.id,

      name: r.name,
      sku: r.sku,
      unit: r.unit,
      item_type: r.item_type,
      sale_price: Number(r.sale_price || 0),
      cost_price: Number(r.cost_price || 0),
      description: r.description ?? null,
      image_path: imgMap.get(r.id) ?? null,
      controls_stock: Boolean(r.controls_stock),
      stock_quantity: r.item_type === "PRODUCT" && r.controls_stock ? (stockMap.get(r.id) ?? 0) : null,
    })) as QuoteCatalogItem[];
  });




// ============================================================
// LIST
// ============================================================
export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      status: z.string().optional(),
      payment_status: z.string().optional(),
      customer_id: z.string().uuid().optional(),
      search: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    let q = sb
      .from("quotes")
      .select("*, customers:customer_id(name, trade_name, corporate_name)")
      .eq("company_id", prof.company_id)
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.payment_status) q = q.eq("payment_status", data.payment_status);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    const s = sanitizePostgrestSearch(data.search ?? "");
    if (s) {
      q = q.or(`quote_number.ilike.%${s}%,title.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id);
    let pendingReceiptSet = new Set<string>();
    if (ids.length > 0) {
      const { data: payRows } = await sb
        .from("quote_payments")
        .select("quote_id, receipt_status")
        .in("quote_id", ids)
        .eq("receipt_status", "PENDING_REVIEW");
      pendingReceiptSet = new Set((payRows ?? []).map((p: any) => p.quote_id));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      labor_cost: Number(r.labor_cost || 0),
      discount: Number(r.discount || 0),
      items_subtotal: Number(r.items_subtotal || 0),
      total_amount: Number(r.total_amount || 0),
      down_payment_percent: Number(r.down_payment_percent || 0),
      down_payment_amount: Number(r.down_payment_amount || 0),
      remaining_amount: Number(r.remaining_amount || 0),
      has_pending_receipt: pendingReceiptSet.has(r.id),
      customer_name:
        r.customers?.trade_name || r.customers?.name || r.customers?.corporate_name || "—",
    })) as (Quote & { has_pending_receipt: boolean })[];
  });

// ============================================================
// METRICS
// ============================================================
export const quoteMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data: rows, error } = await sb
      .from("quotes")
      .select("status, total_amount, created_at")
      .eq("company_id", prof.company_id);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const month = new Date();
    month.setDate(1); month.setHours(0, 0, 0, 0);
    const sumBy = (pred: (r: any) => boolean) =>
      list.filter(pred).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    return {
      total: list.length,
      draft: list.filter((r: any) => r.status === "DRAFT").length,
      open: list.filter((r: any) => ["SENT", "VIEWED"].includes(r.status)).length,
      approved: list.filter((r: any) => r.status === "APPROVED").length,
      this_month: list.filter((r: any) => new Date(r.created_at) >= month).length,
      approved_value: sumBy((r) => r.status === "APPROVED"),
      open_value: sumBy((r) => ["SENT", "VIEWED"].includes(r.status)),
    };
  });

// ============================================================
// GET single
// ============================================================
export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data: q, error: e1 } = await sb
      .from("quotes")
      .select("*, customers:customer_id(id, name, trade_name, corporate_name, cpf_cnpj, email, phone, whatsapp)")
      .eq("id", data.id)
      .eq("company_id", prof.company_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!q) return null;
    const { data: items, error: e2 } = await sb
      .from("quote_items")
      .select("*")
      .eq("quote_id", data.id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return {
      quote: {
        ...q,
        labor_cost: Number(q.labor_cost || 0),
        discount: Number(q.discount || 0),
        items_subtotal: Number(q.items_subtotal || 0),
        total_amount: Number(q.total_amount || 0),
        down_payment_percent: Number(q.down_payment_percent || 0),
        down_payment_amount: Number(q.down_payment_amount || 0),
        remaining_amount: Number(q.remaining_amount || 0),
        customer_name:
          q.customers?.trade_name || q.customers?.name || q.customers?.corporate_name || "—",
      } as Quote,
      customer: q.customers
        ? {
            id: q.customers.id,
            name: q.customers.name,
            trade_name: q.customers.trade_name,
            corporate_name: q.customers.corporate_name,
            cpf_cnpj: q.customers.cpf_cnpj,
            email: q.customers.email,
            phone: q.customers.phone,
            whatsapp: q.customers.whatsapp,
          }
        : null,
      items: (items ?? []).map((it: any) => ({
        ...it,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        cost_price: Number(it.cost_price || 0),
        total: Number(it.total),
      })) as QuoteItem[],
    };
  });

// ============================================================
// SAVE (create/update — DRAFT/SENT/VIEWED editable)
// ============================================================
export const saveQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => quoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    const companyId = profile.company_id;

    let quoteId = data.id;

    if (quoteId) {
      const { data: existing } = await sb
        .from("quotes").select("status").eq("id", quoteId).maybeSingle();
      if (!existing) throw new Error("Orçamento não encontrado.");
      if (!["DRAFT", "SENT", "VIEWED"].includes(existing.status)) {
        throw new Error("Orçamento aprovado/cancelado/expirado não pode ser editado. Duplique para nova revisão.");
      }
      const { error } = await sb.from("quotes").update({
        customer_id: data.customer_id,
        title: nz(data.title),
        issue_date: data.issue_date,
        valid_until: nz(data.valid_until),
        payment_terms: nz(data.payment_terms),
        delivery_terms: nz(data.delivery_terms),
        warranty_terms: nz(data.warranty_terms),
        completion_estimate: nz(data.completion_estimate),
        customer_notes: nz(data.customer_notes),
        internal_notes: nz(data.internal_notes),
        labor_cost: data.labor_cost,
        discount: data.discount,
        diagnosis_problem: nz(data.diagnosis_problem),
        diagnosis_need: nz(data.diagnosis_need),
        diagnosis_environment: nz(data.diagnosis_environment),
        diagnosis_objective: nz(data.diagnosis_objective),
        diagnosis_critical_points: nz(data.diagnosis_critical_points),
        diagnosis_technical_notes: nz(data.diagnosis_technical_notes),
      }).eq("id", quoteId);
      if (error) throw new Error(error.message);
      await sb.from("quote_items").delete().eq("quote_id", quoteId);
    } else {
      const { data: numRow, error: ne } = await sb.rpc("next_quote_number", { _company_id: companyId });
      if (ne) throw new Error(ne.message);
      const { data: row, error } = await sb.from("quotes").insert({
        company_id: companyId,
        customer_id: data.customer_id,
        quote_number: numRow as string,
        status: "DRAFT",
        title: nz(data.title),
        issue_date: data.issue_date,
        valid_until: nz(data.valid_until) ?? new Date(new Date(data.issue_date).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        payment_terms: nz(data.payment_terms),
        delivery_terms: nz(data.delivery_terms),
        warranty_terms: nz(data.warranty_terms),
        completion_estimate: nz(data.completion_estimate),
        customer_notes: nz(data.customer_notes),
        internal_notes: nz(data.internal_notes),
        labor_cost: data.labor_cost,
        discount: data.discount,
        diagnosis_problem: nz(data.diagnosis_problem),
        diagnosis_need: nz(data.diagnosis_need),
        diagnosis_environment: nz(data.diagnosis_environment),
        diagnosis_objective: nz(data.diagnosis_objective),
        diagnosis_critical_points: nz(data.diagnosis_critical_points),
        diagnosis_technical_notes: nz(data.diagnosis_technical_notes),
        created_by: context.userId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      quoteId = row.id as string;
    }

    const itemsPayload = data.items.map((it, idx) => ({
      company_id: companyId,
      quote_id: quoteId,
      item_id: it.item_id || null,
      kind: it.kind,
      name: it.name,
      description: nz(it.description ?? null),
      quantity: it.quantity,
      unit_price: it.unit_price,
      cost_price: it.cost_price ?? 0,
      position: it.position ?? idx,
      image_path: nz(it.image_path ?? null),
    }));

    const { error: ie } = await sb.from("quote_items").insert(itemsPayload);
    if (ie) throw new Error(ie.message);

    await sb.rpc("log_audit", {
      _module: "quotes",
      _action: data.id ? "update" : "create",
      _record_id: quoteId,
      _new_data: { customer_id: data.customer_id, items_count: data.items.length },
    });

    return { id: quoteId };
  });

// ============================================================
// STATUS TRANSITIONS
// ============================================================
async function setStatus(
  sb: any,
  id: string,
  from: QuoteStatus[],
  to: QuoteStatus,
  extra: Record<string, any> = {},
) {
  const { data: cur } = await sb.from("quotes").select("status").eq("id", id).maybeSingle();
  if (!cur) throw new Error("Orçamento não encontrado.");
  if (!from.includes(cur.status)) {
    throw new Error(`Transição inválida (de ${cur.status} para ${to}).`);
  }
  const { error } = await sb.from("quotes").update({ status: to, ...extra }).eq("id", id);
  if (error) throw new Error(error.message);
}

export const markQuoteSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await setStatus(sb, data.id, ["DRAFT", "VIEWED"], "SENT");
    return { ok: true };
  });

export const cancelQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await setStatus(
      sb, data.id,
      ["DRAFT", "SENT", "VIEWED", "APPROVED"],
      "CANCELLED",
      { cancelled_at: new Date().toISOString(), internal_notes: data.reason || undefined },
    );
    return { ok: true };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: q } = await sb.from("quotes").select("status").eq("id", data.id).maybeSingle();
    if (!q) throw new Error("Orçamento não encontrado.");
    if (!["DRAFT", "CANCELLED"].includes(q.status)) {
      throw new Error("Apenas rascunhos ou cancelados podem ser excluídos.");
    }
    const { error } = await sb.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "quotes", _action: "delete", _record_id: data.id });
    return { ok: true };
  });

export const duplicateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");

    const { data: src } = await sb.from("quotes").select("*").eq("id", data.id).maybeSingle();
    if (!src) throw new Error("Orçamento não encontrado.");
    const { data: items } = await sb.from("quote_items").select("*").eq("quote_id", data.id);

    const { data: num } = await sb.rpc("next_quote_number", { _company_id: profile.company_id });
    const { data: row, error } = await sb.from("quotes").insert({
      company_id: profile.company_id,
      customer_id: src.customer_id,
      quote_number: num as string,
      status: "DRAFT",
      title: src.title,
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: null,
      payment_terms: src.payment_terms,
      delivery_terms: src.delivery_terms,
      warranty_terms: src.warranty_terms,
      completion_estimate: src.completion_estimate,
      customer_notes: src.customer_notes,
      internal_notes: src.internal_notes,
      labor_cost: src.labor_cost,
      discount: src.discount,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if ((items ?? []).length > 0) {
      await sb.from("quote_items").insert(
        items.map((it: any, idx: number) => ({
          company_id: profile.company_id,
          quote_id: row.id,
          item_id: it.item_id,
          kind: it.kind,
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          cost_price: it.cost_price,
          position: it.position ?? idx,
        })),
      );
    }
    await sb.rpc("log_audit", { _module: "quotes", _action: "duplicate", _record_id: row.id });
    return { id: row.id as string };
  });

// ============================================================
// EXPIRE outdated (manual trigger)
// ============================================================
export const expireOutdatedQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("quotes_mark_expired");
    if (error) throw new Error(error.message);
    return { expired: Number(data ?? 0) };
  });

// ============================================================
// HISTORY
// ============================================================
export const getQuoteHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("quote_history")
      .select("id, quote_id, event_type, actor_label, meta, created_at")
      .eq("quote_id", data.quote_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as QuoteHistoryEvent[];
  });

export const logQuoteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    quote_id: z.string().uuid(),
    event_type: z.enum(["sent", "link_copied", "whatsapp_sent", "pdf_downloaded", "email_sent", "pix_sent_whatsapp", "pix_copied"]),
    actor_label: z.string().trim().max(120).optional(),
    meta: z.record(z.string(), z.any()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: q } = await sb.from("quotes").select("company_id").eq("id", data.quote_id).maybeSingle();
    if (!q) throw new Error("Orçamento não encontrado.");
    const { error } = await sb.from("quote_history").insert({
      company_id: q.company_id,
      quote_id: data.quote_id,
      event_type: data.event_type,
      actor_user_id: context.userId,
      actor_label: data.actor_label ?? null,
      meta: data.meta ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
