import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============= Header aliases → target fields =============
const HEADER_ALIASES: Record<string, string> = {
  // names
  "razao social": "corporate_name",
  "razão social": "corporate_name",
  "nome fantasia": "trade_name",
  fornecedor: "trade_name",
  nome: "trade_name",
  // doc
  cpf: "cpf_cnpj",
  cnpj: "cpf_cnpj",
  "cpf/cnpj": "cpf_cnpj",
  "cpf cnpj": "cpf_cnpj",
  documento: "cpf_cnpj",
  // contact
  email: "email",
  "e-mail": "email",
  telefone: "phone",
  fone: "phone",
  whatsapp: "whatsapp",
  celular: "whatsapp",
  site: "website",
  website: "website",
  observacoes: "notes",
  observações: "notes",
  // address
  cep: "zipcode",
  rua: "address",
  logradouro: "address",
  endereco: "address",
  endereço: "address",
  numero: "number",
  número: "number",
  complemento: "complement",
  bairro: "district",
  cidade: "city",
  municipio: "city",
  uf: "state",
  estado: "state",
  pais: "country",
  país: "country",
};

export const SUP_TARGET_FIELDS = [
  "corporate_name",
  "trade_name",
  "cpf_cnpj",
  "email",
  "phone",
  "whatsapp",
  "website",
  "notes",
  "zipcode",
  "address",
  "number",
  "complement",
  "district",
  "city",
  "state",
  "country",
  "__ignore__",
] as const;

export type SupTargetField = (typeof SUP_TARGET_FIELDS)[number];

const UFS_BR = new Set([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
]);

function normalizeHeader(h: string): string {
  return h
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, " ")
    .trim()
    .toLowerCase();
}

export function suggestSupplierMapping(headers: string[]): Record<string, SupTargetField> {
  const mapping: Record<string, SupTargetField> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    mapping[h] = (HEADER_ALIASES[norm] ?? "__ignore__") as SupTargetField;
  }
  return mapping;
}

function onlyDigits(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function buildMappedRow(raw: Record<string, any>, mapping: Record<string, SupTargetField>) {
  const out: Record<string, any> = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target === "__ignore__") continue;
    const v = raw[header];
    if (v === undefined || v === null || v === "") continue;
    if (target === "cpf_cnpj") out[target] = onlyDigits(v);
    else if (target === "state") out[target] = String(v).toUpperCase().trim();
    else if (target === "whatsapp" || target === "phone") out[target] = String(v).trim();
    else out[target] = String(v).trim();
  }
  return out;
}

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa vinculada.");
  return data.company_id as string;
}

async function logAudit(
  sb: any,
  module: string,
  action: string,
  recordId?: string | null,
  newData?: any,
) {
  try {
    await sb.rpc("log_audit", {
      _module: module,
      _action: action,
      _record_id: recordId ?? null,
      _new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
      _old_data: null,
    });
  } catch {}
}
async function logActivity(sb: any, description: string) {
  try {
    await sb.rpc("log_activity", { _description: description });
  } catch {}
}

// ===================== createSupplierImportJob =====================
const createJobSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_url: z.string().optional().nullable(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.record(z.string(), z.any())).max(5000),
});

export const createSupplierImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createJobSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const mapping = suggestSupplierMapping(data.headers);

    const { data: job, error } = await sb
      .from("supplier_import_jobs")
      .insert({
        company_id,
        file_name: data.file_name,
        file_url: data.file_url ?? null,
        status: "UPLOADED",
        total_rows: data.rows.length,
        column_mapping: mapping,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.rows.length) {
      const rows = data.rows.map((r, i) => ({
        company_id,
        import_job_id: job.id,
        row_number: i + 1,
        raw_data: r,
        mapped_data: buildMappedRow(r, mapping),
        action: "CREATE",
        status: "PENDING",
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: errIns } = await sb.from("supplier_import_rows").insert(chunk);
        if (errIns) throw new Error(errIns.message);
      }
    }

    await logAudit(sb, "supplier_imports", "upload", job.id, {
      file_name: data.file_name,
      total: data.rows.length,
    });
    await logActivity(
      sb,
      `Importação de fornecedores iniciada: ${data.file_name} (${data.rows.length} linhas)`,
    );
    return { job_id: job.id, headers: data.headers, mapping };
  });

// ===================== validateSupplierImport =====================
const validateSchema = z.object({
  job_id: z.string().uuid(),
  mapping: z.record(z.string(), z.string()),
});

