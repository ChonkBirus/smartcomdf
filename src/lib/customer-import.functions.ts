import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============= Header aliases → target fields =============
const HEADER_ALIASES: Record<string, string> = {
  // type
  tipo: "customer_type",
  "tipo cliente": "customer_type",
  tipo_cliente: "customer_type",
  "tipo de cliente": "customer_type",
  pessoa: "customer_type",
  "pessoa fisica": "customer_type",
  "pessoa juridica": "customer_type",
  // names
  nome: "name",
  "nome do cliente": "name",
  cliente: "name",
  "nome razao social": "name",
  nome_razao_social: "name",
  "razao social": "corporate_name",
  "razão social": "corporate_name",
  "nome fantasia": "trade_name",
  // doc
  cpf: "cpf_cnpj",
  cnpj: "cpf_cnpj",
  "cpf/cnpj": "cpf_cnpj",
  "cpf cnpj": "cpf_cnpj",
  documento: "cpf_cnpj",
  "inscricao estadual": "state_registration",
  "inscrição estadual": "state_registration",
  ie: "state_registration",
  "inscricao municipal": "municipal_registration",
  "inscrição municipal": "municipal_registration",
  im: "municipal_registration",
  // contact
  email: "email",
  "e-mail": "email",
  telefone: "phone",
  fone: "phone",
  whatsapp: "whatsapp",
  celular: "whatsapp",
  // misc
  origem: "customer_origin",
  status: "customer_status",
  observacoes: "notes",
  observações: "notes",
  // address
  cep: "addr_zipcode",
  rua: "addr_street",
  logradouro: "addr_street",
  endereco: "addr_street",
  endereço: "addr_street",
  numero: "addr_number",
  número: "addr_number",
  complemento: "addr_complement",
  bairro: "addr_district",
  cidade: "addr_city",
  municipio: "addr_city",
  uf: "addr_state",
  estado: "addr_state",
  pais: "addr_country",
  país: "addr_country",
  referencia: "addr_reference",
  referência: "addr_reference",
  // contact extra
  contato: "contact_name",
  "contato nome": "contact_name",
  contato_nome: "contact_name",
  "nome do contato": "contact_name",
  responsavel: "contact_name",
  responsável: "contact_name",
  cargo: "contact_role",
  "contato telefone": "contact_phone",
  contato_telefone: "contact_phone",
  "telefone do contato": "contact_phone",
  "whatsapp do contato": "contact_whatsapp",
  "contato email": "contact_email",
  contato_email: "contact_email",
  "email do contato": "contact_email",
  "e-mail do contato": "contact_email",
  // tags
  tags: "tags",
  segmento: "tags",
  "categoria do cliente": "tags",
};

export const TARGET_FIELDS = [
  "customer_type",
  "name",
  "corporate_name",
  "trade_name",
  "cpf_cnpj",
  "state_registration",
  "municipal_registration",
  "email",
  "phone",
  "whatsapp",
  "customer_origin",
  "customer_status",
  "notes",
  "addr_zipcode",
  "addr_street",
  "addr_number",
  "addr_complement",
  "addr_district",
  "addr_city",
  "addr_state",
  "addr_country",
  "addr_reference",
  "contact_name",
  "contact_role",
  "contact_phone",
  "contact_whatsapp",
  "contact_email",
  "tags",
  "__ignore__",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

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

export function suggestMapping(headers: string[]): Record<string, TargetField> {
  const mapping: Record<string, TargetField> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    const target = (HEADER_ALIASES[norm] ?? "__ignore__") as TargetField;
    mapping[h] = target;
  }
  return mapping;
}

