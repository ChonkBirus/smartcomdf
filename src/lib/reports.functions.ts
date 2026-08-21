import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- shared types & helpers ----------

const filtersSchema = z
  .object({
    from: z.string().datetime().nullable().optional(),
    to: z.string().datetime().nullable().optional(),
  })
  .default({});

const reportSchema = z.object({
  type: z.enum([
    "overview",
    "commercial",
    "quotes",
    "projects",
    "service_orders",
    "stock",
    "customers",
    "financial",
    "technicians",
  ]),
  filters: filtersSchema.optional(),
});

export type ReportType = z.infer<typeof reportSchema>["type"];
export type ReportKpi = { label: string; value: string | number; hint?: string };
export type ReportRow = Record<string, string | number | null>;
export type ReportColumn = {
  key: string;
  label: string;
  format?: "currency" | "date" | "datetime" | "number";
};
export type ReportResult = {
  kpis: ReportKpi[];
  columns: ReportColumn[];
  rows: ReportRow[];
};

async function getCompanyId(sb: any, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!data?.company_id) throw new Error("Sem empresa associada.");
  return data.company_id as string;
}

async function hasPerm(sb: any, userId: string, slug: string): Promise<boolean> {
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const roleSlugs = (roles ?? []).map((r: any) => r.role);
  if (roleSlugs.includes("super_admin") || roleSlugs.includes("owner")) return true;
  const { data: rows } = await sb
    .from("role_permissions")
    .select("permissions!inner(slug), roles!inner(slug)")
    .eq("permissions.slug", slug)
    .in("roles.slug", roleSlugs.length ? roleSlugs : ["__none__"]);
  return !!(rows && rows.length);
}

function range(col: string, from: string | null, to: string | null) {
  return (q: any) => {
    let r = q;
    if (from) r = r.gte(col, from);
    if (to) r = r.lte(col, to);
    return r;
  };
}

async function count(sb: any, table: string, companyId: string, build?: (q: any) => any) {
  let q = sb.from(table).select("*", { count: "exact", head: true }).eq("company_id", companyId);
  if (build) q = build(q);
  const { count: c } = await q;
  return c ?? 0;
}

