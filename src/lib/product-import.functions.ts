import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNITS = ["UN", "CX", "MT", "M2", "M3", "RL", "KIT"] as const;

// Map header (lowercase / normalized) → target field
const HEADER_ALIASES: Record<string, string> = {
  nome: "name",
  produto: "name",
  "nome do produto": "name",
  descricao: "description",
  descrição: "description",
  sku: "sku",
  codigo: "sku",
  código: "sku",
  cod: "sku",
  "codigo interno": "sku",
  "código interno": "sku",
  "codigo de barras": "barcode",
  "código de barras": "barcode",
  barcode: "barcode",
  ean: "barcode",
  categoria: "category_name",
  marca: "brand_name",
  fabricante: "manufacturer_name",
  unidade: "unit",
  un: "unit",
  "preco de custo": "cost_price",
  "preço de custo": "cost_price",
  custo: "cost_price",
  "preco de venda": "sale_price",
  "preço de venda": "sale_price",
  venda: "sale_price",
  preco: "sale_price",
  preço: "sale_price",
  "estoque minimo": "minimum_stock",
  "estoque mínimo": "minimum_stock",
  "minimo": "minimum_stock",
  ncm: "ncm",
  "quantidade inicial": "initial_qty",
  "estoque inicial": "initial_qty",
  qtd: "initial_qty",
  quantidade: "initial_qty",
};

export const TARGET_FIELDS = [
  "name",
  "description",
  "sku",
  "barcode",
  "category_name",
  "brand_name",
  "manufacturer_name",
  "unit",
  "cost_price",
  "sale_price",
  "minimum_stock",
  "ncm",
  "initial_qty",
  "__ignore__",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

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

function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function normalizeUnit(v: any): string | null {
  if (!v) return null;
  const s = String(v).toUpperCase().trim();
  if (UNITS.includes(s as any)) return s;
  // Common aliases
  const map: Record<string, string> = { UNIDADE: "UN", PC: "UN", PCS: "UN", CAIXA: "CX", METRO: "MT", M: "MT" };
  return map[s] ?? null;
}

function buildMappedRow(raw: Record<string, any>, mapping: Record<string, TargetField>) {
  const out: Record<string, any> = {};
  for (const [header, target] of Object.entries(mapping)) {
    if (target === "__ignore__") continue;
    const v = raw[header];
    if (v === undefined || v === null || v === "") continue;
    if (["cost_price", "sale_price", "minimum_stock", "initial_qty"].includes(target)) {
      out[target] = parseNumber(v);
    } else if (target === "unit") {
      out[target] = normalizeUnit(v) ?? String(v).toUpperCase().trim();
    } else {
      out[target] = String(v).trim();
    }
  }
  return out;
}

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa vinculada.");
  return data.company_id as string;
}

async function logAudit(sb: any, module: string, action: string, recordId?: string, newData?: any) {
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
// createImportJob — receives parsed rows from client and creates job
// =============================================================
const createJobSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_url: z.string().optional().nullable(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.record(z.string(), z.any())).max(5000),
});

export const createImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createJobSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const mapping = suggestMapping(data.headers);

    const { data: job, error } = await sb
      .from("product_import_jobs")
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
      // Insert in chunks of 500
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error: errIns } = await sb.from("product_import_rows").insert(chunk);
        if (errIns) throw new Error(errIns.message);
      }
    }

    await logAudit(sb, "product_imports", "upload", job.id, { file_name: data.file_name, total: data.rows.length });
    await logActivity(sb, `Importação de produtos iniciada: ${data.file_name} (${data.rows.length} linhas)`);

    return { job_id: job.id, headers: data.headers, mapping };
  });

// =============================================================
// validateImport — applies mapping, validates and matches
// =============================================================
const validateSchema = z.object({
  job_id: z.string().uuid(),
  mapping: z.record(z.string(), z.string()),
});