export const validateSupplierImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => validateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const { data: job, error: jobErr } = await sb
      .from("supplier_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");

    await sb
      .from("supplier_import_jobs")
      .update({ column_mapping: data.mapping, status: "MAPPED" })
      .eq("id", job.id);

    const { data: rows, error } = await sb
      .from("supplier_import_rows")
      .select("id, raw_data, row_number")
      .eq("import_job_id", job.id)
      .order("row_number");
    if (error) throw new Error(error.message);

    const mapping = data.mapping as Record<string, SupTargetField>;
    const mappedRows = (rows ?? []).map((r: any) => ({
      id: r.id,
      row_number: r.row_number,
      raw: r.raw_data,
      mapped: buildMappedRow(r.raw_data, mapping),
    }));

    const docs = new Set<string>();
    const emails = new Set<string>();
    const whats = new Set<string>();
    for (const r of mappedRows) {
      if (r.mapped.cpf_cnpj) docs.add(String(r.mapped.cpf_cnpj));
      if (r.mapped.email) emails.add(String(r.mapped.email).toLowerCase());
      if (r.mapped.whatsapp) whats.add(onlyDigits(r.mapped.whatsapp));
    }

    const existingByDoc = new Map<string, string>();
    const existingByEmail = new Map<string, string>();
    const existingByWhats = new Map<string, string>();

    if (docs.size || emails.size || whats.size) {
      const orParts: string[] = [];
      if (docs.size) orParts.push(`cpf_cnpj.in.(${[...docs].map((s) => `"${s}"`).join(",")})`);
      if (emails.size) orParts.push(`email.in.(${[...emails].map((s) => `"${s}"`).join(",")})`);
      if (whats.size) orParts.push(`whatsapp.in.(${[...whats].map((s) => `"${s}"`).join(",")})`);
      const { data: existing } = await sb
        .from("suppliers")
        .select("id, cpf_cnpj, email, whatsapp")
        .eq("company_id", company_id)
        .is("deleted_at", null)
        .or(orParts.join(","));
      (existing ?? []).forEach((c: any) => {
        if (c.cpf_cnpj) existingByDoc.set(c.cpf_cnpj, c.id);
        if (c.email) existingByEmail.set(String(c.email).toLowerCase(), c.id);
        if (c.whatsapp) existingByWhats.set(onlyDigits(c.whatsapp), c.id);
      });
    }

    const docCount = new Map<string, number>();
    for (const r of mappedRows) {
      if (r.mapped.cpf_cnpj)
        docCount.set(r.mapped.cpf_cnpj, (docCount.get(r.mapped.cpf_cnpj) ?? 0) + 1);
    }

    let valid = 0,
      invalid = 0;
    const updates: any[] = [];
    for (const r of mappedRows) {
      const m = r.mapped;
      const errors: string[] = [];

      const displayName = m.corporate_name || m.trade_name;
      if (!displayName) errors.push("Razão social ou Nome fantasia obrigatório.");
      else {
        if (!m.corporate_name) m.corporate_name = m.trade_name;
      }

      const doc = String(m.cpf_cnpj ?? "");
      if (!doc) errors.push("CPF/CNPJ obrigatório.");
      else if (doc.length !== 11 && doc.length !== 14)
        errors.push("CPF/CNPJ deve ter 11 ou 14 dígitos.");

      if (m.email && !isValidEmail(String(m.email))) errors.push("E-mail inválido.");

      if (m.state) {
        const country = (m.country ?? "Brasil").toString().toLowerCase();
        if (
          (country.startsWith("bra") || country === "br") &&
          !UFS_BR.has(String(m.state).toUpperCase())
        ) {
          errors.push(`UF inválida: ${m.state}.`);
        }
      }

      if (doc && (docCount.get(doc) ?? 0) > 1) errors.push("CPF/CNPJ duplicado no arquivo.");

      let matched: string | null = null;
      if (doc && existingByDoc.has(doc)) matched = existingByDoc.get(doc)!;
      else if (m.email && existingByEmail.has(String(m.email).toLowerCase()))
        matched = existingByEmail.get(String(m.email).toLowerCase())!;
      else if (m.whatsapp && existingByWhats.has(onlyDigits(m.whatsapp)))
        matched = existingByWhats.get(onlyDigits(m.whatsapp))!;

      const status = errors.length ? "INVALID" : "VALID";
      const action = errors.length ? "ERROR" : matched ? "UPDATE" : "CREATE";
      if (errors.length) invalid++;
      else valid++;

      updates.push({
        id: r.id,
        mapped_data: m,
        validation_errors: errors.length ? errors : null,
        action,
        matched_supplier_id: matched,
        status,
      });
    }

    for (const u of updates) {
      await sb
        .from("supplier_import_rows")
        .update({
          mapped_data: u.mapped_data,
          validation_errors: u.validation_errors,
          action: u.action,
          matched_supplier_id: u.matched_supplier_id,
          status: u.status,
        })
        .eq("id", u.id);
    }

    await sb
      .from("supplier_import_jobs")
      .update({ status: "VALIDATED", valid_rows: valid, invalid_rows: invalid })
      .eq("id", job.id);

    await logAudit(sb, "supplier_imports", "validate", job.id, { valid, invalid });
    return { job_id: job.id, valid, invalid, total: mappedRows.length };
  });

