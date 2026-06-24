import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaterialUsage = {
  id: string;
  company_id: string;
  service_order_id: string;
  item_id: string;
  service_order_item_id: string | null;
  stock_location_id: string | null;
  planned_quantity: number;
  used_quantity: number;
  unit: string | null;
  notes: string | null;
  stock_warning: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  item_name?: string | null;
  item_image_url?: string | null;
  location_name?: string | null;
};

export type PlannedItem = {
  id: string; // service_order_items.id
  item_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  planned_quantity: number;
  unit: string;
  item_type: string;
  controls_stock: boolean;
};

export type StockableProduct = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
};

export type StockLocationLite = { id: string; name: string };

export const listMaterialUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MaterialUsage[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_material_usage")
      .select(`*, item:item_id(name), location:stock_location_id(name),
               so_item:service_order_item_id(image_url)`)
      .eq("service_order_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      item_name: r.item?.name ?? null,
      item_image_url: r.so_item?.image_url ?? null,
      location_name: r.location?.name ?? null,
    }));
  });

export const listPlannedStockItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PlannedItem[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_items")
      .select(`id, item_id, name, description, image_url, planned_quantity, unit, item_type,
               item:item_id(controls_stock, item_type)`)
      .eq("service_order_id", data.id)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .map((r: any) => ({
        id: r.id,
        item_id: r.item_id,
        name: r.name,
        description: r.description,
        image_url: r.image_url,
        planned_quantity: Number(r.planned_quantity ?? 0),
        unit: r.unit ?? "UN",
        item_type: r.item?.item_type ?? r.item_type ?? "PRODUCT",
        controls_stock: Boolean(r.item?.controls_stock),
      }))
      // Materiais: produto com controle de estoque (sem serviço/mão de obra)
      .filter((r: PlannedItem) =>
        r.item_type === "PRODUCT" && r.controls_stock,
      );
  });

export const addMaterialUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    serviceOrderId: z.string().uuid(),
    itemId: z.string().uuid(),
    usedQuantity: z.number().positive(),
    locationId: z.string().uuid(),
    serviceOrderItemId: z.string().uuid().optional(),
    notes: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.rpc("so_material_add", {
      _so_id: data.serviceOrderId,
      _item_id: data.itemId,
      _used_quantity: data.usedQuantity,
      _location_id: data.locationId,
      _so_item_id: data.serviceOrderItemId ?? null,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMaterialUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    usedQuantity: z.number().positive(),
    locationId: z.string().uuid().optional(),
    notes: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.rpc("so_material_update", {
      _id: data.id,
      _used_quantity: data.usedQuantity,
      _location_id: data.locationId ?? null,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const checkStockAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    locationId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<number> => {
    const sb = context.supabase as any;
    const { data: bal, error } = await sb.rpc("so_check_stock", {
      _item_id: data.itemId,
      _location_id: data.locationId,
    });
    if (error) throw new Error(error.message);
    return Number(bal ?? 0);
  });

export const listStockLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockLocationLite[]> => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("stock_locations")
      .select("id,name")
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listStockableProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().trim().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<StockableProduct[]> => {
    const sb = context.supabase as any;
    let q = sb.from("items")
      .select("id,name,sku,unit")
      .eq("item_type", "PRODUCT")
      .eq("controls_stock", true)
      .eq("active", true)
      .order("name")
      .limit(30);
    if (data.search) {
      q = q.ilike("name", `%${data.search}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
