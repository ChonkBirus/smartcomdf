import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNITS = ["UN", "CX", "MT", "M2", "M3", "RL", "KIT"] as const;
export type ProductUnit = (typeof UNITS)[number];

export type ItemType = "PRODUCT" | "SERVICE";
export type CategoryType = "PRODUCT" | "SERVICE" | "BOTH";

const SIGNED_TTL = 60 * 60;

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
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("categories")
      .select("id, name, description, active, category_type, created_at")
      .eq("company_id", company_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  description: z.string().trim().max(500).nullish().or(z.literal("")),
  category_type: z.enum(["PRODUCT", "SERVICE", "BOTH"]).default("BOTH"),
  active: z.boolean().default(true),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => categorySchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const company_id = await getCompanyId(supabase, context.userId);
    const payload: any = {
      name: data.name,
      description: data.description || null,
      category_type: data.category_type,
      active: data.active,
      company_id,
    };
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
    const sb = context.supabase as any;
    const { error } = await sb.from("categories").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(sb, "categories", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// BRANDS
// ============================================================
export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("brands")
      .select("id, name, description, active, created_at")
      .eq("company_id", company_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

const brandSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Nome obrigatório").max(120),
  description: z.string().trim().max(500).nullish().or(z.literal("")),
  active: z.boolean().default(true),
});

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => brandSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const payload: any = { name: data.name, description: data.description || null, active: data.active, company_id };
    if (data.id) {
      const { data: row, error } = await sb.from("brands").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      await logAudit(sb, "brands", "update", row.id, payload);
      await logActivity(sb, `Marca atualizada: ${row.name}`);
      return row;
    }
    const { data: row, error } = await sb.from("brands").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit(sb, "brands", "create", row.id, payload);
    await logActivity(sb, `Marca criada: ${row.name}`);
    return row;
  });

export const toggleBrandActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("brands").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(sb, "brands", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// MANUFACTURERS
// ============================================================
export const listManufacturers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const { data, error } = await sb
      .from("manufacturers")
      .select("id, name, website, phone, email, active, created_at")
      .eq("company_id", company_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
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
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const payload: any = {
      name: data.name,
      website: data.website || null,
      phone: data.phone || null,
      email: data.email || null,
      active: data.active,
      company_id,
    };
    if (data.id) {
      const { data: row, error } = await sb
        .from("manufacturers")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      await logAudit(sb, "manufacturers", "update", row.id, payload);
      await logActivity(sb, `Fabricante atualizado: ${row.name}`);
      return row;
    }
    const { data: row, error } = await sb.from("manufacturers").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit(sb, "manufacturers", "create", row.id, payload);
    await logActivity(sb, `Fabricante criado: ${row.name}`);
    return row;
  });

