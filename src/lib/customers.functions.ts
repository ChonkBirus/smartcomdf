import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CustomerType = "INDIVIDUAL" | "COMPANY";
export type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE" | "BLOCKED";
export type CustomerAddressType = "BILLING" | "INSTALLATION" | "DELIVERY" | "OTHER";
export type CustomerHistoryType = "NOTE" | "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "SYSTEM";

export type Customer = {
  id: string;
  company_id: string;
  customer_type: CustomerType;
  name: string;
  corporate_name: string | null;
  trade_name: string | null;
  cpf_cnpj: string;
  state_registration: string | null;
  municipal_registration: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  customer_status: CustomerStatus;
  customer_origin: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CustomerAddress = {
  id: string;
  company_id: string;
  customer_id: string;
  address_type: CustomerAddressType;
  country: string;
  zipcode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerContact = {
  id: string;
  company_id: string;
  customer_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomerHistoryEntry = {
  id: string;
  company_id: string;
  customer_id: string;
  user_id: string | null;
  history_type: CustomerHistoryType;
  title: string;
  description: string | null;
  created_at: string;
};

export type CustomerTag = {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const nstr = (max: number) =>
  z.preprocess((v) => (v === null || v === undefined ? "" : v), z.string().trim().max(max)).optional();

const addressSchema = z.object({
  id: z.string().uuid().optional(),
  address_type: z.enum(["BILLING", "INSTALLATION", "DELIVERY", "OTHER"]).default("BILLING"),
  zipcode: nstr(20),
  street: nstr(200),
  number: nstr(20),
  complement: nstr(100),
  district: nstr(100),
  city: nstr(100),
  state: nstr(2),
  reference: nstr(200),
  is_primary: z.boolean().default(false),
});

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(150),
  role: nstr(100),
  email: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.string().trim().email().max(200),
  ).optional(),
  phone: nstr(30),
  whatsapp: nstr(30),
  is_primary: z.boolean().default(false),
  active: z.boolean().default(true),
});

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  customer_type: z.enum(["INDIVIDUAL", "COMPANY"]),
  name: z.string().trim().min(2).max(200),
  corporate_name: nstr(200),
  trade_name: nstr(200),
  cpf_cnpj: z.string().trim().min(11).max(20),
  state_registration: nstr(50),
  municipal_registration: nstr(50),
  email: z.preprocess(
    (v) => (v === null || v === undefined || v === "" ? undefined : v),
    z.string().trim().email().max(200),
  ).optional(),
  phone: nstr(30),
  whatsapp: nstr(30),
  customer_status: z.enum(["LEAD", "ACTIVE", "INACTIVE", "BLOCKED"]).default("ACTIVE"),
  customer_origin: nstr(100),
  notes: nstr(4000),
  active: z.boolean().default(true),
  addresses: z.array(addressSchema).default([]),
  contacts: z.array(contactSchema).default([]),
  tag_ids: z.array(z.string().uuid()).default([]),
});

// ============================================================
// LIST
// ============================================================
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().optional(),
      customer_type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
      customer_status: z.enum(["LEAD", "ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
      city: z.string().optional(),
      tag_id: z.string().uuid().optional(),
      origin: z.string().optional(),
      active: z.boolean().optional(),
      sort: z.enum(["name", "created_at", "city", "status"]).default("created_at"),
      page: z.number().int().min(1).default(1),
      page_size: z.number().int().min(1).max(100).default(20),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = sb
      .from("customers")
      .select(
        `*,
         customer_addresses!left(*),
         customer_tag_relations!left(tag_id, customer_tags(id, name, color))`,
        { count: "exact" },
      )
      .is("deleted_at", null);

    if (data.customer_type) q = q.eq("customer_type", data.customer_type);
    if (data.customer_status) q = q.eq("customer_status", data.customer_status);
    if (typeof data.active === "boolean") q = q.eq("active", data.active);
    if (data.origin) q = q.eq("customer_origin", data.origin);
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(
        `name.ilike.%${s}%,corporate_name.ilike.%${s}%,trade_name.ilike.%${s}%,cpf_cnpj.ilike.%${s}%,email.ilike.%${s}%,whatsapp.ilike.%${s}%`,
      );
    }

    if (data.sort === "name") q = q.order("name");
    else if (data.sort === "status") q = q.order("customer_status");
    else q = q.order("created_at", { ascending: false });

    q = q.range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    let filtered = rows ?? [];
    if (data.city) {
      const c = data.city.toLowerCase();
      filtered = filtered.filter((r: any) =>
        (r.customer_addresses ?? []).some((a: any) => (a.city ?? "").toLowerCase().includes(c)),
      );
    }
    if (data.tag_id) {
      filtered = filtered.filter((r: any) =>
        (r.customer_tag_relations ?? []).some((t: any) => t.tag_id === data.tag_id),
      );
    }

    return {
      total: count ?? filtered.length,
      page: data.page,
      page_size: data.page_size,
      items: filtered.map((r: any) => ({
        ...r,
        primary_address:
          (r.customer_addresses ?? []).find((a: any) => a.is_primary) ??
          (r.customer_addresses ?? [])[0] ??
          null,
        tags: (r.customer_tag_relations ?? [])
          .map((t: any) => t.customer_tags)
          .filter(Boolean),
      })),
    };
  });