export const validateImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => validateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    // Verify job belongs to company
    const { data: job, error: jobErr } = await sb
      .from("product_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");

    // Update mapping
    await sb.from("product_import_jobs").update({ column_mapping: data.mapping, status: "MAPPED" }).eq("id", job.id);

    // Fetch all rows
    const { data: rows, error } = await sb
      .from("product_import_rows")
      .select("id, raw_data, row_number")
      .eq("import_job_id", job.id)
      .order("row_number");
    if (error) throw new Error(error.message);

    // Build mapped data
    const mapping = data.mapping as Record<string, TargetField>;
    type Mapped = Record<string, any>;
    const mappedRows: { id: string; row_number: number; mapped: Mapped }[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      row_number: r.row_number,
      mapped: buildMappedRow(r.raw_data, mapping),
    }));

    // Load existing items for matching
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    const names = new Set<string>();
    for (const r of mappedRows) {
      if (r.mapped.sku) skus.add(String(r.mapped.sku));
      if (r.mapped.barcode) barcodes.add(String(r.mapped.barcode));
      if (r.mapped.name) names.add(String(r.mapped.name).toLowerCase());
    }

    const existingBySku = new Map<string, string>();
    const existingByBarcode = new Map<string, string>();
    const existingByName = new Map<string, string>();
    if (skus.size || barcodes.size || names.size) {
      const orParts: string[] = [];
      if (skus.size) orParts.push(`sku.in.(${[...skus].map((s) => `"${s.replace(/"/g, "")}"`).join(",")})`);
      if (barcodes.size)
        orParts.push(`barcode.in.(${[...barcodes].map((s) => `"${s.replace(/"/g, "")}"`).join(",")})`);
      const { data: existing } = await sb
        .from("items")
        .select("id, sku, barcode, name")
        .eq("company_id", company_id)
        .eq("item_type", "PRODUCT")
        .is("deleted_at", null)
        .or(orParts.join(","));
      (existing ?? []).forEach((it: any) => {
        if (it.sku) existingBySku.set(it.sku, it.id);
        if (it.barcode) existingByBarcode.set(it.barcode, it.id);
        if (it.name) existingByName.set(String(it.name).toLowerCase(), it.id);
      });
      // Also name lookup for full set
      if (names.size) {
        const { data: byName } = await sb
          .from("items")
          .select("id, name")
          .eq("company_id", company_id)
          .eq("item_type", "PRODUCT")
          .is("deleted_at", null)
          .in("name", [...names].map((n) => n));
        (byName ?? []).forEach((it: any) => existingByName.set(String(it.name).toLowerCase(), it.id));
      }
    }

    // Detect duplicates within the file
    const skuCount = new Map<string, number>();
    const barcodeCount = new Map<string, number>();
    for (const r of mappedRows) {
      if (r.mapped.sku) skuCount.set(r.mapped.sku, (skuCount.get(r.mapped.sku) ?? 0) + 1);
      if (r.mapped.barcode) barcodeCount.set(r.mapped.barcode, (barcodeCount.get(r.mapped.barcode) ?? 0) + 1);
    }

    let valid = 0;
    let invalid = 0;
    const newCategories = new Set<string>();
    const newBrands = new Set<string>();
    const newManufacturers = new Set<string>();

    // Load existing taxonomy
    const [{ data: cats }, { data: brs }, { data: mfs }] = await Promise.all([
      sb.from("categories").select("id, name").eq("company_id", company_id),
      sb.from("brands").select("id, name").eq("company_id", company_id),
      sb.from("manufacturers").select("id, name").eq("company_id", company_id),
    ]);
    const catMap = new Map<string, string>((cats ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));
    const brMap = new Map<string, string>((brs ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));
    const mfMap = new Map<string, string>((mfs ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));

    const updates: any[] = [];
    for (const r of mappedRows) {
      const m = r.mapped;
      const errors: string[] = [];
      // Default unit
      if (!m.unit) m.unit = "UN";
      if (!m.name) errors.push("Nome obrigatório.");
      if (!m.sku && !m.barcode) errors.push("SKU ou código de barras obrigatório.");
      if (m.unit && !UNITS.includes(m.unit)) errors.push(`Unidade inválida: ${m.unit}.`);
      if (m.sale_price == null) errors.push("Preço de venda obrigatório.");
      else if (m.sale_price < 0) errors.push("Preço de venda inválido.");
      if (m.cost_price != null && m.cost_price < 0) errors.push("Preço de custo inválido.");
      if (m.minimum_stock != null && m.minimum_stock < 0) errors.push("Estoque mínimo inválido.");
      if (m.sku && (skuCount.get(m.sku) ?? 0) > 1) errors.push("SKU duplicado no arquivo.");
      if (m.barcode && (barcodeCount.get(m.barcode) ?? 0) > 1) errors.push("Código de barras duplicado no arquivo.");

      // Match existing
      let matched: string | null = null;
      if (m.sku && existingBySku.has(m.sku)) matched = existingBySku.get(m.sku)!;
      else if (m.barcode && existingByBarcode.has(m.barcode)) matched = existingByBarcode.get(m.barcode)!;
      else if (m.name && existingByName.has(String(m.name).toLowerCase()))
        matched = existingByName.get(String(m.name).toLowerCase())!;

      // Track new taxonomies
      if (m.category_name && !catMap.has(String(m.category_name).toLowerCase()))
        newCategories.add(m.category_name);
      if (m.brand_name && !brMap.has(String(m.brand_name).toLowerCase())) newBrands.add(m.brand_name);
      if (m.manufacturer_name && !mfMap.has(String(m.manufacturer_name).toLowerCase()))
        newManufacturers.add(m.manufacturer_name);

      const status = errors.length ? "INVALID" : "VALID";
      const action = errors.length ? "ERROR" : matched ? "UPDATE" : "CREATE";
      if (errors.length) invalid++;
      else valid++;

      updates.push({
        id: r.id,
        mapped_data: m,
        validation_errors: errors.length ? errors : null,
        action,
        matched_item_id: matched,
        status,
      });
    }

    // Apply updates in chunks
    for (const u of updates) {
      await sb
        .from("product_import_rows")
        .update({
          mapped_data: u.mapped_data,
          validation_errors: u.validation_errors,
          action: u.action,
          matched_item_id: u.matched_item_id,
          status: u.status,
        })
        .eq("id", u.id);
    }

    const initialEntries = updates.filter(
      (u) => u.status === "VALID" && Number(u.mapped_data.initial_qty ?? 0) > 0,
    ).length;

    await sb
      .from("product_import_jobs")
      .update({
        status: "VALIDATED",
        valid_rows: valid,
        invalid_rows: invalid,
      })
      .eq("id", job.id);

    await logAudit(sb, "product_imports", "validate", job.id, { valid, invalid });

    return {
      job_id: job.id,
      valid,
      invalid,
      total: mappedRows.length,
      new_categories: [...newCategories],
      new_brands: [...newBrands],
      new_manufacturers: [...newManufacturers],
      initial_stock_entries: initialEntries,
    };
  });

