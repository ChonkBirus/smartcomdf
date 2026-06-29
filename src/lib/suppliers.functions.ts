import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Supplier = {
  id: string;
  company_id: string;
  corporate_name: string;
  trade_name: string | null;
  cpf_cnpj: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  zipcode: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  corporate_name: z.string().trim().min(2).max(200),
  trade_name: z.string().trim().max(200).optional().or(z.literal("")),
  cpf_cnpj: z.string().trim().min(11).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  zipcode: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  number: z.string().trim().max(20).optional().or(z.literal("")),
  complement: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    search: z.string().optional(),
    active: z.boolean().optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    let q = sb.from("suppliers").select("*").eq("company_id", prof.company_id).is("deleted_at", null).order("corporate_name");
    if (typeof data.active === "boolean") q = q.eq("active", data.active);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(
        `corporate_name.ilike.%${s}%,trade_name.ilike.%${s}%,cpf_cnpj.ilike.%${s}%,email.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Supplier[];
  });

export const getSupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data: row, error } = await sb.from("suppliers").select("*").eq("id", data.id).eq("company_id", prof.company_id).maybeSingle();
    if (error) throw new Error(error.message);
    return row as Supplier | null;
  });

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => supplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");

    const payload = {
      company_id: profile.company_id,
      corporate_name: data.corporate_name,
      trade_name: data.trade_name || null,
      cpf_cnpj: onlyDigits(data.cpf_cnpj),
      email: data.email || null,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      website: data.website || null,
      zipcode: data.zipcode || null,
      address: data.address || null,
      number: data.number || null,
      complement: data.complement || null,
      district: data.district || null,
      city: data.city || null,
      state: data.state ? data.state.toUpperCase() : null,
      notes: data.notes || null,
      active: data.active,
    };

    if (data.id) {
      const { data: old } = await sb.from("suppliers").select("*").eq("id", data.id).maybeSingle();
      const { error } = await sb.from("suppliers").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await sb.rpc("log_audit", { _module: "suppliers", _action: "update", _record_id: data.id, _old_data: old, _new_data: payload });
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("suppliers").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "suppliers", _action: "create", _record_id: row.id, _new_data: payload });
    return { id: row.id as string };
  });

export const toggleSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("suppliers").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "suppliers", _action: data.active ? "enable" : "disable", _record_id: data.id });
    return { ok: true };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("suppliers").update({ deleted_at: new Date().toISOString(), active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "suppliers", _action: "delete", _record_id: data.id });
    return { ok: true };
  });
