import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CrmStageType = "open" | "won" | "lost";
export type CrmLeadType = "pf" | "pj";
export type CrmTemperature = "cold" | "warm" | "hot";
export type CrmSource =
  | "site"
  | "indicacao"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google"
  | "ligacao"
  | "visita"
  | "evento"
  | "outro";
export type CrmCustomerType = "residencial" | "comercial" | "industrial" | "condominio" | "outro";

export type CrmPipeline = {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
};

export type CrmStage = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string | null;
  stage_type: CrmStageType;
  is_won: boolean;
  is_lost: boolean;
};

export type CrmOpportunity = {
  id: string;
  company_id: string;
  pipeline_id: string;
  stage_id: string;
  customer_id: string | null;
  lead_name: string;
  lead_type: CrmLeadType;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  service_interest: string | null;
  description: string | null;
  estimated_value: number;
  temperature: CrmTemperature;
  source: CrmSource | null;
  customer_type: CrmCustomerType | null;
  assigned_to: string | null;
  next_action: string | null;
  next_follow_up_at: string | null;
  tags: string[];
  notes: string | null;
  lost_reason: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};


async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa associada ao usuário.");
  return data.company_id as string;
}

async function ensureDefaultPipeline(supabase: any, companyId: string): Promise<CrmPipeline> {
  const { data } = await supabase
    .from("crm_pipelines")
    .select("id, company_id, name, is_default")
    .eq("company_id", companyId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) return data as CrmPipeline;
  // Fallback: create if trigger didn't fire (shouldn't happen)
  const { data: created, error } = await supabase
    .from("crm_pipelines")
    .insert({ company_id: companyId, name: "Comercial", is_default: true })
    .select("id, company_id, name, is_default")
    .single();
  if (error) throw new Error(error.message);
  return created as CrmPipeline;
}

export const getCrmBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        pipeline_id: z.string().uuid().optional(),
        search: z.string().optional(),
        assigned_to: z.string().uuid().optional(),
        temperature: z.enum(["cold", "warm", "hot"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { data: pipelines } = await sb
      .from("crm_pipelines")
      .select("id, company_id, name, is_default")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    let allPipelines = (pipelines ?? []) as CrmPipeline[];
    if (allPipelines.length === 0) {
      allPipelines = [await ensureDefaultPipeline(sb, companyId)];
    }
    const pipeline =
      allPipelines.find((p) => p.id === data.pipeline_id) ??
      allPipelines.find((p) => p.is_default) ??
      allPipelines[0];

    const { data: stages, error: sErr } = await sb
      .from("crm_stages")
      .select("id, pipeline_id, name, position, color, stage_type, is_won, is_lost")
      .eq("pipeline_id", pipeline.id)
      .order("position", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    let q = sb
      .from("crm_opportunities")
      .select(
        "id, company_id, pipeline_id, stage_id, customer_id, lead_name, lead_type, company_name, phone, email, service_interest, description, estimated_value, temperature, source, customer_type, assigned_to, next_action, next_follow_up_at, tags, notes, lost_reason, sort_order, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .eq("pipeline_id", pipeline.id)
      .is("deleted_at", null);

    if (data.assigned_to) q = q.eq("assigned_to", data.assigned_to);
    if (data.temperature) q = q.eq("temperature", data.temperature);
    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      q = q.or(
        `lead_name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,service_interest.ilike.%${s}%`,
      );
    }

    const { data: opps, error: oErr } = await q
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    if (oErr) throw new Error(oErr.message);


    return {
      pipeline,
      pipelines: allPipelines,
      stages: (stages ?? []) as CrmStage[],
      opportunities: ((opps ?? []) as any[]).map((o) => ({
        ...o,
        estimated_value: Number(o.estimated_value ?? 0),
      })) as CrmOpportunity[],
    };
  });

export const getOpportunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: opp, error } = await sb
      .from("crm_opportunities")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!opp) return null;
    const { data: timeline } = await sb
      .from("crm_timeline")
      .select("id, event_type, title, description, metadata, created_at")
      .eq("opportunity_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      opportunity: { ...opp, estimated_value: Number(opp.estimated_value ?? 0) } as CrmOpportunity,
      timeline: timeline ?? [],
    };
  });

const opportunityInputSchema = z.object({
  pipeline_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  lead_name: z.string().trim().min(2, "Informe o nome do lead."),
  lead_type: z.enum(["pf", "pj"]).default("pf"),
  company_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  service_interest: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  estimated_value: z.coerce.number().min(0).default(0),
  temperature: z.enum(["cold", "warm", "hot"]).default("warm"),
  source: z
    .enum(["site", "indicacao", "whatsapp", "instagram", "facebook", "google", "ligacao", "visita", "evento", "outro"])
    .optional()
    .nullable(),
  customer_type: z
    .enum(["residencial", "comercial", "industrial", "condominio", "outro"])
    .optional()
    .nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  next_action: z.string().trim().optional().nullable(),
  next_follow_up_at: z.string().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
});

