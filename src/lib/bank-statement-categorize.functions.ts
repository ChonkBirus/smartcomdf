/**
 * E4 — Auto-categorization for bank statement transactions.
 *
 * Keyword-based suggestion over the company's financial_categories. Pure
 * heuristic — no ML. Returns the best matching category for a description.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CategorySuggestion = {
  categoryId: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  score: number;
};

const KEYWORDS: Record<string, string[]> = {
  // Receitas
  recebimento: [
    "pix recebido",
    "ted recebida",
    "deposito",
    "credito",
    "recebimento",
    "fatura paga",
  ],
  vendas: ["venda", "pagamento cliente", "pagto", "boleto recebido"],
  // Despesas
  fornecedores: ["fornecedor", "pagamento fornec", "boleto"],
  folha: ["salario", "folha", "rescisao", "ferias", "13o"],
  impostos: ["darf", "das", "iss", "icms", "irpj", "csll", "inss", "fgts", "gps"],
  servicos: ["luz", "energia", "agua", "internet", "telefone", "telefonia", "aluguel"],
  combustivel: ["posto", "combustivel", "gasolina", "diesel"],
  alimentacao: ["restaurante", "lanchonete", "ifood", "rappi"],
  tarifas: ["tarifa", "iof", "juros", "anuidade", "manutencao conta"],
  transporte: ["uber", "99", "cabify", "taxi", "estacionamento", "pedagio"],
};

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export const suggestCategoryForDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        description: z.string().max(500),
        type: z.enum(["INCOME", "EXPENSE"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .maybeSingle();
    const cid = profile?.company_id;
    if (!cid) throw new Error("Sem empresa.");

    const { data: cats } = await sb
      .from("financial_categories")
      .select("id, name, type")
      .eq("company_id", cid)
      .eq("active", true)
      .eq("type", data.type);

    const desc = normalize(data.description);
    const list = (cats ?? []) as Array<{ id: string; name: string; type: "INCOME" | "EXPENSE" }>;
    if (!list.length) return null as CategorySuggestion | null;

    // 1) direct token match against category name
    let best: CategorySuggestion | null = null;
    for (const c of list) {
      const nm = normalize(c.name);
      if (!nm) continue;
      if (desc.includes(nm)) {
        const score = Math.min(100, 60 + nm.length);
        if (!best || score > best.score) {
          best = { categoryId: c.id, name: c.name, type: c.type, score };
        }
      }
    }
    if (best) return best;

    // 2) heuristic keyword bucket → first matching category by bucket key in name
    for (const [bucket, terms] of Object.entries(KEYWORDS)) {
      if (!terms.some((t) => desc.includes(t))) continue;
      const cat = list.find((c) => normalize(c.name).includes(bucket));
      if (cat) {
        return { categoryId: cat.id, name: cat.name, type: cat.type, score: 55 };
      }
    }

    return null;
  });