// ============================================================
// GET (with addresses/contacts/tags/history-light)
// ============================================================
export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: customer, error } = await sb
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) return null;

    const [{ data: addresses }, { data: contacts }, { data: tagRels }] = await Promise.all([
      sb.from("customer_addresses").select("*").eq("customer_id", data.id).order("is_primary", { ascending: false }),
      sb.from("customer_contacts").select("*").eq("customer_id", data.id).order("is_primary", { ascending: false }),
      sb.from("customer_tag_relations").select("tag_id, customer_tags(id, name, color)").eq("customer_id", data.id),
    ]);

    return {
      ...(customer as Customer),
      addresses: (addresses ?? []) as CustomerAddress[],
      contacts: (contacts ?? []) as CustomerContact[],
      tags: (tagRels ?? []).map((t: any) => t.customer_tags).filter(Boolean) as CustomerTag[],
    };
  });

// ============================================================
// SAVE (create or update with nested addresses/contacts/tags)
// ============================================================
export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => customerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    const cid = profile.company_id as string;

    if (data.customer_type === "INDIVIDUAL" && onlyDigits(data.cpf_cnpj).length !== 11) {
      throw new Error("CPF inválido para pessoa física.");
    }
    if (data.customer_type === "COMPANY" && onlyDigits(data.cpf_cnpj).length !== 14) {
      throw new Error("CNPJ inválido para pessoa jurídica.");
    }

    const cpfCnpj = onlyDigits(data.cpf_cnpj);
    // Duplicate check (per company)
    const dupQuery = sb
      .from("customers")
      .select("id")
      .eq("company_id", cid)
      .eq("cpf_cnpj", cpfCnpj)
      .is("deleted_at", null);
    const { data: dup } = data.id ? await dupQuery.neq("id", data.id) : await dupQuery;
    if ((dup ?? []).length > 0) throw new Error("Já existe um cliente com este CPF/CNPJ.");

    const basePayload = {
      company_id: cid,
      customer_type: data.customer_type,
      name: data.name,
      corporate_name: data.corporate_name || null,
      trade_name: data.trade_name || null,
      cpf_cnpj: cpfCnpj,
      state_registration: data.state_registration || null,
      municipal_registration: data.municipal_registration || null,
      email: data.email || null,
      phone: data.phone || null,
      whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
      customer_status: data.customer_status,
      customer_origin: data.customer_origin || null,
      notes: data.notes || null,
      active: data.active,
    };

    let customerId: string;
    if (data.id) {
      const { data: old } = await sb.from("customers").select("*").eq("id", data.id).maybeSingle();
      const { error } = await sb.from("customers").update(basePayload).eq("id", data.id);
      if (error) throw new Error(error.message);
      customerId = data.id;
      await sb.rpc("log_audit", {
        _module: "clients",
        _action: "update",
        _record_id: customerId,
        _old_data: old,
        _new_data: basePayload,
      });
    } else {
      const { data: row, error } = await sb
        .from("customers")
        .insert({ ...basePayload, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      customerId = row.id as string;
      await sb.rpc("log_audit", {
        _module: "clients",
        _action: "create",
        _record_id: customerId,
        _new_data: basePayload,
      });
      await sb.rpc("notify_user", {
        _user_id: context.userId,
        _company_id: cid,
        _title: "Cliente criado",
        _message: `${data.name} foi cadastrado.`,
      });
    }

    // Addresses: replace strategy
    await sb.from("customer_addresses").delete().eq("customer_id", customerId);
    if (data.addresses.length > 0) {
      const hasPrimary = data.addresses.some((a) => a.is_primary);
      const rows = data.addresses.map((a, idx) => ({
        company_id: cid,
        customer_id: customerId,
        address_type: a.address_type,
        zipcode: a.zipcode || null,
        street: a.street || null,
        number: a.number || null,
        complement: a.complement || null,
        district: a.district || null,
        city: a.city || null,
        state: a.state ? a.state.toUpperCase() : null,
        reference: a.reference || null,
        is_primary: hasPrimary ? a.is_primary : idx === 0,
      }));
      const { error: errA } = await sb.from("customer_addresses").insert(rows);
      if (errA) throw new Error(errA.message);
    }

    // Contacts: replace strategy
    await sb.from("customer_contacts").delete().eq("customer_id", customerId);
    if (data.contacts.length > 0) {
      const hasPrimary = data.contacts.some((c) => c.is_primary);
      const rows = data.contacts.map((c, idx) => ({
        company_id: cid,
        customer_id: customerId,
        name: c.name,
        role: c.role || null,
        email: c.email || null,
        phone: c.phone || null,
        whatsapp: c.whatsapp ? onlyDigits(c.whatsapp) : null,
        is_primary: hasPrimary ? c.is_primary : idx === 0,
        active: c.active,
      }));
      const { error: errC } = await sb.from("customer_contacts").insert(rows);
      if (errC) throw new Error(errC.message);
    }

    // Tags: replace strategy
    await sb.from("customer_tag_relations").delete().eq("customer_id", customerId);
    if (data.tag_ids.length > 0) {
      const rows = data.tag_ids.map((tid) => ({
        company_id: cid,
        customer_id: customerId,
        tag_id: tid,
      }));
      await sb.from("customer_tag_relations").insert(rows);
    }

    return { id: customerId };
  });

