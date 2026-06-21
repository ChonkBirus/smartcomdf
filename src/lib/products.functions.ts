import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNITS = ["UN", "CX", "MT", "M2", "M3", "RL", "KIT"] as const;
export type ProductUnit = (typeof UNITS)[number];

const SIGNED_TTL = 60 * 60; // 1 hour

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa vinculada.");
  return data.company_id as string;
}

async function signImageUrl(supabase: any, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("product-images").createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

async function logActivity(supabase: any, description: string) {
  try {
    await supabase.rpc("log_activity", { _description: description });
  } catch {}
}
async function logAudit(supabase: any, module: string, action: string, recordId?: string, newData?: any, oldData?: any) {
  try {
    await supabase.rpc("log_audit", {
      _module: module,
      _action: action,
      _record_id: recordId ?? null,
      _new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
      _old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
    });
  } catch {}
}

// ============================================================
// CATEGORIES
// ============================================================
export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("categories")
      .select("id, name, description, active, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => categorySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const company_id = await getCompanyId(supabase, userId);
    const payload = { name: data.name, description: data.description || null, active: data.active, company_id };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("categories")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await logAudit(supabase, "categories", "update", row.id, payload);
      await logActivity(supabase, `Categoria atualizada: ${row.name}`);
      return row;
    }
    const { data: row, error } = await supabase.from("categories").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, "categories", "create", row.id, payload);
    await logActivity(supabase, `Categoria criada: ${row.name}`);
    return row;
  });

export const toggleCategoryActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("categories").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "categories", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// BRANDS
// ============================================================
export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brands")
      .select("id, name, description, active, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const brandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => brandSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const company_id = await getCompanyId(supabase, userId);
    const payload = { name: data.name, description: data.description || null, active: data.active, company_id };
    if (data.id) {
      const { data: row, error } = await supabase.from("brands").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      await logAudit(supabase, "brands", "update", row.id, payload);
      await logActivity(supabase, `Marca atualizada: ${row.name}`);
      return row;
    }
    const { data: row, error } = await supabase.from("brands").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, "brands", "create", row.id, payload);
    await logActivity(supabase, `Marca criada: ${row.name}`);
    return row;
  });

export const toggleBrandActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brands").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "brands", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// MANUFACTURERS
// ============================================================
export const listManufacturers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("manufacturers")
      .select("id, name, website, phone, email, active, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const manufacturerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(255).email("E-mail inválido").optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const saveManufacturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => manufacturerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const company_id = await getCompanyId(supabase, userId);
    const payload = {
      name: data.name,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      active: data.active,
      company_id,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("manufacturers")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await logAudit(supabase, "manufacturers", "update", row.id, payload);
      await logActivity(supabase, `Fabricante atualizado: ${row.name}`);
      return row;
    }
    const { data: row, error } = await supabase.from("manufacturers").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, "manufacturers", "create", row.id, payload);
    await logActivity(supabase, `Fabricante criado: ${row.name}`);
    return row;
  });

