import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MovementType = "ENTRY" | "EXIT" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT";

export type StockLocation = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type StockBalanceRow = {
  item_id: string;
  location_id: string;
  quantity: number;
  item_name: string;
  item_sku: string | null;
  unit: string;
  minimum_stock: number | null;
  location_name: string;
  status: "OUT" | "LOW" | "OK";
};

export type StockMovementRow = {
  id: string;
  created_at: string;
  movement_type: MovementType;
  quantity: number;
  previous_balance: number;
  new_balance: number;
  reason: string | null;
  notes: string | null;
  item_id: string;
  item_name: string;
  item_sku: string | null;
  location_id: string;
  location_name: string;
  user_name: string | null;
};

// ============================================================
// LOCATIONS
// ============================================================
export const listLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data, error } = await sb
      .from("stock_locations")
      .select("id, name, description, active, created_at")
      .eq("company_id", prof.company_id)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as StockLocation[];
  });

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const saveLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => locationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sem empresa.");
    const payload = {
      name: data.name,
      description: data.description || null,
      active: data.active,
      company_id: profile.company_id,
    };
    if (data.id) {
      const { error } = await sb.from("stock_locations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await sb.rpc("log_audit", { _module: "stock_locations", _action: "update", _record_id: data.id, _new_data: payload });
      return { id: data.id };
    }
    const { data: row, error } = await sb.from("stock_locations").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await sb.rpc("log_audit", { _module: "stock_locations", _action: "create", _record_id: row.id, _new_data: payload });
    return { id: row.id as string };
  });

export const toggleLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("stock_locations").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ITEMS (stock-eligible)
// ============================================================
export const listStockItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const { data, error } = await sb
      .from("items")
      .select("id, name, sku, unit, minimum_stock")
      .eq("company_id", prof.company_id)
      .eq("controls_stock", true)
      .eq("item_type", "PRODUCT")
      .is("deleted_at", null)
      .eq("active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; name: string; sku: string | null; unit: string; minimum_stock: number | null }[];
  });

// ============================================================
// BALANCES
// ============================================================
export const listBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ location_id: z.string().uuid().optional(), search: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const cid = prof.company_id;
    // Get all stock-eligible items
    const { data: items, error: ierr } = await sb
      .from("items")
      .select("id, name, sku, unit, minimum_stock")
      .eq("company_id", cid)
      .eq("controls_stock", true)
      .eq("item_type", "PRODUCT")
      .is("deleted_at", null);
    if (ierr) throw new Error(ierr.message);

    const { data: locs, error: lerr } = await sb.from("stock_locations").select("id, name").eq("company_id", cid).eq("active", true);
    if (lerr) throw new Error(lerr.message);

    let balQ = sb.from("stock_balances").select("item_id, location_id, quantity").eq("company_id", cid);
    if (data.location_id) balQ = balQ.eq("location_id", data.location_id);
    const { data: bals, error: berr } = await balQ;
    if (berr) throw new Error(berr.message);

    const balMap = new Map<string, number>();
    for (const b of bals ?? []) balMap.set(`${b.item_id}:${b.location_id}`, Number(b.quantity));

    const search = (data.search || "").trim().toLowerCase();
    const out: StockBalanceRow[] = [];
    for (const it of items ?? []) {
      if (search && !it.name.toLowerCase().includes(search) && !(it.sku || "").toLowerCase().includes(search)) continue;
      const locList = data.location_id ? (locs || []).filter((l: any) => l.id === data.location_id) : locs || [];
      for (const loc of locList) {
        const qty = balMap.get(`${it.id}:${loc.id}`) ?? 0;
        const min = Number(it.minimum_stock || 0);
        const status: StockBalanceRow["status"] = qty <= 0 ? "OUT" : min > 0 && qty <= min ? "LOW" : "OK";
        out.push({
          item_id: it.id, location_id: loc.id, quantity: qty,
          item_name: it.name, item_sku: it.sku, unit: it.unit, minimum_stock: it.minimum_stock,
          location_name: loc.name, status,
        });
      }
    }
    out.sort((a, b) => a.item_name.localeCompare(b.item_name) || a.location_name.localeCompare(b.location_name));
    return out;
  });

// ============================================================
// MOVEMENTS
// ============================================================
const movementFilter = z.object({
  item_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  movement_type: z.enum(["ENTRY","EXIT","ADJUSTMENT","TRANSFER_IN","TRANSFER_OUT"]).optional(),
  user_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(500).default(100),
});

