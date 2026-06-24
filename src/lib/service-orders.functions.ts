import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServiceOrderStatus =
  | "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type ServiceOrderPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type ServiceOrder = {
  id: string;
  company_id: string;
  project_id: string;
  quote_id: string | null;
  customer_id: string;
  customer_address_id: string | null;
  customer_contact_id: string | null;
  service_order_number: string;
  title: string;
  description: string | null;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  assigned_technician_id: string | null;
  responsible_user_id: string | null;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  customer_instructions: string | null;
  access_instructions: string | null;
  parking_instructions: string | null;
  technical_notes: string | null;
  internal_notes: string | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  project_number?: string | null;
  technician_name?: string | null;
};

export type ServiceOrderItem = {
  id: string;
  service_order_id: string;
  project_item_id: string | null;
  item_id: string | null;
  item_type: string;
  name: string;
  description: string | null;
  image_url: string | null;
  planned_quantity: number;
  used_quantity: number;
  unit: string;
  position: number;
};

export const createServiceOrderFromProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: id, error } = await sb.rpc("create_service_order_from_project", {
      _project_id: data.project_id,
    });
    if (error) throw new Error(error.message);
    return { service_order_id: id as string };
  });

export const listServiceOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      customer_id: z.string().uuid().optional(),
      technician_id: z.string().uuid().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("service_orders")
      .select(`*,
        customers:customer_id(name,trade_name,corporate_name),
        projects:project_id(project_number),
        technician:assigned_technician_id(full_name,email)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    if (data.technician_id) q = q.eq("assigned_technician_id", data.technician_id);
    if (data.from) q = q.gte("scheduled_date", data.from);
    if (data.to) q = q.lte("scheduled_date", data.to);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(`service_order_number.ilike.%${s}%,title.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      customer_name:
        r.customers?.trade_name || r.customers?.name || r.customers?.corporate_name || "—",
      project_number: r.projects?.project_number ?? null,
      technician_name: r.technician?.full_name ?? r.technician?.email ?? null,
    })) as ServiceOrder[];
  });

export const getServiceOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: so, error } = await sb
      .from("service_orders")
      .select(`*,
        customers:customer_id(id,name,trade_name,corporate_name,cpf_cnpj,email,phone,whatsapp),
        address:customer_address_id(*),
        contact:customer_contact_id(*),
        projects:project_id(id,project_number,title),
        quotes:quote_id(id,quote_number),
        technician:assigned_technician_id(full_name,email)
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!so) return null;
    const { data: items, error: e2 } = await sb
      .from("service_order_items")
      .select("*")
      .eq("service_order_id", data.id)
      .order("position", { ascending: true });
    if (e2) throw new Error(e2.message);
    return {
      so: {
        ...so,
        customer_name:
          so.customers?.trade_name || so.customers?.name || so.customers?.corporate_name || "—",
        project_number: so.projects?.project_number ?? null,
        technician_name: so.technician?.full_name ?? so.technician?.email ?? null,
      } as ServiceOrder,
      customer: so.customers,
      address: so.address,
      contact: so.contact,
      project: so.projects,
      quote: so.quotes,
      items: (items ?? []).map((it: any) => ({
        ...it,
        planned_quantity: Number(it.planned_quantity || 0),
        used_quantity: Number(it.used_quantity || 0),
      })) as ServiceOrderItem[],
    };
  });

export const updateServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      assigned_technician_id: z.string().uuid().nullable().optional(),
      scheduled_date: z.string().nullable().optional(),
      scheduled_start_time: z.string().nullable().optional(),
      scheduled_end_time: z.string().nullable().optional(),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
      customer_instructions: z.string().nullable().optional(),
      access_instructions: z.string().nullable().optional(),
      parking_instructions: z.string().nullable().optional(),
      technical_notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { id, ...patch } = data;
    const { error } = await sb.from("service_orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "service_orders", _action: "update", _record_id: id,
      _old_data: null, _new_data: patch as any,
    });
    return { ok: true };
  });

export const cancelServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("cancel_service_order", {
      _id: data.id, _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const findServiceOrderByProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_orders")
      .select("id, service_order_number, status")
      .eq("project_id", data.project_id)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const listCompanyTechnicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
