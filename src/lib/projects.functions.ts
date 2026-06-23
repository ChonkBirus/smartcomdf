import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectStatus =
  | "DRAFT" | "READY_TO_SCHEDULE" | "SCHEDULED" | "IN_PROGRESS"
  | "PAUSED" | "COMPLETED" | "CANCELLED";
export type ProjectPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type Project = {
  id: string;
  company_id: string;
  quote_id: string | null;
  customer_id: string;
  customer_address_id: string | null;
  customer_contact_id: string | null;
  project_number: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  total_amount: number;
  down_payment_amount: number;
  remaining_amount: number;
  expected_start_date: string | null;
  expected_end_date: string | null;
  completion_estimate: string | null;
  notes: string | null;
  internal_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  quote_number?: string | null;
  responsible_user_id: string | null;
  responsible_name?: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  planned_start_time: string | null;
  planned_end_time: string | null;
  operational_notes: string | null;
  customer_instructions: string | null;
  access_instructions: string | null;
  parking_instructions: string | null;
  material_status: "NOT_CHECKED" | "AVAILABLE" | "PARTIALLY_AVAILABLE" | "UNAVAILABLE" | "RESERVED";
  planning_status: "PENDING" | "IN_PROGRESS" | "READY_FOR_SERVICE_ORDER";
  materials_checked_at: string | null;
  ready_for_os_at: string | null;
};

export type ProjectItem = {
  id: string;
  project_id: string;
  quote_item_id: string | null;
  item_id: string | null;
  item_type: string;
  name: string;
  description: string | null;
  image_url: string | null;
  quantity: number;
  unit: string;
  reserved_quantity: number;
  used_quantity: number;
  position: number;
};

export const convertQuoteToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ quote_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: pid, error } = await sb.rpc("convert_quote_to_project", {
      _quote_id: data.quote_id,
    });
    if (error) throw new Error(error.message);
    return { project_id: pid as string };
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      customer_id: z.string().uuid().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("projects")
      .select("*, customers:customer_id(name,trade_name,corporate_name), quotes:quote_id(quote_number)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(`project_number.ilike.%${s}%,title.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      total_amount: Number(r.total_amount || 0),
      down_payment_amount: Number(r.down_payment_amount || 0),
      remaining_amount: Number(r.remaining_amount || 0),
      customer_name:
        r.customers?.trade_name || r.customers?.name || r.customers?.corporate_name || "—",
      quote_number: r.quotes?.quote_number ?? null,
    })) as Project[];
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: p, error } = await sb
      .from("projects")
      .select(`*,
        customers:customer_id(id,name,trade_name,corporate_name,cpf_cnpj,email,phone,whatsapp),
        address:customer_address_id(*),
        contact:customer_contact_id(*),
        quotes:quote_id(id,quote_number,total_amount,accepted_at,accepted_by_name)
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;

    const { data: items, error: e2 } = await sb
      .from("project_items")
      .select("*")
      .eq("project_id", data.id)
      .order("position", { ascending: true });
    if (e2) throw new Error(e2.message);

    // stock availability for product items
    const productItemIds = (items ?? [])
      .filter((it: any) => it.item_id && it.item_type === "PRODUCT")
      .map((it: any) => it.item_id);
    let balances: Record<string, number> = {};
    let minimums: Record<string, number> = {};
    if (productItemIds.length) {
      const { data: bal } = await sb
        .from("stock_balances")
        .select("item_id, quantity")
        .in("item_id", productItemIds);
      (bal ?? []).forEach((b: any) => {
        balances[b.item_id] = (balances[b.item_id] || 0) + Number(b.quantity || 0);
      });
      const { data: itm } = await sb
        .from("items")
        .select("id, minimum_stock")
        .in("id", productItemIds);
      (itm ?? []).forEach((i: any) => { minimums[i.id] = Number(i.minimum_stock || 0); });
    }

    const enriched = (items ?? []).map((it: any) => {
      let stock_status: "AVAILABLE" | "LOW" | "OUT" | "NA" = "NA";
      let stock_quantity: number | null = null;
      if (it.item_id && it.item_type === "PRODUCT") {
        const bal = balances[it.item_id] ?? 0;
        const min = minimums[it.item_id] ?? 0;
        stock_quantity = bal;
        if (bal <= 0) stock_status = "OUT";
        else if (bal < Number(it.quantity || 0) || (min > 0 && bal <= min)) stock_status = "LOW";
        else stock_status = "AVAILABLE";
      }
      return {
        ...it,
        quantity: Number(it.quantity || 0),
        reserved_quantity: Number(it.reserved_quantity || 0),
        used_quantity: Number(it.used_quantity || 0),
        stock_status,
        stock_quantity,
      };
    });

    return {
      project: {
        ...p,
        total_amount: Number(p.total_amount || 0),
        down_payment_amount: Number(p.down_payment_amount || 0),
        remaining_amount: Number(p.remaining_amount || 0),
        customer_name:
          p.customers?.trade_name || p.customers?.name || p.customers?.corporate_name || "—",
        quote_number: p.quotes?.quote_number ?? null,
      } as Project,
      customer: p.customers,
      address: p.address,
      contact: p.contact,
      quote: p.quotes,
      items: enriched,
    };
  });

export const updateProjectBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(4000).nullable().optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      expected_start_date: z.string().nullable().optional(),
      expected_end_date: z.string().nullable().optional(),
      internal_notes: z.string().trim().max(4000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { id, ...patch } = data;
    const { error } = await sb.from("projects").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "projects", _action: "update", _record_id: id, _old_data: null,
      _new_data: patch as any,
    });
    return { ok: true };
  });

export const cancelProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("projects")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "projects", _action: "cancel", _record_id: data.id, _old_data: null,
      _new_data: { reason: data.reason ?? null } as any,
    });
    await sb.rpc("log_activity", { _description: `Projeto cancelado.` });
    return { ok: true };
  });
