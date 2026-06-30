import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Types
// ============================================================
export type HealthStatus = "CRITICAL" | "ATTENTION" | "HEALTHY" | "VERY_HEALTHY" | "INSUFFICIENT_DATA";

export type HealthCriterion = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  status: "ok" | "warn" | "bad" | "na";
  detail: string;
};

export type HealthAlert = {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  explanation: string;
  recommendation: string;
  actionLink?: string;
  actionLabel?: string;
};

export type FinancialHealthResult = {
  score: number;
  maxScore: number;
  status: HealthStatus;
  statusLabel: string;
  statusPhrase: string;
  insufficientData: boolean;
  positives: string[];
  attentions: string[];
  criteria: HealthCriterion[];
  alerts: HealthAlert[];
  dataUsed: {
    period: { from: string; to: string };
    incomeTotal: number;
    expenseTotal: number;
    balance: number;
    receivablesOpen: number;
    payablesOpen: number;
    overdueReceivables: number;
    overdueReceivablesAmount: number;
    overduePayables: number;
    overduePayablesAmount: number;
    productsTotal: number;
    productsWithoutCost: number;
    underpricedProducts: number;
    uncategorizedTransactions: number;
    projected30dBalance: number;
    estimatedMarginRate: number | null;
    desiredMarginRate: number | null;
  };
};

// ============================================================
// Helpers
// ============================================================
async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

async function hasPerm(supabase: any, slug: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { _slug: slug });
  return !!data;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function classify(score: number, insufficient: boolean): { status: HealthStatus; label: string; phrase: string } {
  if (insufficient) {
    return {
      status: "INSUFFICIENT_DATA",
      label: "Dados insuficientes",
      phrase: "Ainda não há dados suficientes para uma análise confiável. Cadastre entradas, saídas, custos e produtos para melhorar a análise.",
    };
  }
  if (score < 40) return { status: "CRITICAL", label: "Crítico", phrase: "Seu financeiro precisa de atenção imediata." };
  if (score < 60) return { status: "ATTENTION", label: "Atenção", phrase: "Existem pontos que podem comprometer seu caixa." };
  if (score < 80) return { status: "HEALTHY", label: "Saudável", phrase: "Sua empresa está com bom equilíbrio financeiro." };
  return { status: "VERY_HEALTHY", label: "Muito saudável", phrase: "Sua empresa está com boa organização financeira." };
}

const FiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
}).default({});

