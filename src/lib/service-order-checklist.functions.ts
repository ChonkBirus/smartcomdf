import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChecklistItem = {
  id: string;
  company_id: string;
  service_order_id: string;
  title: string;
  description: string | null;
  required: boolean;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  checked_by_name?: string | null;
};

export const listChecklistItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ChecklistItem[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_checklist_items")
      .select(`*, checked_by_profile:checked_by(full_name,email)`)
      .eq("service_order_id", data.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      checked_by_name: r.checked_by_profile?.full_name ?? r.checked_by_profile?.email ?? null,
    }));
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    itemId: z.string().uuid(),
    checked: z.boolean(),
    notes: z.string().trim().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.rpc("so_checklist_toggle", {
      _item_id: data.itemId,
      _checked: data.checked,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const addChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    serviceOrderId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
    required: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.rpc("so_checklist_add_item", {
      _so_id: data.serviceOrderId,
      _title: data.title,
      _description: data.description ?? null,
      _required: data.required,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listPendingRequiredChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ChecklistItem[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb.rpc("so_pending_required_checklist", { _so_id: data.id });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