function onlyDigits(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function normText(v: any): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const CUSTOMER_STATUS_VALUES = new Set(["ACTIVE", "INACTIVE", "LEAD", "BLOCKED"]);
function normalizeCustomerStatus(v: any): "ACTIVE" | "INACTIVE" | "LEAD" | "BLOCKED" | null {
  if (v == null || v === "") return null;
  const t = String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (CUSTOMER_STATUS_VALUES.has(t.toUpperCase())) return t.toUpperCase() as any;
  if (t.startsWith("ativ")) return "ACTIVE";
  if (t.startsWith("inativ") || t === "desativado" || t === "desativada") return "INACTIVE";
  if (t.startsWith("lead") || t === "prospect" || t === "prospecto") return "LEAD";
  if (t.startsWith("bloq") || t === "blocked") return "BLOCKED";
  return null;
}

function detectType(rawTipo: any, doc: string): "INDIVIDUAL" | "COMPANY" | null {
  if (rawTipo) {
    const t = String(rawTipo)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (t.includes("jurid") || t === "pj" || t === "j" || t === "company" || t === "empresa")
      return "COMPANY";
    if (
      t.includes("fisic") ||
      t === "pf" ||
      t === "f" ||
      t === "individual" ||
      t === "pessoa fisica"
    )
      return "INDIVIDUAL";
  }
  if (doc.length === 14) return "COMPANY";
  if (doc.length === 11) return "INDIVIDUAL";
  return null;
}

function parseTags(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildMappedRow(raw: Record<string, any>, mapping: Record<string, TargetField>) {
  const out: Record<string, any> = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target === "__ignore__") continue;
    const v = raw[header];
    if (v === undefined || v === null || v === "") continue;
    if (target === "cpf_cnpj") out[target] = onlyDigits(v);
    else if (target === "addr_state") out[target] = String(v).toUpperCase().trim();
    else if (target === "tags") out[target] = parseTags(v);
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

// =============================================================
// createImportJob
// =============================================================
const createJobSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_url: z.string().optional().nullable(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.record(z.string(), z.any())).max(5000),
});

export const createCustomerImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createJobSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const [{ data: canClientsImport }, { data: canCustomersImport }] = await Promise.all([
      sb.rpc("has_permission", { _slug: "clients.import" }),
      sb.rpc("has_permission", { _slug: "customers.import" }),
    ]);
    if (canClientsImport === false && canCustomersImport === false) {
      throw new Error("Você não tem permissão para importar clientes.");
    }

    const mapping = suggestMapping(data.headers);

    const { data: job, error } = await sb
      .from("customer_import_jobs")
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
        const { error: errIns } = await sb.from("customer_import_rows").insert(chunk);
        if (errIns) throw new Error(errIns.message);
      }
    }

    await logAudit(sb, "customer_imports", "upload", job.id, {
      file_name: data.file_name,
      total: data.rows.length,
    });
    await logActivity(
      sb,
      `Importação de clientes iniciada: ${data.file_name} (${data.rows.length} linhas)`,
    );

    return { job_id: job.id, headers: data.headers, mapping };
  });

// =============================================================
// validateCustomerImport
// =============================================================
const validateSchema = z.object({
  job_id: z.string().uuid(),
  mapping: z.record(z.string(), z.string()),
});