function normalizeInput<T extends Record<string, any>>(input: T): T {
  const out: any = { ...input };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "string" && out[k].trim() === "") out[k] = null;
  }
  return out;
}

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => opportunityInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    let pipelineId = data.pipeline_id ?? null;
    let stageId = data.stage_id ?? null;

    if (!pipelineId) {
      const pipe = await ensureDefaultPipeline(sb, companyId);
      pipelineId = pipe.id;
    }
    if (!stageId) {
      const { data: firstStage } = await sb
        .from("crm_stages")
        .select("id")
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!firstStage?.id) throw new Error("Pipeline sem estágios configurados.");
      stageId = firstStage.id;
    }

    const payload = normalizeInput({
      ...data,
      company_id: companyId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      created_by: context.userId,
    });

    const { data: created, error } = await sb
      .from("crm_opportunities")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    opportunityInputSchema.partial().extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { id, ...rest } = data;
    const patch = normalizeInput(rest);
    const { error } = await sb
      .from("crm_opportunities")
      .update(patch)
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveOpportunityStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        stage_id: z.string().uuid(),
        sort_order: z.number().int().optional(),
        lost_reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { data: stage, error: sErr } = await sb
      .from("crm_stages")
      .select("id, name, is_won, is_lost, stage_type")
      .eq("id", data.stage_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!stage) throw new Error("Estágio inválido.");

    const patch: Record<string, any> = { stage_id: data.stage_id };
    const now = new Date().toISOString();
    if (stage.is_won) {
      patch.won_at = now;
      patch.lost_at = null;
      patch.lost_reason = null;
    } else if (stage.is_lost) {
      patch.lost_at = now;
      patch.won_at = null;
      if (data.lost_reason !== undefined) patch.lost_reason = data.lost_reason;
    } else {
      patch.won_at = null;
      patch.lost_at = null;
    }
    if (typeof data.sort_order === "number") patch.sort_order = data.sort_order;

    const { error } = await sb
      .from("crm_opportunities")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    await sb.from("crm_timeline").insert({
      company_id: companyId,
      opportunity_id: data.id,
      event_type: "stage_changed",
      title: `Movido para "${stage.name}"`,
      metadata: { stage_id: data.stage_id, lost_reason: patch.lost_reason ?? null },
      created_by: context.userId,
    });

    return { ok: true };
  });

export const reorderOpportunitiesInStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        stage_id: z.string().uuid(),
        ordered_ids: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    // Assign sort_order = index * 100
    const updates = data.ordered_ids.map((id, i) =>
      sb
        .from("crm_opportunities")
        .update({ sort_order: (i + 1) * 100, stage_id: data.stage_id })
        .eq("id", id)
        .eq("company_id", companyId),
    );
    const results = await Promise.all(updates);
    const err = results.find((r: any) => r.error);
    if (err?.error) throw new Error(err.error.message);
    return { ok: true };
  });


export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("crm_opportunities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCrmTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data } = await sb
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", companyId)
      .order("full_name", { ascending: true });
    return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
  });

export const getCrmOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: opps } = await sb
      .from("crm_opportunities")
      .select("id, estimated_value, won_at, lost_at, temperature, created_at, next_follow_up_at, stage_id")
      .eq("company_id", companyId)
      .is("deleted_at", null);
    const list = (opps ?? []) as any[];
    const now = Date.now();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const openList = list.filter((o) => !o.won_at && !o.lost_at);
    const wonList = list.filter((o) => o.won_at);
    const wonRecent = wonList.filter((o) => new Date(o.won_at).getTime() >= start.getTime());
    const lostRecent = list.filter((o) => o.lost_at && new Date(o.lost_at).getTime() >= start.getTime());
    const openValue = openList.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
    const wonValue = wonRecent.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
    const overdue = openList.filter(
      (o) => o.next_follow_up_at && new Date(o.next_follow_up_at).getTime() < now,
    ).length;
    const totalClosed = wonRecent.length + lostRecent.length;
    const conversion = totalClosed > 0 ? (wonRecent.length / totalClosed) * 100 : 0;
    return {
      total: list.length,
      open: openList.length,
      openValue,
      won30d: wonRecent.length,
      wonValue30d: wonValue,
      lost30d: lostRecent.length,
      conversion30d: conversion,
      overdueFollowUps: overdue,
    };
  });

// ============================================================
// Etapa 3 — Notes, Activities, Customer link, Convert to Quote
// ============================================================

export type CrmNote = {
  id: string;
  opportunity_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type CrmActivity = {
  id: string;
  opportunity_id: string | null;
  activity_type: "call" | "whatsapp" | "email" | "meeting" | "visit" | "follow_up" | "note" | "task";
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  status: "pending" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  assigned_to: string | null;
  created_at: string;
};

export const listOpportunityNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ opportunity_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: rows, error } = await sb
      .from("crm_notes")
      .select("id, opportunity_id, note, created_by, created_at")
      .eq("company_id", companyId)
      .eq("opportunity_id", data.opportunity_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmNote[];
  });