export const toggleManufacturerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("manufacturers").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(sb, "manufacturers", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// ITEMS (Products + Services)
// ============================================================
const listItemsSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    item_type: z.enum(["all", "PRODUCT", "SERVICE"]).default("all"),
    category_id: z.string().uuid().optional(),
    brand_id: z.string().uuid().optional(),
    manufacturer_id: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).default("all"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
    sort: z.enum(["name", "created_at", "sale_price"]).default("name"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .default({ item_type: "all", status: "all", page: 1, page_size: 20, sort: "name", direction: "asc" });

export const listItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listItemsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = sb
      .from("items")
      .select(
        "id, name, sku, barcode, sale_price, cost_price, active, unit, minimum_stock, controls_stock, item_type, created_at, category:categories(id,name), brand:brands(id,name), manufacturer:manufacturers(id,name)",
        { count: "exact" },
      )
      .eq("company_id", company_id)
      .is("deleted_at", null)
      .order(data.sort, { ascending: data.direction === "asc" })
      .range(from, to);

    if (data.search) {
      const term = `%${data.search.replace(/[%_]/g, (m) => "\\" + m)}%`;
      q = q.or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`);
    }
    if (data.item_type !== "all") q = q.eq("item_type", data.item_type);
    if (data.category_id) q = q.eq("category_id", data.category_id);
    if (data.brand_id) q = q.eq("brand_id", data.brand_id);
    if (data.manufacturer_id) q = q.eq("manufacturer_id", data.manufacturer_id);
    if (data.status === "active") q = q.eq("active", true);
    if (data.status === "inactive") q = q.eq("active", false);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    let primaryByItem: Record<string, { file_path: string; file_name: string }> = {};
    if (ids.length) {
      const { data: imgs } = await sb
        .from("item_images")
        .select("item_id, file_path, file_name, is_primary, created_at")
        .in("item_id", ids)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      (imgs ?? []).forEach((img: any) => {
        if (!primaryByItem[img.item_id]) {
          primaryByItem[img.item_id] = { file_path: img.file_path, file_name: img.file_name };
        }
      });
    }

    const items = await Promise.all(
      (rows ?? []).map(async (r: any) => ({
        ...r,
        image_url: await signImageUrl(sb, primaryByItem[r.id]?.file_path),
      })),
    );

    return { items, total: count ?? 0, page: data.page, page_size: data.page_size };
  });

export const getItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const { data: p, error } = await sb
      .from("items")
      .select("*, category:categories(id,name), brand:brands(id,name), manufacturer:manufacturers(id,name)")
      .eq("id", data.id)
      .eq("company_id", company_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Item não encontrado.");

    const { data: imgs } = await sb
      .from("item_images")
      .select("id, file_path, file_name, is_primary, created_at")
      .eq("item_id", data.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    const images = await Promise.all(
      (imgs ?? []).map(async (i: any) => ({ ...i, url: await signImageUrl(sb, i.file_path) })),
    );
    return { ...p, images };
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  item_type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  description: z.string().trim().max(2000).nullish().or(z.literal("")),
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  barcode: z.string().trim().max(80).optional().or(z.literal("")),
  category_id: z.string().uuid("Categoria obrigatória"),
  brand_id: z.string().uuid().optional().nullable(),
  manufacturer_id: z.string().uuid().optional().nullable(),
  unit: z.enum(UNITS).default("UN"),
  cost_price: z.number().min(0, "Preço de custo inválido").default(0),
  sale_price: z.number().min(0, "Preço de venda inválido").default(0),
  controls_stock: z.boolean().default(true),
  minimum_stock: z.number().min(0).default(0),
  active: z.boolean().default(true),
});

export const saveItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => itemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);
    const isService = data.item_type === "SERVICE";

    // Detect type change for audit
    let oldType: string | null = null;
    if (data.id) {
      const { data: old } = await sb.from("items").select("item_type").eq("id", data.id).maybeSingle();
      oldType = old?.item_type ?? null;
    }

    const payload: any = {
      item_type: data.item_type,
      name: data.name,
      description: data.description || null,
      sku: data.sku ? data.sku.trim() : null,
      barcode: isService ? null : data.barcode || null,
      category_id: data.category_id,
      brand_id: data.brand_id || null,
      manufacturer_id: isService ? null : data.manufacturer_id || null,
      unit: data.unit,
      cost_price: data.cost_price,
      sale_price: data.sale_price,
      controls_stock: isService ? false : data.controls_stock,
      minimum_stock: isService ? 0 : data.minimum_stock,
      active: data.active,
      company_id,
    };

    if (data.id) {
      const { data: row, error } = await sb.from("items").update(payload).eq("id", data.id).select("*").single();
      if (error) {
        if (error.code === "23505") throw new Error("Já existe um item com este SKU.");
        throw new Error(error.message);
      }
      await logAudit(sb, "items", "update", row.id, payload);
      if (oldType && oldType !== data.item_type) {
        await logAudit(sb, "items", "type_change", row.id, { from: oldType, to: data.item_type });
        await logActivity(sb, `Item ${row.name}: tipo alterado de ${oldType} para ${data.item_type}`);
      } else {
        await logActivity(sb, `Item atualizado: ${row.name}`);
      }
      return row;
    }
    const { data: row, error } = await sb.from("items").insert(payload).select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("Já existe um item com este SKU.");
      throw new Error(error.message);
    }
    await logAudit(sb, "items", "create", row.id, payload);
    await logActivity(sb, `${data.item_type === "SERVICE" ? "Serviço" : "Produto"} criado: ${row.name}`);
    return row;
  });

export const softDeleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("items")
      .update({ deleted_at: new Date().toISOString(), active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(sb, "items", "soft_delete", data.id);
    await logActivity(sb, "Item removido.");
    return { ok: true };
  });

export const toggleItemActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("items").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(sb, "items", data.active ? "activate" : "deactivate", data.id);
    return { ok: true };
  });

// ============================================================
// ITEM IMAGES
// ============================================================
export const registerItemImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        item_id: z.string().uuid(),
        file_path: z.string().min(1).max(500),
        file_name: z.string().min(1).max(200),
        is_primary: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const company_id = await getCompanyId(sb, context.userId);

    const { count } = await sb
      .from("item_images")
      .select("id", { count: "exact", head: true })
      .eq("item_id", data.item_id);
    const isPrimary = data.is_primary || (count ?? 0) === 0;

    const { data: row, error } = await sb
      .from("item_images")
      .insert({
        company_id,
        item_id: data.item_id,
        file_path: data.file_path,
        file_name: data.file_name,
        file_url: data.file_path,
        is_primary: isPrimary,
      })
      .select("id, file_path, file_name, is_primary, created_at")
      .single();
    if (error) throw new Error(error.message);
    const { data: signed } = await sb.storage.from("product-images").createSignedUrl(row.file_path, SIGNED_TTL);
    await logAudit(sb, "item_images", "create", row.id, { item_id: data.item_id, file_name: data.file_name });
    return { ...row, url: signed?.signedUrl ?? null };
  });

export const setPrimaryItemImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("item_images").update({ is_primary: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteItemImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: img } = await sb.from("item_images").select("file_path").eq("id", data.id).maybeSingle();
    const { error } = await sb.from("item_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (img?.file_path) {
      try {
        await sb.storage.from("product-images").remove([img.file_path]);
      } catch {}
    }
    await logAudit(sb, "item_images", "delete", data.id);
    return { ok: true };
  });

// ============================================================
// Backwards-compat aliases (legacy imports)
// ============================================================
export const listProducts = listItems;
export const getProduct = getItem;
export const saveProduct = saveItem;
export const softDeleteProduct = softDeleteItem;
export const toggleProductActive = toggleItemActive;
export const registerProductImage = registerItemImage;
export const setPrimaryProductImage = setPrimaryItemImage;
export const deleteProductImage = deleteItemImage;
