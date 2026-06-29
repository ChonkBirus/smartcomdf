import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ServiceOrder, ServiceOrderItem } from "@/lib/service-orders.functions";

export const listMyServiceOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      scope: z.enum(["mine", "all"]).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) throw new Error("Sem empresa vinculada.");
    let q = sb
      .from("service_orders")
      .select(`
        id, company_id, service_order_number, title, status, priority,
        scheduled_date, scheduled_start_time, scheduled_end_time,
        assigned_technician_id,
        customers:customer_id(name,trade_name,corporate_name),
        address:customer_address_id(street,number,neighborhood,city,state),
        technician:assigned_technician_id(full_name,email)
      `)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("scheduled_start_time", { ascending: true, nullsFirst: false });

    if (!data.scope || data.scope === "mine") {
      q = q.eq("assigned_technician_id", context.userId);
    }

    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("scheduled_date", data.from);
    if (data.to) q = q.lte("scheduled_date", data.to);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(`service_order_number.ilike.%${s}%,title.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => {
      const addr = r.address;
      const short = addr
        ? [addr.street, addr.number].filter(Boolean).join(", ") +
          (addr.neighborhood ? ` — ${addr.neighborhood}` : "") +
          (addr.city ? `, ${addr.city}/${addr.state ?? ""}` : "")
        : null;
      return {
        ...r,
        customer_name:
          r.customers?.trade_name || r.customers?.name || r.customers?.corporate_name || "—",
        technician_name: r.technician?.full_name ?? r.technician?.email ?? null,
        address_short: short,
      };
    });
  });

export type MobileServiceOrderDetails = {
  so: ServiceOrder;
  customer: any;
  address: any;
  contact: any;
  project: any;
  quote: any;
  company: { name: string | null } | null;
  items: ServiceOrderItem[];
};

export const getMobileServiceOrderDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MobileServiceOrderDetails | null> => {
    const sb = context.supabase as any;
    const { data: so, error } = await sb
      .from("service_orders")
      .select(`*,
        customers:customer_id(id,name,trade_name,corporate_name,cpf_cnpj,email,phone,whatsapp),
        address:customer_address_id(*),
        contact:customer_contact_id(*),
        projects:project_id(id,project_number,title),
        quotes:quote_id(id,quote_number),
        technician:assigned_technician_id(full_name,email),
        company:company_id(name,trade_name)
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
      },
      customer: so.customers,
      address: so.address,
      contact: so.contact,
      project: so.projects,
      quote: so.quotes,
      company: so.company ? { name: so.company.trade_name || so.company.name } : null,
      items: (items ?? []).map((it: any) => ({
        ...it,
        planned_quantity: Number(it.planned_quantity || 0),
        used_quantity: Number(it.used_quantity || 0),
      })),
    };
  });