export const addOpportunityNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ opportunity_id: z.string().uuid(), note: z.string().trim().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb.from("crm_notes").insert({
      company_id: companyId,
      opportunity_id: data.opportunity_id,
      note: data.note,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await sb.from("crm_timeline").insert({
      company_id: companyId,
      opportunity_id: data.opportunity_id,
      event_type: "note_added",
      title: "Nota adicionada",
      description: data.note.slice(0, 240),
      created_by: context.userId,
    });
    return { ok: true };
  });

export const deleteOpportunityNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("crm_notes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOpportunityActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ opportunity_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { data: rows, error } = await sb
      .from("crm_activities")
      .select(
        "id, opportunity_id, activity_type, title, description, due_at, completed_at, status, priority, assigned_to, created_at",
      )
      .eq("company_id", companyId)
      .eq("opportunity_id", data.opportunity_id)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmActivity[];
  });

export const addOpportunityActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        activity_type: z.enum(["call", "whatsapp", "email", "meeting", "visit", "follow_up", "note", "task"]),
        title: z.string().trim().min(1),
        description: z.string().trim().optional().nullable(),
        due_at: z.string().optional().nullable(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        assigned_to: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb.from("crm_activities").insert({
      company_id: companyId,
      opportunity_id: data.opportunity_id,
      activity_type: data.activity_type,
      title: data.title,
      description: data.description || null,
      due_at: data.due_at || null,
      priority: data.priority,
      assigned_to: data.assigned_to || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await sb.from("crm_timeline").insert({
      company_id: companyId,
      opportunity_id: data.opportunity_id,
      event_type: "activity_created",
      title: `Atividade: ${data.title}`,
      created_by: context.userId,
    });
    return { ok: true };
  });

export const completeActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), done: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const patch = data.done
      ? { status: "done", completed_at: new Date().toISOString() }
      : { status: "pending", completed_at: null };
    const { error } = await sb
      .from("crm_activities")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("crm_activities")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchCustomersLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    let q = sb
      .from("customers")
      .select("id, name, trade_name, corporate_name, cpf_cnpj, email, phone")
      .eq("company_id", companyId)
      .eq("active", true)
      .is("deleted_at", null)
      .limit(20)
      .order("name", { ascending: true });
    if (data.search?.trim()) {
      const s = data.search.trim();
      q = q.or(
        `name.ilike.%${s}%,trade_name.ilike.%${s}%,corporate_name.ilike.%${s}%,cpf_cnpj.ilike.%${s}%,email.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((c: any) => ({
      id: c.id,
      label: c.trade_name || c.name || c.corporate_name || "—",
      cpf_cnpj: c.cpf_cnpj,
      email: c.email,
      phone: c.phone,
    }));
  });

export const linkOpportunityCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), customer_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);
    const { error } = await sb
      .from("crm_opportunities")
      .update({ customer_id: data.customer_id })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await sb.from("crm_timeline").insert({
      company_id: companyId,
      opportunity_id: data.id,
      event_type: "customer_linked",
      title: data.customer_id ? "Cliente vinculado" : "Vínculo de cliente removido",
      created_by: context.userId,
    });
    return { ok: true };
  });

export const convertOpportunityToQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const companyId = await getCompanyId(sb, context.userId);

    const { data: opp, error: oErr } = await sb
      .from("crm_opportunities")
      .select("id, customer_id, lead_name, service_interest, description, estimated_value, quote_id")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!opp) throw new Error("Oportunidade não encontrada.");
    if (opp.quote_id) return { quote_id: opp.quote_id as string, already: true };
    if (!opp.customer_id) {
      throw new Error("Vincule um cliente à oportunidade antes de gerar o orçamento.");
    }

    const { data: qNum, error: nErr } = await sb.rpc("next_quote_number", {
      _company_id: companyId,
    });
    if (nErr) throw new Error(nErr.message);

    const today = new Date().toISOString().slice(0, 10);
    const validUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: quote, error: qErr } = await sb
      .from("quotes")
      .insert({
        company_id: companyId,
        customer_id: opp.customer_id,
        quote_number: qNum as string,
        status: "DRAFT",
        title: opp.service_interest || opp.lead_name,
        issue_date: today,
        valid_until: validUntil,
        customer_notes: opp.description || null,
        labor_cost: Number(opp.estimated_value || 0),
        discount: 0,
      })
      .select("id")
      .single();
    if (qErr) throw new Error(qErr.message);

    await sb
      .from("crm_opportunities")
      .update({ quote_id: quote.id })
      .eq("id", data.id)
      .eq("company_id", companyId);

    await sb.from("crm_timeline").insert({
      company_id: companyId,
      opportunity_id: data.id,
      event_type: "quote_created",
      title: "Orçamento gerado a partir do lead",
      metadata: { quote_id: quote.id },
      created_by: context.userId,
    });

    return { quote_id: quote.id as string, already: false };
  });