export const toggleManufacturerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("manufacturers")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "manufacturers", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// PRODUCTS
// ============================================================
const listProductsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    category_id: z.string().uuid().optional(),
    brand_id: z.string().uuid().optional(),
    manufacturer_id: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).default("all"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
    sort: z.enum(["name", "created_at", "sale_price"]).default("name"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .default({ status: "all", page: 1, page_size: 20, sort: "name", direction: "asc" });

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listProductsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = supabase
      .from("products")
      .select(
        "id, name, sku, barcode, sale_price, cost_price, active, unit, minimum_stock, created_at, category:categories(id,name), brand:brands(id,name), manufacturer:manufacturers(id,name)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order(data.sort, { ascending: data.direction === "asc" })
      .range(from, to);

    if (data.search) {
      const term = `%${data.search.replace(/[%_]/g, (m) => "\\" + m)}%`;
      q = q.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`);
    }
    if (data.category_id) q = q.eq("category_id", data.category_id);
    if (data.brand_id) q = q.eq("brand_id", data.brand_id);
    if (data.manufacturer_id) q = q.eq("manufacturer_id", data.manufacturer_id);
    if (data.status === "active") q = q.eq("active", true);
    if (data.status === "inactive") q = q.eq("active", false);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    let primaryByProduct: Record<string, { file_path: string; file_name: string }> = {};
    if (ids.length) {
      const { data: imgs } = await supabase
        .from("product_images")
        .select("product_id, file_path, file_name, is_primary, created_at")
        .in("product_id", ids)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      (imgs ?? []).forEach((img: any) => {
        if (!primaryByProduct[img.product_id]) {
          primaryByProduct[img.product_id] = { file_path: img.file_path, file_name: img.file_name };
        }
      });
    }

    const items = await Promise.all(
      (rows ?? []).map(async (r: any) => ({
        ...r,
        image_url: await signImageUrl(supabase, primaryByProduct[r.id]?.file_path),
      })),
    );

    return { items, total: count ?? 0, page: data.page, page_size: data.page_size };
  });

export const getProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await supabase
      .from("products")
      .select("*, category:categories(id,name), brand:brands(id,name), manufacturer:manufacturers(id,name)")
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Produto não encontrado.");

    const { data: imgs } = await supabase
      .from("product_images")
      .select("id, file_path, file_name, is_primary, created_at")
      .eq("product_id", data.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    const images = await Promise.all(
      (imgs ?? []).map(async (i: any) => ({ ...i, url: await signImageUrl(supabase, i.file_path) })),
    );
    return { ...p, images };
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sku: z.string().trim().min(1, "SKU obrigatório").max(80),
  barcode: z.string().trim().max(80).optional().or(z.literal("")),
  category_id: z.string().uuid("Categoria obrigatória"),
  brand_id: z.string().uuid().optional().nullable(),
  manufacturer_id: z.string().uuid().optional().nullable(),
  unit: z.enum(UNITS).default("UN"),
  cost_price: z.number().min(0, "Preço de custo inválido").default(0),
  sale_price: z.number().min(0, "Preço de venda inválido").default(0),
  minimum_stock: z.number().min(0).default(0),
  active: z.boolean().default(true),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const company_id = await getCompanyId(supabase, userId);

    const payload = {
      name: data.name,
      description: data.description || null,
      sku: data.sku,
      barcode: data.barcode || null,
      category_id: data.category_id,
      brand_id: data.brand_id || null,
      manufacturer_id: data.manufacturer_id || null,
      unit: data.unit,
      cost_price: data.cost_price,
      sale_price: data.sale_price,
      minimum_stock: data.minimum_stock,
      active: data.active,
      company_id,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um produto com este SKU.");
        throw new Error(error.message);
      }
      await logAudit(supabase, "products", "update", row.id, payload);
      await logActivity(supabase, `Produto atualizado: ${row.name}`);
      return row;
    }
    const { data: row, error } = await supabase.from("products").insert(payload).select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um produto com este SKU.");
      throw new Error(error.message);
    }
    await logAudit(supabase, "products", "create", row.id, payload);
    await logActivity(supabase, `Produto criado: ${row.name}`);
    return row;
  });

export const softDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "products", "soft_delete", data.id);
    await logActivity(context.supabase, `Produto removido.`);
    return { ok: true };
  });

export const toggleProductActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, "products", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// PRODUCT IMAGES
// ============================================================
export const registerProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product_id: z.string().uuid(),
        file_path: z.string().min(1).max(500),
        file_name: z.string().min(1).max(200),
        is_primary: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const company_id = await getCompanyId(supabase, userId);

    // Ensure at least the first image is primary
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.product_id);
    const isPrimary = data.is_primary || (count ?? 0) === 0;

    const { data: row, error } = await supabase
      .from("product_images")
      .insert({
        company_id,
        product_id: data.product_id,
        file_path: data.file_path,
        file_url: data.file_path, // historical column; signed URL generated on read
        file_name: data.file_name,
        is_primary: isPrimary,
      })
      .select("id, file_path, file_name, is_primary, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ...row, url: await signImageUrl(supabase, row.file_path) };
  });

export const setPrimaryProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_images").update({ is_primary: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: img } = await supabase
      .from("product_images")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (img?.file_path) {
      await supabase.storage.from("product-images").remove([img.file_path]);
    }
    const { error } = await supabase.from("product_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