export const listMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => movementFilter.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    let q = sb.from("stock_movements")
      .select(`
        id, created_at, movement_type, quantity, previous_balance, new_balance, reason, notes,
        item_id, location_id, user_id,
        items:item_id(name, sku),
        stock_locations:location_id(name),
        profiles:user_id(full_name, email)
      `)
      .eq("company_id", prof.company_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.item_id) q = q.eq("item_id", data.item_id);
    if (data.location_id) q = q.eq("location_id", data.location_id);
    if (data.movement_type) q = q.eq("movement_type", data.movement_type);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const search = (data.search || "").trim().toLowerCase();
    const mapped: StockMovementRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      movement_type: r.movement_type,
      quantity: Number(r.quantity),
      previous_balance: Number(r.previous_balance),
      new_balance: Number(r.new_balance),
      reason: r.reason,
      notes: r.notes,
      item_id: r.item_id,
      item_name: r.items?.name ?? "—",
      item_sku: r.items?.sku ?? null,
      location_id: r.location_id,
      location_name: r.stock_locations?.name ?? "—",
      user_name: r.profiles?.full_name ?? r.profiles?.email ?? null,
    }));
    if (!search) return mapped;
    return mapped.filter((m) => m.item_name.toLowerCase().includes(search) || (m.item_sku || "").toLowerCase().includes(search));
  });

const moveSchema = z.object({
  item_id: z.string().uuid(),
  location_id: z.string().uuid(),
  movement_type: z.enum(["ENTRY","EXIT","ADJUSTMENT"]),
  quantity: z.number().positive().optional(),
  final_quantity: z.number().min(0).optional(),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => moveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: mid, error } = await sb.rpc("apply_stock_movement", {
      _item_id: data.item_id,
      _location_id: data.location_id,
      _movement_type: data.movement_type,
      _quantity: data.movement_type === "ADJUSTMENT" ? 0.001 : (data.quantity ?? 0),
      _reason: data.reason || null,
      _notes: data.notes || null,
      _related_movement_id: null,
      _final_quantity: data.movement_type === "ADJUSTMENT" ? (data.final_quantity ?? null) : null,
    });
    if (error) throw new Error(error.message);
    return { id: mid as string };
  });

const transferSchema = z.object({
  item_id: z.string().uuid(),
  from_location: z.string().uuid(),
  to_location: z.string().uuid(),
  quantity: z.number().positive(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const transferStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => transferSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: res, error } = await sb.rpc("transfer_stock", {
      _item_id: data.item_id,
      _from_location: data.from_location,
      _to_location: data.to_location,
      _quantity: data.quantity,
      _notes: data.notes || null,
    });
    if (error) throw new Error(error.message);
    return res;
  });

// ============================================================
// DASHBOARD
// ============================================================
export const stockOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: prof } = await sb.from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
    if (!prof?.company_id) throw new Error("Sem empresa.");
    const cid = prof.company_id;
    const { data: items } = await sb
      .from("items").select("id, minimum_stock")
      .eq("company_id", cid)
      .eq("controls_stock", true).eq("item_type", "PRODUCT").is("deleted_at", null);
    const { data: bals } = await sb.from("stock_balances").select("item_id, quantity").eq("company_id", cid);
    const totalByItem = new Map<string, number>();
    for (const b of bals ?? []) totalByItem.set(b.item_id, (totalByItem.get(b.item_id) ?? 0) + Number(b.quantity));
    let out = 0, low = 0;
    for (const it of items ?? []) {
      const q = totalByItem.get(it.id) ?? 0;
      const min = Number(it.minimum_stock || 0);
      if (q <= 0) out++;
      else if (min > 0 && q <= min) low++;
    }
    const { data: recent } = await sb
      .from("stock_movements")
      .select("id, created_at, movement_type, quantity, items:item_id(name)")
      .eq("company_id", cid)
      .order("created_at", { ascending: false }).limit(5);
    return {
      outOfStock: out,
      lowStock: low,
      recent: (recent ?? []).map((r: any) => ({
        id: r.id, created_at: r.created_at, movement_type: r.movement_type as MovementType,
        quantity: Number(r.quantity), item_name: r.items?.name ?? "—",
      })),
    };
  });