// ============================================================
// Main: Financial Health
// ============================================================
export const getFinancialHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<FinancialHealthResult> => {
    const cid = await getCompanyId(context.supabase, context.userId);

    if (!(await hasPerm(context.supabase, "finance.health.view")) &&
        !(await hasPerm(context.supabase, "finance.view")) &&
        !(await hasPerm(context.supabase, "finance.manage"))) {
      throw new Error("Sem permissão para visualizar saúde financeira.");
    }
    const canViewCosts = (await hasPerm(context.supabase, "finance.view_costs")) ||
                         (await hasPerm(context.supabase, "finance.manage"));

    // ---------- Period ----------
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const defaultFrom = new Date(today); defaultFrom.setDate(today.getDate() - 30);
    const from = data.from ? new Date(data.from) : defaultFrom;
    const to = data.to ? new Date(data.to) : today;
    const next30 = new Date(today); next30.setDate(today.getDate() + 30);

    // ---------- Load financial transactions (scoped by RLS + company_id) ----------
    const { data: txRows, error: txErr } = await context.supabase
      .from("financial_transactions")
      .select("id,type,amount,status,due_date,paid_at,category_id")
      .eq("company_id", cid);
    if (txErr) throw txErr;
    const txs = (txRows ?? []).map((r: any) => ({
      type: r.type as "INCOME" | "EXPENSE",
      amount: Number(r.amount ?? 0),
      status: r.status as string,
      due: r.due_date ? new Date(r.due_date) : null,
      paid: r.paid_at ? new Date(r.paid_at) : null,
      category_id: r.category_id as string | null,
    }));

    let incomeTotal = 0, expenseTotal = 0;
    let overdueReceivables = 0, overdueReceivablesAmount = 0;
    let overduePayables = 0, overduePayablesAmount = 0;
    let receivablesOpen = 0, payablesOpen = 0;
    let uncategorizedTransactions = 0;
    let projectedIn = 0, projectedOut = 0;

    for (const t of txs) {
      if (t.status === "CANCELED") continue;
      const refDate = t.paid ?? t.due;
      const inPeriod = !!(refDate && refDate >= from && refDate <= to);

      if (t.status === "PAID" && inPeriod) {
        if (t.type === "INCOME") incomeTotal += t.amount;
        else expenseTotal += t.amount;
      }
      const isOverdue = t.status === "PLANNED" && t.due && t.due < today;
      const isOpen = t.status === "PLANNED" || t.status === "OVERDUE";

      if (t.type === "INCOME" && isOpen) {
        receivablesOpen += t.amount;
        if (isOverdue || t.status === "OVERDUE") {
          overdueReceivables += 1;
          overdueReceivablesAmount += t.amount;
        }
      }
      if (t.type === "EXPENSE" && isOpen) {
        payablesOpen += t.amount;
        if (isOverdue || t.status === "OVERDUE") {
          overduePayables += 1;
          overduePayablesAmount += t.amount;
        }
      }
      // Projection next 30d (planned only, not overdue past)
      if (t.status === "PLANNED" && t.due && t.due >= today && t.due <= next30) {
        if (t.type === "INCOME") projectedIn += t.amount;
        else projectedOut += t.amount;
      }
      if (!t.category_id) uncategorizedTransactions += 1;
    }

    const balance = incomeTotal - expenseTotal;
    const projected30dBalance = projectedIn - projectedOut;

    // ---------- Products ----------
    const { data: itemRows } = await context.supabase
      .from("items")
      .select("id,cost_price,sale_price,active")
      .eq("company_id", cid)
      .eq("active", true);
    const items = itemRows ?? [];
    const productsTotal = items.length;
    const productsWithoutCost = items.filter((i: any) => !i.cost_price || Number(i.cost_price) <= 0).length;

    // ---------- Cost settings + underpriced products (only if canViewCosts) ----------
    let desiredMarginRate: number | null = null;
    let estimatedMarginRate: number | null = null;
    let underpricedProducts = 0;

    if (canViewCosts) {
      const { data: cs } = await context.supabase
        .from("company_cost_settings")
        .select("default_tax_rate,default_card_fee_rate,default_commission_rate,default_warranty_reserve_rate,default_operational_cost_rate,default_fixed_cost_allocation_rate,default_desired_margin_rate")
        .eq("company_id", cid)
        .maybeSingle();

      if (cs) {
        const deductions =
          Number(cs.default_tax_rate ?? 0) +
          Number(cs.default_card_fee_rate ?? 0) +
          Number(cs.default_commission_rate ?? 0) +
          Number(cs.default_warranty_reserve_rate ?? 0) +
          Number(cs.default_operational_cost_rate ?? 0) +
          Number(cs.default_fixed_cost_allocation_rate ?? 0);
        desiredMarginRate = Number(cs.default_desired_margin_rate ?? 0);

        const dTotal = deductions + desiredMarginRate;
        for (const i of items as any[]) {
          const cost = Number(i.cost_price ?? 0);
          const sale = Number(i.sale_price ?? 0);
          if (cost > 0 && sale > 0 && dTotal > 0 && dTotal < 1) {
            const suggested = cost / (1 - dTotal);
            if (sale < suggested * 0.97) underpricedProducts += 1;
          }
        }
        // Crude estimated margin from period: (income - expense) / income
        if (incomeTotal > 0) estimatedMarginRate = balance / incomeTotal;
      }
    }

    // ---------- Score criteria ----------
    const criteria: HealthCriterion[] = [];

    // 1) Saldo do período (+20)
    if (incomeTotal === 0 && expenseTotal === 0) {
      criteria.push({ key: "balance", label: "Saldo do período", score: 0, maxScore: 20, status: "na", detail: "Sem entradas ou saídas pagas no período." });
    } else if (balance > 0) {
      criteria.push({ key: "balance", label: "Saldo do período", score: 20, maxScore: 20, status: "ok", detail: "Entradas maiores que saídas no período." });
    } else {
      criteria.push({ key: "balance", label: "Saldo do período", score: 0, maxScore: 20, status: "bad", detail: "Saídas iguais ou maiores que entradas no período." });
    }

    // 2) Contas vencidas (+15)
    if (overduePayables === 0) {
      criteria.push({ key: "overdue_payables", label: "Contas a pagar em dia", score: 15, maxScore: 15, status: "ok", detail: "Nenhuma conta a pagar vencida." });
    } else {
      const s = overduePayables <= 2 ? 8 : 0;
      criteria.push({ key: "overdue_payables", label: "Contas a pagar em dia", score: s, maxScore: 15, status: s ? "warn" : "bad", detail: `${overduePayables} conta(s) vencida(s).` });
    }

    // 3) Recebimentos atrasados (+15)
    if (overdueReceivables === 0) {
      criteria.push({ key: "overdue_receivables", label: "Recebimentos em dia", score: 15, maxScore: 15, status: "ok", detail: "Nenhum recebimento atrasado." });
    } else {
      const s = overdueReceivables <= 2 ? 8 : 0;
      criteria.push({ key: "overdue_receivables", label: "Recebimentos em dia", score: s, maxScore: 15, status: s ? "warn" : "bad", detail: `${overdueReceivables} recebimento(s) atrasado(s).` });
    }

    // 4) Margem estimada (+15) — apenas se canViewCosts e dados existentes
    if (canViewCosts && desiredMarginRate !== null && estimatedMarginRate !== null) {
      if (estimatedMarginRate >= desiredMarginRate) {
        criteria.push({ key: "margin", label: "Margem estimada", score: 15, maxScore: 15, status: "ok", detail: `Margem estimada ${(estimatedMarginRate * 100).toFixed(1)}% ≥ meta ${(desiredMarginRate * 100).toFixed(1)}%.` });
      } else if (estimatedMarginRate >= desiredMarginRate * 0.7) {
        criteria.push({ key: "margin", label: "Margem estimada", score: 8, maxScore: 15, status: "warn", detail: `Margem estimada ${(estimatedMarginRate * 100).toFixed(1)}% abaixo da meta.` });
      } else {
        criteria.push({ key: "margin", label: "Margem estimada", score: 0, maxScore: 15, status: "bad", detail: `Margem estimada muito abaixo da meta.` });
      }
    } else {
      criteria.push({ key: "margin", label: "Margem estimada", score: 0, maxScore: 15, status: "na", detail: "Dados insuficientes para calcular margem." });
    }

    // 5) Produtos com custo cadastrado (+10)
    if (productsTotal === 0) {
      criteria.push({ key: "products_with_cost", label: "Produtos com custo", score: 0, maxScore: 10, status: "na", detail: "Nenhum produto cadastrado." });
    } else {
      const ratio = (productsTotal - productsWithoutCost) / productsTotal;
      const s = ratio >= 0.8 ? 10 : ratio >= 0.5 ? 5 : 0;
      criteria.push({ key: "products_with_cost", label: "Produtos com custo", score: s, maxScore: 10, status: s === 10 ? "ok" : s ? "warn" : "bad", detail: `${productsTotal - productsWithoutCost}/${productsTotal} com custo cadastrado.` });
    }

    // 6) Produtos abaixo do recomendado (+10)
    if (!canViewCosts) {
      criteria.push({ key: "underpriced", label: "Preços adequados", score: 0, maxScore: 10, status: "na", detail: "Sem permissão para avaliar custos." });
    } else if (productsTotal === 0) {
      criteria.push({ key: "underpriced", label: "Preços adequados", score: 0, maxScore: 10, status: "na", detail: "Sem produtos para avaliar." });
    } else if (underpricedProducts === 0) {
      criteria.push({ key: "underpriced", label: "Preços adequados", score: 10, maxScore: 10, status: "ok", detail: "Nenhum produto abaixo do preço sugerido." });
    } else {
      const s = underpricedProducts <= 3 ? 5 : 0;
      criteria.push({ key: "underpriced", label: "Preços adequados", score: s, maxScore: 10, status: s ? "warn" : "bad", detail: `${underpricedProducts} produto(s) abaixo do preço recomendado.` });
    }

    // 7) Fluxo projetado 30d (+10)
    if (projectedIn === 0 && projectedOut === 0) {
      criteria.push({ key: "projected", label: "Caixa próximos 30 dias", score: 0, maxScore: 10, status: "na", detail: "Sem lançamentos planejados para os próximos 30 dias." });
    } else if (projected30dBalance >= 0) {
      criteria.push({ key: "projected", label: "Caixa próximos 30 dias", score: 10, maxScore: 10, status: "ok", detail: "Saldo projetado positivo nos próximos 30 dias." });
    } else {
      criteria.push({ key: "projected", label: "Caixa próximos 30 dias", score: 0, maxScore: 10, status: "bad", detail: "Saídas previstas superam entradas nos próximos 30 dias." });
    }

    // 8) Lançamentos categorizados (+5)
    if (txs.length === 0) {
      criteria.push({ key: "categorized", label: "Lançamentos categorizados", score: 0, maxScore: 5, status: "na", detail: "Sem lançamentos." });
    } else {
      const ratio = (txs.length - uncategorizedTransactions) / txs.length;
      const s = ratio >= 0.8 ? 5 : ratio >= 0.5 ? 3 : 0;
      criteria.push({ key: "categorized", label: "Lançamentos categorizados", score: s, maxScore: 5, status: s === 5 ? "ok" : s ? "warn" : "bad", detail: `${txs.length - uncategorizedTransactions}/${txs.length} categorizados.` });
    }

    // ---------- Score & insufficient ----------
    const score = criteria.reduce((acc, c) => acc + c.score, 0);
    const naCount = criteria.filter((c) => c.status === "na").length;
    const insufficient = txs.length === 0 && productsTotal === 0;
    const { status, label, phrase } = classify(score, insufficient);

    // ---------- Positives & Attentions ----------
    const positives: string[] = [];
    const attentions: string[] = [];
    for (const c of criteria) {
      if (c.status === "ok") positives.push(c.detail);
      else if (c.status === "warn" || c.status === "bad") attentions.push(c.detail);
    }

    // ---------- Alerts ----------
    const alerts: HealthAlert[] = [];
    if (balance < 0 && (incomeTotal > 0 || expenseTotal > 0)) {
      alerts.push({
        id: "balance_negative", severity: "P1",
        title: "Saídas maiores que entradas",
        explanation: "No período selecionado, sua empresa registrou mais saídas do que entradas.",
        recommendation: "Revise despesas, antecipe recebimentos e verifique orçamentos aprovados ainda não recebidos.",
      });
    }
    if (overduePayables > 0) {
      alerts.push({
        id: "overdue_payables", severity: "P1",
        title: "Existem contas vencidas",
        explanation: `Há ${overduePayables} conta(s) a pagar vencida(s) totalizando ${overduePayablesAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        recommendation: "Regularize as contas vencidas e priorize despesas essenciais.",
        actionLink: "/finance", actionLabel: "Ver contas a pagar",
      });
    }
    if (overdueReceivables > 0) {
      alerts.push({
        id: "overdue_receivables", severity: "P1",
        title: "Recebimentos atrasados",
        explanation: `Existem ${overdueReceivables} recebimento(s) vencido(s) totalizando ${overdueReceivablesAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        recommendation: "Entre em contato com os clientes pendentes e atualize o status dos recebimentos.",
        actionLink: "/finance", actionLabel: "Ver contas a receber",
      });
    }
    if (productsTotal > 0 && productsWithoutCost > 0) {
      alerts.push({
        id: "products_without_cost", severity: "P2",
        title: "Produtos sem custo cadastrado",
        explanation: `${productsWithoutCost} produto(s) ativo(s) sem preço de custo. Sem o custo, não é possível calcular margem corretamente.`,
        recommendation: "Cadastre o custo dos produtos mais vendidos ou mais usados nos orçamentos.",
        actionLink: "/products", actionLabel: "Cadastrar custos",
      });
    }
    if (canViewCosts && underpricedProducts > 0) {
      alerts.push({
        id: "underpriced", severity: "P2",
        title: "Produtos abaixo do preço recomendado",
        explanation: `${underpricedProducts} produto(s) com preço de venda abaixo do ideal considerando seus custos e margem desejada.`,
        recommendation: "Revise os preços sugeridos pelo simulador de markup.",
        actionLink: "/finance/pricing/settings", actionLabel: "Revisar precificação",
      });
    }
    if (txs.length > 0 && uncategorizedTransactions > 0) {
      alerts.push({
        id: "uncategorized", severity: "P3",
        title: "Lançamentos sem categoria",
        explanation: `${uncategorizedTransactions} lançamento(s) sem categoria dificultam entender para onde o dinheiro está indo.`,
        recommendation: "Classifique seus lançamentos financeiros.",
        actionLink: "/finance", actionLabel: "Categorizar lançamentos",
      });
    }
    if (projected30dBalance < 0) {
      alerts.push({
        id: "projected_negative", severity: "P1",
        title: "Risco no caixa dos próximos 30 dias",
        explanation: "As saídas previstas podem superar as entradas previstas nos próximos 30 dias.",
        recommendation: "Reforce cobranças, revise despesas e acompanhe vencimentos próximos.",
      });
    }

    // Sort by severity P0 < P1 < P2 < P3
    const sevRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

    return {
      score,
      maxScore: 100,
      status,
      statusLabel: label,
      statusPhrase: phrase,
      insufficientData: insufficient || naCount >= 5,
      positives,
      attentions,
      criteria,
      alerts,
      dataUsed: {
        period: { from: isoDate(from), to: isoDate(to) },
        incomeTotal,
        expenseTotal,
        balance,
        receivablesOpen,
        payablesOpen,
        overdueReceivables,
        overdueReceivablesAmount,
        overduePayables,
        overduePayablesAmount,
        productsTotal,
        productsWithoutCost,
        underpricedProducts,
        uncategorizedTransactions,
        projected30dBalance,
        estimatedMarginRate,
        desiredMarginRate,
      },
    };
  });
