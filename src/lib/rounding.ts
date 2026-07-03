/**
 * Regra única de arredondamento — Markup / Precificação / Orçamento
 * ------------------------------------------------------------------
 * Aplicada em TODO o fluxo (backend `pricing.functions.ts`, UI de orçamento,
 * relatórios de margem, alertas de gap).
 *
 * Método: "half away from zero" (arredondamento comercial, equivalente ao
 *   `ROUND_HALF_UP` do padrão bancário BR) — nunca "banker's rounding".
 *
 * Casas decimais:
 *   - Valores monetários (R$): 2 casas       → ex.: 1234.567 → 1234.57
 *   - Percentuais exibidos ao usuário: 1 casa (formato pt-BR via Intl)
 *   - Taxas internas (0..1) usadas no cálculo: 4 casas    → ex.: 0.12345 → 0.1235
 *   - Multiplicador de markup: 4 casas       → ex.: 1.42857 → 1.4286
 *
 * Regra: arredondar APENAS na saída (exibição / persistência final).
 * Cálculos intermediários usam precisão total (`Number`) para evitar
 * acúmulo de erro.
 */

function halfAwayFromZero(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, digits);
  return Math.sign(value) * Math.round(Math.abs(value) * f) / f;
}

/** Valores em R$ — 2 casas. */
export const roundMoney = (n: number) => halfAwayFromZero(n, 2);

/** Taxas internas 0..1 — 4 casas. */
export const roundRate = (n: number) => halfAwayFromZero(n, 4);

/** Multiplicador de markup — 4 casas. */
export const roundMarkup = (n: number) => halfAwayFromZero(n, 4);

/** Percentual (0..100) para exibição — 1 casa. */
export const roundPercent = (n: number) => halfAwayFromZero(n, 1);
