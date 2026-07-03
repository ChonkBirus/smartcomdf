import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_BASE = `Você é o SmartCom Finance IA, agente financeiro do SmartPro.

REGRAS OBRIGATÓRIAS:
- Você SÓ pode falar sobre os dados reais da empresa logada, fornecidos no bloco DADOS_DA_EMPRESA abaixo.
- Nunca invente números, clientes, transações, produtos, percentuais ou previsões. Se um dado não estiver no bloco DADOS_DA_EMPRESA, diga claramente "essa informação não está disponível na sua base atual".
- Nunca cite empresas fictícias, exemplos genéricos ou benchmarks de mercado como se fossem reais.
- Nunca diga que executou ações no sistema (não altera cadastros, não paga, não cobra). Apenas explique, interprete e recomende.
- Responda em português do Brasil, claro, objetivo, profissional, com formatação Markdown quando útil.
- Foque em: interpretação do score de saúde financeira, alertas, fluxo de caixa, inadimplência, margem, precificação e próximos passos práticos.
- Quando o usuário pedir algo fora de finanças, redirecione gentilmente ao escopo financeiro.`;

type Snapshot = {
  empresa: { id: string; nome: string | null };
  periodo: { de: string; ate: string };
  caixa_periodo: { entradas: number; saidas: number; saldo: number };
  contas_a_receber: { aberto_total: number; vencidas_qtd: number; vencidas_total: number };
  contas_a_pagar: { aberto_total: number; vencidas_qtd: number; vencidas_total: number };
  projecao_30d: { entradas: number; saidas: number; saldo: number };
  produtos: { total_ativos: number; sem_custo: number };
  saude: {
    score: number | null;
    status: string | null;
    pontos_positivos: string[];
    pontos_atencao: string[];
    alertas: Array<{ severidade: string; titulo: string; explicacao: string; recomendacao: string }>;
  } | null;
};

export const Route = createFileRoute("/api/finance-agent/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return new Response("Server misconfigured", { status: 500 });
        if (!LOVABLE_API_KEY) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.slice(7);

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claimsData.claims.sub;

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();
        const companyId = profile?.company_id;
        if (!companyId) return new Response("No company", { status: 403 });

        // Permission: finance.health.view OR finance.view OR finance.manage
        const checkPerm = async (slug: string) => {
          const { data } = await supabase.rpc("has_permission", { _slug: slug });
          return !!data;
        };
        const allowed =
          (await checkPerm("finance.health.view")) ||
          (await checkPerm("finance.view")) ||
          (await checkPerm("finance.manage"));
        if (!allowed) return new Response("Forbidden", { status: 403 });

        const body = (await request.json()) as { messages?: UIMessage[] };
        const messages = Array.isArray(body.messages) ? body.messages : [];

        // ---- Build real-data snapshot ----
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const from = new Date(today); from.setDate(today.getDate() - 30);
        const next30 = new Date(today); next30.setDate(today.getDate() + 30);
        const iso = (d: Date) => d.toISOString().slice(0, 10);

        const { data: company } = await supabase
          .from("companies").select("trade_name,corporate_name").eq("id", companyId).maybeSingle();
        const companyName = company?.trade_name ?? company?.corporate_name ?? null;

        const { data: txRows } = await supabase
          .from("financial_transactions")
          .select("type,amount,status,due_date,paid_at")
          .eq("company_id", companyId);

        let incomeTotal = 0, expenseTotal = 0;
        let recvOpen = 0, payOpen = 0;
        let recvOverdueQty = 0, recvOverdueAmt = 0;
        let payOverdueQty = 0, payOverdueAmt = 0;
        let projIn = 0, projOut = 0;
        for (const r of txRows ?? []) {
          const amount = Number((r as any).amount ?? 0);
          const status = (r as any).status as string;
          const type = (r as any).type as "INCOME" | "EXPENSE";
          const due = (r as any).due_date ? new Date((r as any).due_date) : null;
          const paid = (r as any).paid_at ? new Date((r as any).paid_at) : null;
          if (status === "CANCELED") continue;
          const ref = paid ?? due;
          if (status === "PAID" && ref && ref >= from && ref <= today) {
            if (type === "INCOME") incomeTotal += amount; else expenseTotal += amount;
          }
          const isOpen = status === "PLANNED" || status === "OVERDUE";
          const isOverdue = (status === "OVERDUE") || (status === "PLANNED" && due && due < today);
          if (type === "INCOME" && isOpen) {
            recvOpen += amount;
            if (isOverdue) { recvOverdueQty++; recvOverdueAmt += amount; }
          }
          if (type === "EXPENSE" && isOpen) {
            payOpen += amount;
            if (isOverdue) { payOverdueQty++; payOverdueAmt += amount; }
          }
          if (status === "PLANNED" && due && due >= today && due <= next30) {
            if (type === "INCOME") projIn += amount; else projOut += amount;
          }
        }

        const { data: itemRows } = await supabase
          .from("items")
          .select("id,cost_price")
          .eq("company_id", companyId)
          .eq("active", true);
        const productsTotal = (itemRows ?? []).length;
        const productsWithoutCost = (itemRows ?? []).filter(
          (i: any) => !i.cost_price || Number(i.cost_price) <= 0,
        ).length;

        // Optional: pull computed health if RPC exists; otherwise omit
        let saude: Snapshot["saude"] = null;
        try {
          const { data: h } = await supabase.rpc("get_my_financial_health" as any);
          if (h && typeof h === "object") {
            saude = {
              score: (h as any).score ?? null,
              status: (h as any).status ?? null,
              pontos_positivos: (h as any).positives ?? [],
              pontos_atencao: (h as any).attentions ?? [],
              alertas: ((h as any).alerts ?? []).map((a: any) => ({
                severidade: a.severity, titulo: a.title, explicacao: a.explanation, recomendacao: a.recommendation,
              })),
            };
          }
        } catch { /* RPC opcional */ }

        const snapshot: Snapshot = {
          empresa: { id: companyId, nome: companyName },
          periodo: { de: iso(from), ate: iso(today) },
          caixa_periodo: { entradas: incomeTotal, saidas: expenseTotal, saldo: incomeTotal - expenseTotal },
          contas_a_receber: { aberto_total: recvOpen, vencidas_qtd: recvOverdueQty, vencidas_total: recvOverdueAmt },
          contas_a_pagar: { aberto_total: payOpen, vencidas_qtd: payOverdueQty, vencidas_total: payOverdueAmt },
          projecao_30d: { entradas: projIn, saidas: projOut, saldo: projIn - projOut },
          produtos: { total_ativos: productsTotal, sem_custo: productsWithoutCost },
          saude,
        };

        const hasAnyData =
          (txRows?.length ?? 0) > 0 || productsTotal > 0;

        const system = `${SYSTEM_BASE}

DADOS_DA_EMPRESA (JSON, valores em BRL, datas ISO):
${JSON.stringify(snapshot, null, 2)}

${hasAnyData ? "" : "OBSERVAÇÃO: A base de dados financeira da empresa está praticamente vazia. Oriente o usuário a cadastrar entradas, saídas, custos e produtos antes de analisar a saúde financeira."}`;

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onError: (err) => {
            console.error("[finance-agent.chat] stream error", err);
            return err instanceof Error ? err.message : "Erro ao gerar resposta";
          },
        });
      },
    },
  },
});
