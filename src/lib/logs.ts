/**
 * Helpers to write audit/activity logs and notifications from server functions.
 * They call the matching SECURITY DEFINER RPCs (log_audit, log_activity, notify_user)
 * which scope automatically to the caller's company.
 *
 * Usage inside a createServerFn handler:
 *
 *   import { logAudit } from "@/lib/logs";
 *   await logAudit(context.supabase, {
 *     module: "products", action: "create", recordId: newId, newData: data,
 *   });
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  args: {
    module: string;
    action: string;
    recordId?: string | null;
    oldData?: unknown;
    newData?: unknown;
  },
) {
  await supabase.rpc("log_audit", {
    _module: args.module,
    _action: args.action,
    _record_id: args.recordId ?? null,
    _old_data: (args.oldData ?? null) as never,
    _new_data: (args.newData ?? null) as never,
  });
}

export async function logActivity(supabase: SupabaseClient, description: string) {
  await supabase.rpc("log_activity", { _description: description });
}

export async function notifyUser(
  supabase: SupabaseClient,
  args: { userId: string; companyId: string; title: string; message?: string | null },
) {
  await supabase.rpc("notify_user", {
    _user_id: args.userId,
    _company_id: args.companyId,
    _title: args.title,
    _message: args.message ?? null,
  });
}