export const validateCustomerImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => validateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const { data: job, error: jobErr } = await sb
      .from("customer_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");

    await sb
      .from("customer_import_jobs")
      .update({ column_mapping: data.mapping, status: "MAPPED" })
      .eq("id", job.id);

    const { data: rows, error } = await sb
      .from("customer_import_rows")
      .select("id, raw_data, row_number")
      .eq("import_job_id", job.id)
      .order("row_number");
    if (error) throw new Error(error.message);

    const mapping = data.mapping as Record<string, TargetField>;
    const mappedRows = (rows ?? []).map((r: any) => ({
      id: r.id,
      row_number: r.row_number,
      raw: r.raw_data,
      mapped: buildMappedRow(r.raw_data, mapping),
    }));

    console.log("[CUSTOMER IMPORT] validating job", data.job_id, "companyId", company_id);

    // Lookup existing customers by document, email, phone/whatsapp and name.
    const docs = new Set<string>();
    const emails = new Set<string>();
    const phones = new Set<string>();
    const names = new Set<string>();
    for (const r of mappedRows) {
      if (r.mapped.cpf_cnpj) docs.add(String(r.mapped.cpf_cnpj));
      if (r.mapped.email) emails.add(String(r.mapped.email).toLowerCase());
      const phone = onlyDigits(r.mapped.phone || r.mapped.whatsapp);
      if (phone) phones.add(phone);
      const name = normText(r.mapped.name || r.mapped.corporate_name);
      if (name) names.add(name);
    }

    const existingByDoc = new Map<string, string>();
    const existingByEmail = new Map<string, string>();
    const existingByPhone = new Map<string, string>();
    const existingByName = new Map<string, string>();
    const rememberExisting = (existing: any[] | null | undefined) => {
      (existing ?? []).forEach((c: any) => {
        if (c.cpf_cnpj) existingByDoc.set(c.cpf_cnpj, c.id);
        if (c.email) existingByEmail.set(String(c.email).toLowerCase(), c.id);
        if (c.phone) existingByPhone.set(onlyDigits(c.phone), c.id);
        if (c.whatsapp) existingByPhone.set(onlyDigits(c.whatsapp), c.id);
        if (c.name) existingByName.set(normText(c.name), c.id);
        if (c.corporate_name) existingByName.set(normText(c.corporate_name), c.id);
      });
    };

    const customerSelect = "id, cpf_cnpj, email, phone, whatsapp, name, corporate_name";
    if (docs.size) {
      const { data: existing } = await sb
        .from("customers")
        .select(customerSelect)
        .eq("company_id", company_id)
        .is("deleted_at", null)
        .in("cpf_cnpj", [...docs]);
      rememberExisting(existing);
    }
    if (emails.size) {
      const { data: existing } = await sb
        .from("customers")
        .select(customerSelect)
        .eq("company_id", company_id)
        .is("deleted_at", null)
        .in("email", [...emails]);
      rememberExisting(existing);
    }
    if (phones.size || names.size) {
      const { data: possibleByPhoneOrName } = await sb
        .from("customers")
        .select(customerSelect)
        .eq("company_id", company_id)
        .is("deleted_at", null);
      rememberExisting(
        (possibleByPhoneOrName ?? []).filter(
          (c: any) =>
            phones.has(onlyDigits(c.phone)) ||
            phones.has(onlyDigits(c.whatsapp)) ||
            names.has(normText(c.name)) ||
            names.has(normText(c.corporate_name)),
        ),
      );
    }

    // Duplicates within file.
    const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
    const docCount = new Map<string, number>();
    const emailCount = new Map<string, number>();
    const phoneCount = new Map<string, number>();
    const nameCount = new Map<string, number>();
    for (const r of mappedRows) {
      if (r.mapped.cpf_cnpj) count(docCount, r.mapped.cpf_cnpj);
      if (r.mapped.email) count(emailCount, String(r.mapped.email).toLowerCase());
      const phone = onlyDigits(r.mapped.phone || r.mapped.whatsapp);
      if (phone) count(phoneCount, phone);
      const name = normText(r.mapped.name || r.mapped.corporate_name);
      if (name) count(nameCount, name);
    }

    const newTags = new Set<string>();
    const { data: existingTags } = await sb
      .from("customer_tags")
      .select("id, name")
      .eq("company_id", company_id);
    const tagMap = new Map<string, string>(
      (existingTags ?? []).map((t: any) => [String(t.name).toLowerCase(), t.id]),
    );

    let valid = 0;
    let invalid = 0;
    let duplicates = 0;
    let addresses = 0;
    let contacts = 0;

    const updates: any[] = [];
    for (const r of mappedRows) {
      const m = r.mapped;
      const errors: string[] = [];
      const duplicateReasons: string[] = [];

      const doc = String(m.cpf_cnpj ?? "");
      const rawTypeProvided = m.customer_type != null && String(m.customer_type).trim() !== "";
      const detectedType = detectType(m.customer_type, doc);
      if (rawTypeProvided && !detectedType) errors.push("tipo_cliente deve ser PF ou PJ.");
      const type = detectedType ?? "INDIVIDUAL";
      m.customer_type = type;

      const displayName =
        type === "COMPANY" ? (m.corporate_name ?? m.name) : (m.name ?? m.corporate_name);
      if (!displayName) errors.push("Nome ou Razão Social obrigatório.");
      else m.name = displayName;

      // CPF/CNPJ é opcional — quando informado, valida tamanho
      if (doc) {
        if (type === "INDIVIDUAL" && doc.length !== 11) errors.push("CPF deve ter 11 dígitos.");
        else if (type === "COMPANY" && doc.length !== 14) errors.push("CNPJ deve ter 14 dígitos.");
      }

      // E-mail é opcional — quando informado, valida formato
      if (m.email && !isValidEmail(String(m.email))) errors.push("Informe um e-mail válido.");

      if (m.addr_state) {
        const country = (m.addr_country ?? "Brasil").toString().toLowerCase();
        if (
          (country.startsWith("bra") || country === "br") &&
          !UFS_BR.has(String(m.addr_state).toUpperCase())
        ) {
          errors.push(`UF inválida: ${m.addr_state}.`);
        }
      }

      if (m.contact_email && !isValidEmail(String(m.contact_email))) {
        errors.push("E-mail do contato inválido.");
      }
      // Dados de contato são opcionais; sem contact_name, apenas não criamos o contato.

      if (doc && (docCount.get(doc) ?? 0) > 1)
        duplicateReasons.push("CPF/CNPJ duplicado no arquivo.");
      if (m.email && (emailCount.get(String(m.email).toLowerCase()) ?? 0) > 1)
        duplicateReasons.push("E-mail duplicado no arquivo.");
      const phone = onlyDigits(m.phone || m.whatsapp);
      if (phone && (phoneCount.get(phone) ?? 0) > 1)
        duplicateReasons.push("Telefone duplicado no arquivo.");
      const normalizedName = normText(m.name || m.corporate_name);
      if (normalizedName && (nameCount.get(normalizedName) ?? 0) > 1)
        duplicateReasons.push("Nome/Razão social duplicado no arquivo.");

      // Match existing
      let matched: string | null = null;
      if (doc && existingByDoc.has(doc)) matched = existingByDoc.get(doc)!;
      else if (m.email && existingByEmail.has(String(m.email).toLowerCase()))
        matched = existingByEmail.get(String(m.email).toLowerCase())!;
      else if (phone && existingByPhone.has(phone)) matched = existingByPhone.get(phone)!;
      else if (normalizedName && existingByName.has(normalizedName))
        matched = existingByName.get(normalizedName)!;
      if (matched) duplicateReasons.push("Duplicado já cadastrado nesta empresa.");

      if (Array.isArray(m.tags)) {
        for (const t of m.tags) if (!tagMap.has(t.toLowerCase())) newTags.add(t);
      }

      const hasAddress = m.addr_street || m.addr_city || m.addr_zipcode;
      const hasContact = m.contact_name;
      if (errors.length === 0 && duplicateReasons.length === 0 && hasAddress) addresses++;
      if (errors.length === 0 && duplicateReasons.length === 0 && hasContact) contacts++;

      const status = errors.length ? "INVALID" : duplicateReasons.length ? "SKIPPED" : "VALID";
      const action = errors.length ? "ERROR" : duplicateReasons.length ? "SKIP" : "CREATE";
      if (errors.length) invalid++;
      else if (duplicateReasons.length) duplicates++;
      else valid++;

      updates.push({
        id: r.id,
        mapped_data: m,
        validation_errors: errors.length
          ? errors
          : duplicateReasons.length
            ? duplicateReasons
            : null,
        action,
        matched_customer_id: matched,
        status,
      });
    }

    for (const u of updates) {
      await sb
        .from("customer_import_rows")
        .update({
          mapped_data: u.mapped_data,
          validation_errors: u.validation_errors,
          action: u.action,
          matched_customer_id: u.matched_customer_id,
          status: u.status,
        })
        .eq("id", u.id);
    }

    await sb
      .from("customer_import_jobs")
      .update({ status: "VALIDATED", valid_rows: valid, invalid_rows: invalid })
      .eq("id", job.id);

    await logAudit(sb, "customer_imports", "validate", job.id, { valid, invalid });

    return {
      job_id: job.id,
      valid,
      invalid,
      duplicates,
      total: mappedRows.length,
      addresses_to_create: addresses,
      contacts_to_create: contacts,
      new_tags: [...newTags],
    };
  });

