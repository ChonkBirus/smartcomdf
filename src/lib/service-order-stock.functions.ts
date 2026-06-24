import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StockDeductionLog = {
  id: string;
  service_order_id: string;
  item_id: string | null;
  stock_location_id: string | null;
  quantity: number;
  stock_movement_id: string | null;
  status: "DEDUCTED" | "BLOCKED" | "FAILED";
  error_message: string | null;
  created_at: string;
  item_name?: string | null;
  location_name?: string | null;
};

export type DeductStockResult = {
  status: "DEDUCTED" | "BLOCKED" | "NOT_APPLICABLE";
  total: number;
  deducted: number;
  blocked: number;
  failed: number;
  skipped: number;
};

export const listStockDeductionLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StockDeductionLog[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_stock_deduction_logs")
      .select(`*, item:item_id(name), location:stock_location_id(name)`)
      .eq("service_order_id", data.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      quantity: Number(r.quantity ?? 0),
      item_name: r.item?.name ?? null,
      location_name: r.location?.name ?? null,
    }));
  });

export const deductServiceOrderStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<DeductStockResult> => {
    const sb = context.supabase as any;
    const { data: result, error } = await sb.rpc("so_deduct_stock", { _so_id: data.id });
    if (error) throw new Error(error.message);
    return result as DeductStockResult;
  });
