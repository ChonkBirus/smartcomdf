import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filtersSchema = z.object({
  from: z.string().datetime().nullable().optional(),
  to: z.string().datetime().nullable().optional(),
}).default({});

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa associada ao usuário.");
  return data.company_id as string;
}

async function countWith(sb: any, table: string, companyId: string, build?: (q: any) => any) {
  let q = sb.from(table).select("*", { count: "exact", head: true }).eq("company_id", companyId);
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function sumAmount(sb: any, companyId: string, build?: (q: any) => any) {
  let q = sb.from("quotes").select("total_amount").eq("company_id", companyId);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw new Error(`quotes sum: ${error.message}`);
  return (data ?? []).reduce((acc: number, r: any) => acc + Number(r.total_amount ?? 0), 0);
}

export const getReportsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const companyId = await getCompanyId(sb, context.userId);

    const fromIso = data.from ?? null;
    const toIso = data.to ?? null;
    const range = (col: string) => (q: any) => {
      let r = q;
      if (fromIso) r = r.gte(col, fromIso);
      if (toIso) r = r.lte(col, toIso);
      return r;
    };

    const [
      quotesTotal,
      quotesApproved,
      quotesPending,
      quotesExpired,
      customersTotal,
      projectsActive,
      osOpen,
      osDone,
      lowStockItems,
      pendingPayments,
      valueOrcadoRows,
      valueAprovadoRows,
    ] = await Promise.all([
      countWith(sb, "quotes", companyId, range("created_at")),
      countWith(sb, "quotes", companyId, (q) => range("created_at")(q).eq("status", "approved")),
      countWith(sb, "quotes", companyId, (q) => range("created_at")(q).in("status", ["sent", "viewed", "draft"])),
      countWith(sb, "quotes", companyId, (q) => range("created_at")(q).eq("status", "expired")),
      countWith(sb, "customers", companyId, (q) => q.eq("active", true).is("deleted_at", null)),
      countWith(sb, "projects", companyId, (q) => q.in("status", ["planning", "in_progress", "ready_for_os"]).is("deleted_at", null)),
      countWith(sb, "service_orders", companyId, (q) => q.in("status", ["scheduled", "in_progress", "paused"]).is("deleted_at", null)),
      countWith(sb, "service_orders", companyId, (q) => range("completed_at")(q).eq("status", "completed")),
      0,
      countWith(sb, "quote_payments", companyId, (q) => q.eq("payment_status", "pending")),
      sumAmount(sb, companyId, range("created_at")),
      sumAmount(sb, companyId, (q) => range("created_at")(q).eq("status", "approved")),
    ]);

    // Low stock (items.minimum_stock vs stock_balances.quantity) - lightweight
    let lowStock = 0;
    try {
      const { data: items } = await sb
        .from("items")
        .select("id, minimum_stock")
        .eq("company_id", companyId)
        .eq("active", true)
        .eq("controls_stock", true)
        .is("deleted_at", null)
        .gt("minimum_stock", 0)
        .limit(1000);
      if (items && items.length) {
        const ids = items.map((i: any) => i.id);
        const { data: balances } = await sb
          .from("stock_balances")
          .select("item_id, quantity")
          .eq("company_id", companyId)
          .in("item_id", ids);
        const byItem = new Map<string, number>();
        (balances ?? []).forEach((b: any) => {
          byItem.set(b.item_id, (byItem.get(b.item_id) ?? 0) + Number(b.quantity ?? 0));
        });
        lowStock = items.filter((it: any) => (byItem.get(it.id) ?? 0) <= Number(it.minimum_stock ?? 0)).length;
      }
    } catch {
      lowStock = 0;
    }
    void lowStockItems;

    const conversionRate = quotesTotal > 0 ? (quotesApproved / quotesTotal) * 100 : 0;

    // Quotes by status chart
    const { data: byStatusRows } = await sb
      .from("quotes")
      .select("status")
      .eq("company_id", companyId)
      .gte("created_at", fromIso ?? "1970-01-01")
      .lte("created_at", toIso ?? new Date().toISOString())
      .limit(5000);
    const byStatus: Record<string, number> = {};
    (byStatusRows ?? []).forEach((r: any) => {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    });

    return {
      cards: {
        quotesTotal,
        quotesApproved,
        quotesPending,
        quotesExpired,
        conversionRate,
        valueOrcado: valueOrcadoRows,
        valueAprovado: valueAprovadoRows,
        customersTotal,
        projectsActive,
        osOpen,
        osDone,
        lowStock,
        pendingPayments,
      },
      charts: {
        quotesByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      },
    };
  });
