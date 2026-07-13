/**
 * Fonte única de cálculo de totais de orçamento.
 * Usada por: QuoteFormSheet (tela), preview interno, e qualquer
 * verificação client-side. O PDF e a rota pública /q/:token usam
 * `quotes.total_amount` persistido no banco — mesma regra aritmética
 * abaixo, aplicada por trigger.
 *
 * Regras comerciais:
 *   subtotal_itens = Σ (quantity × unit_price)  para itens não-LABOR
 *   mão de obra   = labor_cost                  (soma no total)
 *   desconto      = discount                    (subtrai no total)
 *   total_geral   = max(0, subtotal_itens + labor_cost − discount)
 * Arredondamento comercial (2 casas) — ver src/lib/rounding.ts.
 */
import { roundMoney } from "./rounding";

export type QuoteTotalsLine = {
  quantity: number;
  unit_price: number;
  kind?: string | null;
};

export type QuoteTotals = {
  items_subtotal: number;
  labor_cost: number;
  discount: number;
  total_amount: number;
};

const n = (v: unknown): number => {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function computeQuoteTotals(
  lines: readonly QuoteTotalsLine[],
  laborCost: number,
  discount: number,
): QuoteTotals {
  const items_subtotal = roundMoney(
    (lines ?? []).reduce((s, l) => {
      // LABOR nunca entra como linha no subtotal — vai em labor_cost.
      if ((l.kind ?? "").toUpperCase() === "LABOR") return s;
      return s + n(l.quantity) * n(l.unit_price);
    }, 0),
  );
  const labor = roundMoney(Math.max(0, n(laborCost)));
  const disc = roundMoney(Math.max(0, n(discount)));
  const total_amount = roundMoney(Math.max(0, items_subtotal + labor - disc));
  return { items_subtotal, labor_cost: labor, discount: disc, total_amount };
}