// ===================== listSupplierImportRows =====================
export const listSupplierImportRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        job_id: z.string().uuid(),
        filter: z.enum(["all", "CREATE", "UPDATE", "ERROR", "SKIP"]).default("all"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("supplier_import_rows")
      .select(
        "id, row_number, raw_data, mapped_data, validation_errors, action, matched_supplier_id, status",
      )
      .eq("import_job_id", data.job_id)
      .order("row_number");
    if (data.filter !== "all") q = q.eq("action", data.filter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ===================== updateSupplierImportRow =====================
export const updateSupplierImportRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        row_id: z.string().uuid(),
        mapped_data: z.record(z.string(), z.any()).optional(),
        action: z.enum(["CREATE", "UPDATE", "SKIP", "ERROR"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const patch: any = {};
    if (data.mapped_data) patch.mapped_data = data.mapped_data;
    if (data.action) patch.action = data.action;
    if (data.action === "SKIP") patch.status = "SKIPPED";
    const { error } = await sb.from("supplier_import_rows").update(patch).eq("id", data.row_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===================== confirmSupplierImport =====================
export const confirmSupplierImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const { data: canConfirm } = await sb.rpc("has_permission", {
      _slug: "suppliers.import.confirm",
    });
    if (canConfirm === false) throw new Error("Sem permissão para confirmar importação.");

    const { data: job, error: jobErr } = await sb
      .from("supplier_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");
    if (!["VALIDATED", "MAPPED", "UPLOADED", "FAILED"].includes(job.status))
      throw new Error("Importação já finalizada.");

    await sb.from("supplier_import_jobs").update({ status: "PROCESSING" }).eq("id", job.id);

    try {
      const { data: rows, error } = await sb
        .from("supplier_import_rows")
        .select("*")
        .eq("import_job_id", job.id)
        .order("row_number");
      if (error) throw new Error(error.message);

      let created = 0,
        updated = 0,
        skipped = 0;

      for (const r of rows ?? []) {
        if (r.action === "SKIP" || r.action === "ERROR" || r.status === "INVALID") {
          skipped++;
          await sb.from("supplier_import_rows").update({ status: "SKIPPED" }).eq("id", r.id);
          continue;
        }
        const m = r.mapped_data ?? {};
        const payload: any = {
          company_id,
          corporate_name: m.corporate_name,
          trade_name: m.trade_name ?? null,
          cpf_cnpj: m.cpf_cnpj,
          email: m.email ?? null,
          phone: m.phone ?? null,
          whatsapp: m.whatsapp ? onlyDigits(m.whatsapp) : null,
          website: m.website ?? null,
          zipcode: m.zipcode ?? null,
          address: m.address ?? null,
          number: m.number ?? null,
          complement: m.complement ?? null,
          district: m.district ?? null,
          city: m.city ?? null,
          state: m.state ?? null,
          notes: m.notes ?? null,
          active: true,
        };

        let supplierId: string | null = r.matched_supplier_id ?? null;
        if (r.action === "UPDATE" && supplierId) {
          const { error: upErr } = await sb
            .from("suppliers")
            .update(payload)
            .eq("id", supplierId)
            .eq("company_id", company_id);
          if (upErr) {
            await sb
              .from("supplier_import_rows")
              .update({ status: "INVALID", validation_errors: [upErr.message] })
              .eq("id", r.id);
            continue;
          }
          updated++;
          await logAudit(sb, "suppliers", "update_by_import", supplierId, payload);
        } else {
          const { data: ins, error: insErr } = await sb
            .from("suppliers")
            .insert(payload)
            .select("id")
            .single();
          if (insErr || !ins) {
            await sb
              .from("supplier_import_rows")
              .update({
                status: "INVALID",
                validation_errors: [insErr?.message ?? "Falha ao criar fornecedor."],
                action: "ERROR",
              })
              .eq("id", r.id);
            continue;
          }
          supplierId = ins.id;
          created++;
          await logAudit(sb, "suppliers", "create_by_import", supplierId, payload);
        }

        await sb
          .from("supplier_import_rows")
          .update({ status: "IMPORTED", matched_supplier_id: supplierId })
          .eq("id", r.id);
      }

      await sb
        .from("supplier_import_jobs")
        .update({
          status: "COMPLETED",
          created_rows: created,
          updated_rows: updated,
          skipped_rows: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await logAudit(sb, "supplier_imports", "completed", job.id, { created, updated, skipped });
      await logActivity(
        sb,
        `Importação de fornecedores concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados.`,
      );

      try {
        await sb.from("notifications").insert({
          company_id,
          user_id: context.userId,
          type: skipped > 0 ? "warning" : "success",
          title:
            skipped > 0
              ? "Importação concluída com pendências"
              : "Importação de fornecedores concluída",
          message: `${created} criados · ${updated} atualizados · ${skipped} ignorados`,
        });
      } catch {}

      return { created, updated, skipped };
    } catch (e: any) {
      await sb
        .from("supplier_import_jobs")
        .update({ status: "FAILED", error_message: String(e?.message ?? e) })
        .eq("id", job.id);
      throw e;
    }
  });

// ===================== listSupplierImportJobs =====================
export const listSupplierImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("supplier_import_jobs")
      .select(
        "id, file_name, status, total_rows, valid_rows, invalid_rows, created_rows, updated_rows, skipped_rows, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