// =============================================================
// listCustomerImportRows
// =============================================================
export const listCustomerImportRows = createServerFn({ method: "POST" })
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
      .from("customer_import_rows")
      .select(
        "id, row_number, raw_data, mapped_data, validation_errors, action, matched_customer_id, status",
      )
      .eq("import_job_id", data.job_id)
      .order("row_number");
    if (data.filter !== "all") q = q.eq("action", data.filter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// =============================================================
// updateCustomerImportRow
// =============================================================
export const updateCustomerImportRow = createServerFn({ method: "POST" })
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
    const { error } = await sb.from("customer_import_rows").update(patch).eq("id", data.row_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================
// confirmCustomerImport
// =============================================================
const confirmSchema = z.object({
  job_id: z.string().uuid(),
  create_tags: z.boolean().default(true),
});

export const confirmCustomerImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => confirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    // Check permission
    const { data: canConfirm } = await sb.rpc("has_permission", {
      _slug: "clients.import.confirm",
    });
    if (canConfirm === false) {
      const [{ data: canImport }, { data: canCustomersImport }, { data: canCustomersConfirm }] =
        await Promise.all([
          sb.rpc("has_permission", { _slug: "clients.import" }),
          sb.rpc("has_permission", { _slug: "customers.import" }),
          sb.rpc("has_permission", { _slug: "customers.import.confirm" }),
        ]);
      if (canImport === false && canCustomersImport === false && canCustomersConfirm === false) {
        throw new Error("Você não tem permissão para importar clientes.");
      }
    }

    const { data: job, error: jobErr } = await sb
      .from("customer_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");
    if (!["VALIDATED", "MAPPED", "UPLOADED", "FAILED"].includes(job.status))
      throw new Error("Importação já finalizada.");

    await sb.from("customer_import_jobs").update({ status: "PROCESSING" }).eq("id", job.id);

    try {
      const { data: rows, error } = await sb
        .from("customer_import_rows")
        .select("*")
        .eq("import_job_id", job.id)
        .order("row_number");
      if (error) throw new Error(error.message);

      const { data: existingTags } = await sb
        .from("customer_tags")
        .select("id, name")
        .eq("company_id", company_id);
      const tagMap = new Map<string, string>(
        (existingTags ?? []).map((t: any) => [String(t.name).toLowerCase(), t.id]),
      );

      const ensureTag = async (name: string): Promise<string | null> => {
        const k = name.toLowerCase();
        if (tagMap.has(k)) return tagMap.get(k)!;
        if (!data.create_tags) return null;
        const { data: ins } = await sb
          .from("customer_tags")
          .insert({ company_id, name })
          .select("id")
          .single();
        if (ins) {
          tagMap.set(k, ins.id);
          await logAudit(sb, "customer_tags", "create_by_import", ins.id, { name });
          return ins.id;
        }
        return null;
      };

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let addrCount = 0;
      let contactCount = 0;

      for (const r of rows ?? []) {
        if (r.action === "SKIP" || r.action === "ERROR" || r.status === "INVALID") {
          skipped++;
          await sb.from("customer_import_rows").update({ status: "SKIPPED" }).eq("id", r.id);
          continue;
        }
        const m = r.mapped_data ?? {};
        const payload: any = {
          company_id,
          customer_type: m.customer_type,
          name: m.name,
          corporate_name: m.corporate_name ?? null,
          trade_name: m.trade_name ?? null,
          cpf_cnpj: m.cpf_cnpj ?? "",
          state_registration: m.state_registration ?? null,
          municipal_registration: m.municipal_registration ?? null,
          email: m.email ?? null,
          phone: m.phone ?? null,
          whatsapp: m.whatsapp ? onlyDigits(m.whatsapp) : null,
          customer_origin: m.customer_origin ?? null,
          customer_status: normalizeCustomerStatus(m.customer_status) ?? "ACTIVE",
          notes: m.notes ?? null,
          active: true,
        };
        console.log("[CUSTOMER IMPORT] companyId", company_id);
        console.log("[CUSTOMER IMPORT] insert payload", payload);

        let customerId: string | null = r.matched_customer_id ?? null;
        if (r.action === "UPDATE" && customerId) {
          const { error: upErr } = await sb
            .from("customers")
            .update(payload)
            .eq("id", customerId)
            .eq("company_id", company_id);
          if (upErr) {
            console.error("[CUSTOMER IMPORT] insert error", upErr);
            await sb
              .from("customer_import_rows")
              .update({ status: "INVALID", validation_errors: [upErr.message] })
              .eq("id", r.id);
            continue;
          }
          updated++;
          await logAudit(sb, "customers", "update_by_import", customerId, payload);
        } else {
          const { data: ins, error: insErr } = await sb
            .from("customers")
            .insert({ ...payload, created_by: context.userId })
            .select("id")
            .single();
          if (insErr || !ins) {
            console.error("[CUSTOMER IMPORT] insert error", insErr);
            await sb
              .from("customer_import_rows")
              .update({
                status: "INVALID",
                validation_errors: [insErr?.message ?? "Falha ao criar cliente."],
                action: "ERROR",
              })
              .eq("id", r.id);
            continue;
          }
          customerId = ins.id;
          created++;
          await logAudit(sb, "customers", "create_by_import", customerId, payload);
        }

        // Address
        if (customerId && (m.addr_street || m.addr_city || m.addr_zipcode)) {
          const country = m.addr_country ?? "Brasil";
          const { error: addrErr } = await sb.from("customer_addresses").insert({
            company_id,
            customer_id: customerId,
            address_type: "INSTALLATION",
            country,
            zipcode: m.addr_zipcode ?? null,
            street: m.addr_street ?? null,
            number: m.addr_number ?? null,
            complement: m.addr_complement ?? null,
            district: m.addr_district ?? null,
            city: m.addr_city ?? null,
            state: m.addr_state ?? null,
            reference: m.addr_reference ?? null,
            is_primary: true,
          });
          if (addrErr) {
            console.error("[CUSTOMER IMPORT] insert error", addrErr);
            throw new Error(`Falha ao criar endereço da linha ${r.row_number}: ${addrErr.message}`);
          }
          if (!addrErr) {
            addrCount++;
            await logAudit(sb, "customer_addresses", "create_by_import", customerId, null);
          }
        }

        // Contact
        if (customerId && m.contact_name) {
          const { error: cErr } = await sb.from("customer_contacts").insert({
            company_id,
            customer_id: customerId,
            name: m.contact_name,
            role: m.contact_role ?? null,
            email: m.contact_email ?? null,
            phone: m.contact_phone ?? null,
            whatsapp: m.contact_whatsapp ? onlyDigits(m.contact_whatsapp) : null,
            is_primary: true,
          });
          if (cErr) {
            console.error("[CUSTOMER IMPORT] insert error", cErr);
            throw new Error(`Falha ao criar contato da linha ${r.row_number}: ${cErr.message}`);
          }
          if (!cErr) {
            contactCount++;
            await logAudit(sb, "customer_contacts", "create_by_import", customerId, null);
          }
        }

        // Tags
        if (customerId && Array.isArray(m.tags) && m.tags.length) {
          for (const t of m.tags) {
            const tagId = await ensureTag(String(t));
            if (tagId) {
              await sb
                .from("customer_tag_relations")
                .insert({ company_id, customer_id: customerId, tag_id: tagId })
                .select("id")
                .maybeSingle();
            }
          }
        }

        await sb
          .from("customer_import_rows")
          .update({ status: "IMPORTED", matched_customer_id: customerId })
          .eq("id", r.id);
      }

      await sb
        .from("customer_import_jobs")
        .update({
          status: "COMPLETED",
          created_rows: created,
          updated_rows: updated,
          skipped_rows: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await logAudit(sb, "customer_imports", "completed", job.id, {
        created,
        updated,
        skipped,
        addresses: addrCount,
        contacts: contactCount,
      });
      await logActivity(
        sb,
        `Importação de clientes concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados.`,
      );

      try {
        await sb.from("notifications").insert({
          company_id,
          user_id: context.userId,
          type: skipped > 0 ? "warning" : "success",
          title:
            skipped > 0
              ? "Importação concluída com pendências"
              : "Importação de clientes concluída",
          message: `${created} criados · ${updated} atualizados · ${skipped} ignorados`,
        });
      } catch {}

      const result = { created, updated, skipped, addresses: addrCount, contacts: contactCount };
      console.log("[CUSTOMER IMPORT] insert result", result);
      return result;
    } catch (e: any) {
      await sb
        .from("customer_import_jobs")
        .update({ status: "FAILED", error_message: String(e?.message ?? e) })
        .eq("id", job.id);
      throw e;
    }
  });

// =============================================================
// listCustomerImportJobs — history
// =============================================================
export const listCustomerImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("customer_import_jobs")
      .select(
        "id, file_name, status, total_rows, valid_rows, invalid_rows, created_rows, updated_rows, skipped_rows, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelCustomerImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("customer_import_jobs")
      .update({ status: "CANCELLED" })
      .eq("id", data.job_id)
      .in("status", ["UPLOADED", "MAPPED", "VALIDATED"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