async function sumCol(
  sb: any,
  table: string,
  col: string,
  companyId: string,
  build?: (q: any) => any,
) {
  let q = sb.from(table).select(col).eq("company_id", companyId);
  if (build) q = build(q);
  const { data } = await q;
  return (data ?? []).reduce((acc: number, r: any) => acc + Number(r[col] ?? 0), 0);
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// ---------- overview (kept for previous consumer) ----------

export const getReportsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const companyId = await getCompanyId(sb, context.userId);
    const r = range("created_at", data.from ?? null, data.to ?? null);

    const [
      quotesTotal,
      quotesApproved,
      quotesPending,
      quotesExpired,
      customersTotal,
      projectsActive,
      osOpen,
      osDone,
      pendingPayments,
      valueOrcado,
      valueAprovado,
    ] = await Promise.all([
      count(sb, "quotes", companyId, r),
      count(sb, "quotes", companyId, (q) => r(q).eq("status", "approved")),
      count(sb, "quotes", companyId, (q) => r(q).in("status", ["sent", "viewed", "draft"])),
      count(sb, "quotes", companyId, (q) => r(q).eq("status", "expired")),
      count(sb, "customers", companyId, (q) => q.eq("active", true).is("deleted_at", null)),
      count(sb, "projects", companyId, (q) =>
        q.in("status", ["planning", "in_progress", "ready_for_os"]).is("deleted_at", null),
      ),
      count(sb, "service_orders", companyId, (q) =>
        q.in("status", ["scheduled", "in_progress", "paused"]).is("deleted_at", null),
      ),
      count(sb, "service_orders", companyId, (q) =>
        range("completed_at", data.from ?? null, data.to ?? null)(q).eq("status", "completed"),
      ),
      count(sb, "quote_payments", companyId, (q) => q.eq("payment_status", "pending")),
      sumCol(sb, "quotes", "total_amount", companyId, r),
      sumCol(sb, "quotes", "total_amount", companyId, (q) => r(q).eq("status", "approved")),
    ]);

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
      if (items?.length) {
        const ids = items.map((i: any) => i.id);
        const { data: balances } = await sb
          .from("stock_balances")
          .select("item_id, quantity")
          .eq("company_id", companyId)
          .in("item_id", ids);
        const byItem = new Map<string, number>();
        (balances ?? []).forEach((b: any) =>
          byItem.set(b.item_id, (byItem.get(b.item_id) ?? 0) + Number(b.quantity ?? 0)),
        );
        lowStock = items.filter(
          (it: any) => (byItem.get(it.id) ?? 0) <= Number(it.minimum_stock ?? 0),
        ).length;
      }
    } catch {
      /* ignore */
    }

    const { data: byStatusRows } = await sb
      .from("quotes")
      .select("status")
      .eq("company_id", companyId)
      .gte("created_at", data.from ?? "1970-01-01")
      .lte("created_at", data.to ?? new Date().toISOString())
      .limit(5000);
    const byStatus: Record<string, number> = {};
    (byStatusRows ?? []).forEach((row: any) => {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    });

    const conversionRate = quotesTotal > 0 ? (quotesApproved / quotesTotal) * 100 : 0;
    return {
      cards: {
        quotesTotal,
        quotesApproved,
        quotesPending,
        quotesExpired,
        conversionRate,
        valueOrcado,
        valueAprovado,
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

// ---------- generic report ----------

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportSchema.parse(d))
  .handler(async ({ data, context }): Promise<ReportResult> => {
    const sb = context.supabase;
    const companyId = await getCompanyId(sb, context.userId);
    const from = data.filters?.from ?? null;
    const to = data.filters?.to ?? null;
    const r = range("created_at", from, to);

    switch (data.type) {
      case "commercial": {
        const [criados, enviados, aprovados, recusados, valorEnviado, valorAprovado] =
          await Promise.all([
            count(sb, "quotes", companyId, r),
            count(sb, "quotes", companyId, (q) =>
              r(q).in("status", ["sent", "viewed", "approved", "rejected", "expired"]),
            ),
            count(sb, "quotes", companyId, (q) => r(q).eq("status", "approved")),
            count(sb, "quotes", companyId, (q) => r(q).eq("status", "rejected")),
            sumCol(sb, "quotes", "total_amount", companyId, (q) =>
              r(q).in("status", ["sent", "viewed", "approved", "rejected", "expired"]),
            ),
            sumCol(sb, "quotes", "total_amount", companyId, (q) => r(q).eq("status", "approved")),
          ]);
        const ticket = aprovados > 0 ? valorAprovado / aprovados : 0;
        const taxa = enviados > 0 ? (aprovados / enviados) * 100 : 0;

        const { data: rows } = await sb
          .from("quotes")
          .select(
            "id, quote_number, status, total_amount, issue_date, valid_until, accepted_at, customer:customers(name)",
          )
          .eq("company_id", companyId)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(500);

        return {
          kpis: [
            { label: "Criados", value: criados },
            { label: "Enviados", value: enviados },
            { label: "Aprovados", value: aprovados },
            { label: "Recusados", value: recusados },
            { label: "Taxa de aceite", value: `${taxa.toFixed(1)}%` },
            { label: "Valor enviado", value: brl(valorEnviado) },
            { label: "Valor aprovado", value: brl(valorAprovado) },
            { label: "Ticket médio aprovado", value: brl(ticket) },
          ],
          columns: [
            { key: "quote_number", label: "Número" },
            { key: "customer", label: "Cliente" },
            { key: "status", label: "Status" },
            { key: "total_amount", label: "Valor", format: "currency" },
            { key: "issue_date", label: "Emissão", format: "date" },
            { key: "valid_until", label: "Validade", format: "date" },
            { key: "accepted_at", label: "Aceite", format: "datetime" },
          ],
          rows: (rows ?? []).map((q: any) => ({
            quote_number: q.quote_number,
            customer: q.customer?.name ?? "—",
            status: q.status,
            total_amount: Number(q.total_amount ?? 0),
            issue_date: q.issue_date,
            valid_until: q.valid_until,
            accepted_at: q.accepted_at,
          })),
        };
      }

      case "quotes": {
        const [criados, enviados, aprovados, vencidos, convertidos] = await Promise.all([
          count(sb, "quotes", companyId, r),
          count(sb, "quotes", companyId, (q) => r(q).in("status", ["sent", "viewed"])),
          count(sb, "quotes", companyId, (q) => r(q).eq("status", "approved")),
          count(sb, "quotes", companyId, (q) => r(q).eq("status", "expired")),
          count(sb, "quotes", companyId, (q) => r(q).not("converted_at", "is", null)),
        ]);
        const { data: rows } = await sb
          .from("quotes")
          .select(
            "id, quote_number, status, payment_status, total_amount, created_at, valid_until, customer:customers(name)",
          )
          .eq("company_id", companyId)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(500);
        return {
          kpis: [
            { label: "Criados", value: criados },
            { label: "Enviados", value: enviados },
            { label: "Aprovados", value: aprovados },
            { label: "Vencidos", value: vencidos },
            { label: "Convertidos em projeto", value: convertidos },
          ],
          columns: [
            { key: "quote_number", label: "Orçamento" },
            { key: "customer", label: "Cliente" },
            { key: "status", label: "Status" },
            { key: "payment_status", label: "Financeiro" },
            { key: "total_amount", label: "Valor", format: "currency" },
            { key: "created_at", label: "Criado em", format: "date" },
            { key: "valid_until", label: "Validade", format: "date" },
          ],
          rows: (rows ?? []).map((q: any) => ({
            quote_number: q.quote_number,
            customer: q.customer?.name ?? "—",
            status: q.status,
            payment_status: q.payment_status ?? "—",
            total_amount: Number(q.total_amount ?? 0),
            created_at: q.created_at,
            valid_until: q.valid_until,
          })),
        };
      }

      case "projects": {
        const [criados, planejamento, prontos, execucao, concluidos] = await Promise.all([
          count(sb, "projects", companyId, r),
          count(sb, "projects", companyId, (q) =>
            r(q).eq("status", "planning").is("deleted_at", null),
          ),
          count(sb, "projects", companyId, (q) =>
            r(q).eq("status", "ready_for_os").is("deleted_at", null),
          ),
          count(sb, "projects", companyId, (q) =>
            r(q).eq("status", "in_progress").is("deleted_at", null),
          ),
          count(sb, "projects", companyId, (q) =>
            r(q).eq("status", "completed").is("deleted_at", null),
          ),
        ]);
        const { data: rows } = await sb
          .from("projects")
          .select(
            "id, project_number, title, status, total_amount, planned_start_date, planned_end_date, completed_at, customer:customers(name), quote:quotes(quote_number)",
          )
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(500);
        return {
          kpis: [
            { label: "Criados", value: criados },
            { label: "Planejamento", value: planejamento },
            { label: "Prontos p/ OS", value: prontos },
            { label: "Em execução", value: execucao },
            { label: "Concluídos", value: concluidos },
          ],
          columns: [
            { key: "project_number", label: "Projeto" },
            { key: "customer", label: "Cliente" },
            { key: "quote", label: "Orçamento" },
            { key: "status", label: "Status" },
            { key: "total_amount", label: "Valor", format: "currency" },
            { key: "planned_start_date", label: "Início previsto", format: "date" },
            { key: "completed_at", label: "Concluído em", format: "datetime" },
          ],
          rows: (rows ?? []).map((p: any) => ({
            project_number: p.project_number,
            customer: p.customer?.name ?? "—",
            quote: p.quote?.quote_number ?? "—",
            status: p.status,
            total_amount: Number(p.total_amount ?? 0),
            planned_start_date: p.planned_start_date,
            completed_at: p.completed_at,
          })),
        };
      }

      case "service_orders": {
        const [
          criadas,
          agendadas,
          andamento,
          pausadas,
          concluidas,
          canceladas,
          comRelatorio,
          comAssinatura,
        ] = await Promise.all([
          count(sb, "service_orders", companyId, r),
          count(sb, "service_orders", companyId, (q) => r(q).eq("status", "scheduled")),
          count(sb, "service_orders", companyId, (q) => r(q).eq("status", "in_progress")),
          count(sb, "service_orders", companyId, (q) => r(q).eq("status", "paused")),
          count(sb, "service_orders", companyId, (q) => r(q).eq("status", "completed")),
          count(sb, "service_orders", companyId, (q) => r(q).eq("status", "cancelled")),
          count(sb, "service_orders", companyId, (q) =>
            q.not("final_report_generated_at", "is", null),
          ),
          count(sb, "service_orders", companyId, (q) => q.not("customer_signed_at", "is", null)),
        ]);

        const { data: rows } = await sb
          .from("service_orders")
          .select(
            "id, service_order_number, status, scheduled_date, started_at, completed_at, customer:customers(name), project:projects(project_number), technician:profiles!service_orders_assigned_technician_id_fkey(full_name)",
          )
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(500);
        return {
          kpis: [
            { label: "Criadas", value: criadas },
            { label: "Agendadas", value: agendadas },
            { label: "Em andamento", value: andamento },
            { label: "Pausadas", value: pausadas },
            { label: "Concluídas", value: concluidas },
            { label: "Canceladas", value: canceladas },
            { label: "Com relatório final", value: comRelatorio },
            { label: "Com assinatura", value: comAssinatura },
          ],
          columns: [
            { key: "service_order_number", label: "OS" },
            { key: "customer", label: "Cliente" },
            { key: "project", label: "Projeto" },
            { key: "technician", label: "Técnico" },
            { key: "status", label: "Status" },
            { key: "scheduled_date", label: "Agendada", format: "date" },
            { key: "started_at", label: "Início", format: "datetime" },
            { key: "completed_at", label: "Fim", format: "datetime" },
          ],
          rows: (rows ?? []).map((o: any) => ({
            service_order_number: o.service_order_number,
            customer: o.customer?.name ?? "—",
            project: o.project?.project_number ?? "—",
            technician: o.technician?.full_name ?? "—",
            status: o.status,
            scheduled_date: o.scheduled_date,
            started_at: o.started_at,
            completed_at: o.completed_at,
          })),
        };
      }

      case "stock": {
        const canFinancial = await hasPerm(sb, context.userId, "reports.financial");
        const { data: items } = await sb
          .from("items")
          .select(
            "id, name, sku, minimum_stock, cost_price, sale_price, controls_stock, active, category:categories(name)",
          )
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .eq("active", true)
          .limit(2000);
        const ids = (items ?? []).map((i: any) => i.id);
        const { data: balances } = ids.length
          ? await sb
              .from("stock_balances")
              .select("item_id, quantity")
              .eq("company_id", companyId)
              .in("item_id", ids)
          : { data: [] };
        const byItem = new Map<string, number>();
        (balances ?? []).forEach((b: any) => {
          byItem.set(b.item_id, (byItem.get(b.item_id) ?? 0) + Number(b.quantity ?? 0));
        });

        const [entradas, saidas] = await Promise.all([
          count(sb, "stock_movements", companyId, (q) => r(q).eq("movement_type", "in")),
          count(sb, "stock_movements", companyId, (q) => r(q).eq("movement_type", "out")),
        ]);

        const rows = (items ?? [])
          .filter((it: any) => it.controls_stock !== false)
          .map((it: any) => {
            const saldo = byItem.get(it.id) ?? 0;
            const min = Number(it.minimum_stock ?? 0);
            const status =
              saldo <= 0 ? "SEM_ESTOQUE" : saldo <= min && min > 0 ? "ESTOQUE_BAIXO" : "NORMAL";
            const row: ReportRow = {
              name: it.name,
              sku: it.sku ?? "—",
              category: it.category?.name ?? "—",
              saldo,
              minimum_stock: min,
              status,
            };
            if (canFinancial) {
              row.cost_price = Number(it.cost_price ?? 0);
              row.estimated_value = Number(it.cost_price ?? 0) * saldo;
            }
            return row;
          });

        const baixo = rows.filter(
          (r) => r.status === "ESTOQUE_BAIXO" || r.status === "SEM_ESTOQUE",
        ).length;
        const valorEstoque = canFinancial
          ? rows.reduce((acc, row) => acc + Number(row.estimated_value ?? 0), 0)
          : 0;

        const kpis: ReportKpi[] = [
          { label: "Produtos", value: rows.length },
          { label: "Estoque baixo/zerado", value: baixo },
          { label: "Entradas no período", value: entradas },
          { label: "Saídas no período", value: saidas },
        ];
        if (canFinancial) kpis.push({ label: "Valor estimado", value: brl(valorEstoque) });

        const columns: ReportColumn[] = [
          { key: "name", label: "Produto" },
          { key: "sku", label: "SKU" },
          { key: "category", label: "Categoria" },
          { key: "saldo", label: "Saldo", format: "number" },
          { key: "minimum_stock", label: "Mínimo", format: "number" },
          { key: "status", label: "Status" },
        ];
        if (canFinancial) {
          columns.push({ key: "cost_price", label: "Custo", format: "currency" });
          columns.push({ key: "estimated_value", label: "Valor estimado", format: "currency" });
        }
        return { kpis, columns, rows };
      }

      case "customers": {
        const [total, pf, pj, ativos] = await Promise.all([
          count(sb, "customers", companyId, (q) => q.is("deleted_at", null)),
          count(sb, "customers", companyId, (q) =>
            q.is("deleted_at", null).eq("customer_type", "PF"),
          ),
          count(sb, "customers", companyId, (q) =>
            q.is("deleted_at", null).eq("customer_type", "PJ"),
          ),
          count(sb, "customers", companyId, (q) => q.is("deleted_at", null).eq("active", true)),
        ]);
        const { data: customers } = await sb
          .from("customers")
          .select("id, name, customer_type, phone, email, active, created_at")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500);
        const ids = (customers ?? []).map((c: any) => c.id);
        const { data: quotes } = ids.length
          ? await sb
              .from("quotes")
              .select("customer_id, status, total_amount")
              .eq("company_id", companyId)
              .in("customer_id", ids)
          : { data: [] };
        const stats = new Map<string, { qtd: number; aprovado: number }>();
        (quotes ?? []).forEach((q: any) => {
          const s = stats.get(q.customer_id) ?? { qtd: 0, aprovado: 0 };
          s.qtd += 1;
          if (q.status === "approved") s.aprovado += Number(q.total_amount ?? 0);
          stats.set(q.customer_id, s);
        });

        return {
          kpis: [
            { label: "Total", value: total },
            { label: "Pessoa Física", value: pf },
            { label: "Pessoa Jurídica", value: pj },
            { label: "Ativos", value: ativos },
          ],
          columns: [
            { key: "name", label: "Cliente" },
            { key: "customer_type", label: "Tipo" },
            { key: "phone", label: "Telefone" },
            { key: "email", label: "E-mail" },
            { key: "qtd_quotes", label: "Orçamentos", format: "number" },
            { key: "approved_value", label: "Aprovado", format: "currency" },
            { key: "status", label: "Status" },
          ],
          rows: (customers ?? []).map((c: any) => {
            const s = stats.get(c.id) ?? { qtd: 0, aprovado: 0 };
            return {
              name: c.name,
              customer_type: c.customer_type,
              phone: c.phone ?? "—",
              email: c.email ?? "—",
              qtd_quotes: s.qtd,
              approved_value: s.aprovado,
              status: c.active ? "ACTIVE" : "INACTIVE",
            };
          }),
        };
      }

      case "financial": {
        if (!(await hasPerm(sb, context.userId, "reports.financial"))) {
          throw new Error("Sem permissão para acessar relatório financeiro.");
        }
        const [valorAprovado, aguardando] = await Promise.all([
          sumCol(sb, "quotes", "total_amount", companyId, (q) => r(q).eq("status", "approved")),
          sumCol(sb, "quote_payments", "amount", companyId, (q) =>
            q.in("payment_status", ["pending", "WAITING_PAYMENT", "PENDING"]),
          ),
        ]);
        const { data: rows } = await sb
          .from("quote_payments")
          .select(
            "id, amount, payment_status, payment_method, due_date, paid_at, quote:quotes(quote_number, customer:customers(name))",
          )
          .eq("company_id", companyId)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(500);
        const aprovadosCount = (rows ?? []).filter(
          (p: any) => p.payment_status?.toUpperCase() === "PAID" || p.paid_at,
        ).length;
        return {
          kpis: [
            { label: "Valor aprovado", value: brl(valorAprovado) },
            { label: "Aguardando pagamento", value: brl(aguardando) },
            { label: "Pagamentos aprovados", value: aprovadosCount },
            { label: "Pagamentos pendentes", value: (rows ?? []).length - aprovadosCount },
          ],
          columns: [
            { key: "quote_number", label: "Orçamento" },
            { key: "customer", label: "Cliente" },
            { key: "amount", label: "Valor", format: "currency" },
            { key: "payment_method", label: "Forma" },
            { key: "payment_status", label: "Status" },
            { key: "due_date", label: "Vencimento", format: "date" },
            { key: "paid_at", label: "Pagamento", format: "datetime" },
          ],
          rows: (rows ?? []).map((p: any) => ({
            quote_number: p.quote?.quote_number ?? "—",
            customer: p.quote?.customer?.name ?? "—",
            amount: Number(p.amount ?? 0),
            payment_method: p.payment_method ?? "—",
            payment_status: p.payment_status,
            due_date: p.due_date,
            paid_at: p.paid_at,
          })),
        };
      }

      case "technicians": {
        const { data: rows } = await sb
          .from("service_orders")
          .select(
            "id, status, started_at, completed_at, assigned_technician_id, technician:profiles!service_orders_assigned_technician_id_fkey(full_name)",
          )
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .gte("created_at", from ?? "1970-01-01")
          .lte("created_at", to ?? new Date().toISOString())
          .limit(2000);
        const grouped = new Map<
          string,
          {
            name: string;
            atribuidas: number;
            concluidas: number;
            andamento: number;
            durTotalMs: number;
            durCount: number;
          }
        >();
        (rows ?? []).forEach((o: any) => {
          const id = o.assigned_technician_id ?? "—";
          const name = o.technician?.full_name ?? "Não atribuído";
          const g = grouped.get(id) ?? {
            name,
            atribuidas: 0,
            concluidas: 0,
            andamento: 0,
            durTotalMs: 0,
            durCount: 0,
          };
          g.atribuidas += 1;
          if (o.status === "completed") g.concluidas += 1;
          if (o.status === "in_progress") g.andamento += 1;
          if (o.started_at && o.completed_at) {
            g.durTotalMs += new Date(o.completed_at).getTime() - new Date(o.started_at).getTime();
            g.durCount += 1;
          }
          grouped.set(id, g);
        });
        const tableRows: ReportRow[] = Array.from(grouped.values()).map((g) => ({
          technician: g.name,
          atribuidas: g.atribuidas,
          concluidas: g.concluidas,
          andamento: g.andamento,
          tempo_medio_horas:
            g.durCount > 0 ? Number((g.durTotalMs / g.durCount / 3600000).toFixed(2)) : 0,
        }));
        const totalAtrib = tableRows.reduce((a, r) => a + Number(r.atribuidas ?? 0), 0);
        const totalConcl = tableRows.reduce((a, r) => a + Number(r.concluidas ?? 0), 0);
        return {
          kpis: [
            { label: "Técnicos envolvidos", value: tableRows.length },
            { label: "OS atribuídas", value: totalAtrib },
            { label: "OS concluídas", value: totalConcl },
          ],
          columns: [
            { key: "technician", label: "Técnico" },
            { key: "atribuidas", label: "Atribuídas", format: "number" },
            { key: "concluidas", label: "Concluídas", format: "number" },
            { key: "andamento", label: "Em andamento", format: "number" },
            { key: "tempo_medio_horas", label: "Tempo médio (h)", format: "number" },
          ],
          rows: tableRows,
        };
      }

      case "overview":
      default:
        return { kpis: [], columns: [], rows: [] };
    }
  });