// =============================================================
// listImportRows — fetch rows for preview UI
// =============================================================
export const listImportRows = createServerFn({ method: "POST" })
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
      .from("product_import_rows")
      .select("id, row_number, raw_data, mapped_data, validation_errors, action, matched_item_id, status")
      .eq("import_job_id", data.job_id)
      .order("row_number");
    if (data.filter !== "all") q = q.eq("action", data.filter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// =============================================================
// updateImportRow — allow user to edit a row's mapped_data/action
// =============================================================
export const updateImportRow = createServerFn({ method: "POST" })
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
    const { error } = await sb.from("product_import_rows").update(patch).eq("id", data.row_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============================================================
// confirmImport — execute the import
// =============================================================
const confirmSchema = z.object({
  job_id: z.string().uuid(),
  create_categories: z.boolean().default(true),
  create_brands: z.boolean().default(true),
  create_manufacturers: z.boolean().default(true),
  stock_location_id: z.string().uuid().nullable().optional(),
});

export const confirmImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => confirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const { data: job, error: jobErr } = await sb
      .from("product_import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .eq("company_id", company_id)
      .maybeSingle();
    if (jobErr || !job) throw new Error("Importação não encontrada.");
    if (!["VALIDATED", "MAPPED", "UPLOADED", "FAILED"].includes(job.status))
      throw new Error("Importação já finalizada.");

    await sb.from("product_import_jobs").update({ status: "PROCESSING" }).eq("id", job.id);

    try {
      const { data: rows, error } = await sb
        .from("product_import_rows")
        .select("*")
        .eq("import_job_id", job.id)
        .order("row_number");
      if (error) throw new Error(error.message);

      // Load taxonomy
      const [{ data: cats }, { data: brs }, { data: mfs }] = await Promise.all([
        sb.from("categories").select("id, name").eq("company_id", company_id),
        sb.from("brands").select("id, name").eq("company_id", company_id),
        sb.from("manufacturers").select("id, name").eq("company_id", company_id),
      ]);
      const catMap = new Map<string, string>((cats ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));
      const brMap = new Map<string, string>((brs ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));
      const mfMap = new Map<string, string>((mfs ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id]));

      const ensureCategory = async (name: string): Promise<string | null> => {
        const k = name.toLowerCase();
        if (catMap.has(k)) return catMap.get(k)!;
        if (!data.create_categories) return null;
        const { data: ins } = await sb
          .from("categories")
          .insert({ company_id, name, category_type: "PRODUCT", active: true })
          .select("id")
          .single();
        if (ins) {
          catMap.set(k, ins.id);
          await logAudit(sb, "categories", "create_by_import", ins.id, { name });
          return ins.id;
        }
        return null;
      };
      const ensureBrand = async (name: string): Promise<string | null> => {
        const k = name.toLowerCase();
        if (brMap.has(k)) return brMap.get(k)!;
        if (!data.create_brands) return null;
        const { data: ins } = await sb
          .from("brands")
          .insert({ company_id, name, active: true })
          .select("id")
          .single();
        if (ins) {
          brMap.set(k, ins.id);
          await logAudit(sb, "brands", "create_by_import", ins.id, { name });
          return ins.id;
        }
        return null;
      };
      const ensureManufacturer = async (name: string): Promise<string | null> => {
        const k = name.toLowerCase();
        if (mfMap.has(k)) return mfMap.get(k)!;
        if (!data.create_manufacturers) return null;
        const { data: ins } = await sb
          .from("manufacturers")
          .insert({ company_id, name, active: true })
          .select("id")
          .single();
        if (ins) {
          mfMap.set(k, ins.id);
          await logAudit(sb, "manufacturers", "create_by_import", ins.id, { name });
          return ins.id;
        }
        return null;
      };

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let stockEntries = 0;

      for (const r of rows ?? []) {
        if (r.action === "SKIP" || r.action === "ERROR" || r.status === "INVALID") {
          skipped++;
          await sb.from("product_import_rows").update({ status: "SKIPPED" }).eq("id", r.id);
          continue;
        }
        const m = r.mapped_data ?? {};
        const category_id = m.category_name ? await ensureCategory(String(m.category_name)) : null;
        const brand_id = m.brand_name ? await ensureBrand(String(m.brand_name)) : null;
        const manufacturer_id = m.manufacturer_name ? await ensureManufacturer(String(m.manufacturer_name)) : null;

        const payload: any = {
          item_type: "PRODUCT",
          controls_stock: true,
          name: m.name,
          description: m.description ?? null,
          sku: m.sku ?? null,
          barcode: m.barcode ?? null,
          category_id,
          brand_id,
          manufacturer_id,
          unit: m.unit ?? "UN",
          cost_price: Number(m.cost_price ?? 0),
          sale_price: Number(m.sale_price ?? 0),
          minimum_stock: Number(m.minimum_stock ?? 0),
          active: true,
          company_id,
        };

        let itemId: string | null = r.matched_item_id ?? null;
        if (r.action === "UPDATE" && itemId) {
          const { error: upErr } = await sb.from("items").update(payload).eq("id", itemId).eq("company_id", company_id);
          if (upErr) {
            await sb
              .from("product_import_rows")
              .update({ status: "INVALID", validation_errors: [upErr.message] })
              .eq("id", r.id);
            continue;
          }
          updated++;
          await logAudit(sb, "items", "update_by_import", itemId, payload);
        } else {
          const { data: ins, error: insErr } = await sb.from("items").insert(payload).select("id").single();
          if (insErr || !ins) {
            await sb
              .from("product_import_rows")
              .update({
                status: "INVALID",
                validation_errors: [insErr?.message ?? "Falha ao criar item."],
                action: "ERROR",
              })
              .eq("id", r.id);
            continue;
          }
          itemId = ins.id;
          created++;
          await logAudit(sb, "items", "create_by_import", itemId, payload);
        }

        // Initial stock entry
        const qty = Number(m.initial_qty ?? 0);
        if (qty > 0 && data.stock_location_id && itemId) {
          const { error: movErr } = await sb.from("stock_movements").insert({
            company_id,
            item_id: itemId,
            location_id: data.stock_location_id,
            movement_type: "ENTRY",
            quantity: qty,
            reason: "Importação inicial de produtos",
            created_by: context.userId,
          });
          if (!movErr) {
            stockEntries++;
            await logAudit(sb, "stock_movements", "create_by_import", itemId, { qty, location: data.stock_location_id });
          }
        }

        await sb.from("product_import_rows").update({ status: "IMPORTED", matched_item_id: itemId }).eq("id", r.id);
      }

      await sb
        .from("product_import_jobs")
        .update({
          status: "COMPLETED",
          created_rows: created,
          updated_rows: updated,
          skipped_rows: skipped,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await logAudit(sb, "product_imports", "completed", job.id, { created, updated, skipped, stockEntries });
      await logActivity(
        sb,
        `Importação concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados.`,
      );

      // Notification
      try {
        await sb.from("notifications").insert({
          company_id,
          user_id: context.userId,
          type: skipped > 0 ? "warning" : "success",
          title: skipped > 0 ? "Importação concluída com pendências" : "Importação de produtos concluída",
          message: `${created} criados · ${updated} atualizados · ${skipped} ignorados`,
        });
      } catch {}

      return { created, updated, skipped, stock_entries: stockEntries };
    } catch (e: any) {
      await sb
        .from("product_import_jobs")
        .update({ status: "FAILED", error_message: String(e?.message ?? e) })
        .eq("id", job.id);
      throw e;
    }
  });

// =============================================================
// listImportJobs — history
// =============================================================
export const listImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("product_import_jobs")
      .select(
        "id, file_name, status, total_rows, valid_rows, invalid_rows, created_rows, updated_rows, skipped_rows, created_at, completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("product_import_jobs")
      .update({ status: "CANCELLED" })
      .eq("id", data.job_id)
      .in("status", ["UPLOADED", "MAPPED", "VALIDATED"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