// ============================================================
// TOGGLE active / disable
// ============================================================
export const toggleCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("customers")
      .update({ active: data.active, customer_status: data.active ? "ACTIVE" : "INACTIVE" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "clients",
      _action: data.active ? "enable" : "disable",
      _record_id: data.id,
    });
    if (!data.active) {
      const { data: profile } = await sb
        .from("profiles")
        .select("company_id")
        .eq("id", context.userId)
        .maybeSingle();
      if (profile?.company_id) {
        await sb.rpc("notify_user", {
          _user_id: context.userId,
          _company_id: profile.company_id,
          _title: "Cliente desativado",
          _message: "Um cliente foi desativado.",
        });
      }
    }
    return { ok: true };
  });

// ============================================================
// SOFT DELETE
// ============================================================
export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "clients",
      _action: "delete",
      _record_id: data.id,
    });
    return { ok: true };
  });

// ============================================================
// HISTORY
// ============================================================
export const listCustomerHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("customer_history")
      .select("*")
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustomerHistoryEntry[];
  });

export const addCustomerHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      customer_id: z.string().uuid(),
      history_type: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING", "SYSTEM"]),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(4000).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    const payload = {
      company_id: profile.company_id,
      customer_id: data.customer_id,
      user_id: context.userId,
      history_type: data.history_type,
      title: data.title,
      description: data.description || null,
    };
    const { data: row, error } = await sb
      .from("customer_history")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", {
      _module: "clients",
      _action: "history_create",
      _record_id: row.id,
      _new_data: payload,
    });
    await sb.rpc("notify_user", {
      _user_id: context.userId,
      _company_id: profile.company_id,
      _title: "Nova interação registrada",
      _message: data.title,
    });
    return { id: row.id as string };
  });

// ============================================================
// TAGS
// ============================================================
export const listCustomerTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("customer_tags")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustomerTag[];
  });

export const createCustomerTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(50),
      color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default("#3B82F6"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    const { data: row, error } = await sb
      .from("customer_tags")
      .insert({ company_id: profile.company_id, name: data.name, color: data.color })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as CustomerTag;
  });

// ============================================================
// DASHBOARD METRICS
// ============================================================
export const customerMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ count: total }, { count: active }, { count: individual }, { count: company }, { count: newMonth }] =
      await Promise.all([
        sb.from("customers").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("customers").select("*", { count: "exact", head: true }).is("deleted_at", null).eq("active", true),
        sb
          .from("customers")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("customer_type", "INDIVIDUAL"),
        sb
          .from("customers")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("customer_type", "COMPANY"),
        sb
          .from("customers")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("created_at", firstOfMonth),
      ]);

    return {
      total: total ?? 0,
      active: active ?? 0,
      individual: individual ?? 0,
      company: company ?? 0,
      new_this_month: newMonth ?? 0,
    };
  });
