import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExecutionLog = {
  id: string;
  service_order_id: string;
  user_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  user_name: string | null;
};

const ActionSchema = z.enum(["STARTED", "PAUSED", "RESUMED", "FINISHED_EXECUTION"]);

const TransitionInput = z.object({
  id: z.string().uuid(),
  action: ActionSchema,
  reason: z.string().trim().min(1).optional(),
  technicianReport: z.string().trim().min(1).optional(),
  issueFound: z.string().trim().optional(),
  solutionApplied: z.string().trim().optional(),
});

export const executeServiceOrderTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TransitionInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb.rpc("service_order_execute_transition", {
      _so_id: data.id,
      _action: data.action,
      _reason: data.reason ?? null,
      _technician_report: data.technicianReport ?? null,
      _issue_found: data.issueFound ?? null,
      _solution_applied: data.solutionApplied ?? null,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listServiceOrderExecutionLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ExecutionLog[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("service_order_execution_logs")
      .select(
        `
        id, service_order_id, user_id, action, previous_status, new_status,
        notes, metadata, created_at,
        user:user_id(full_name,email)
      `,
      )
      .eq("service_order_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      user_name: r.user?.full_name ?? r.user?.email ?? null,
    }));
  });
