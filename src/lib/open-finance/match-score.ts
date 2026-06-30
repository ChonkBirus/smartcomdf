/**
 * Bank reconciliation suggestion scorer.
 *
 * Pure function — no DB. Reused by `suggestBankReconciliation` and unit tests.
 *
 * Scoring (max 100):
 *   - exact amount match (|Δ| ≤ R$0,01): +40
 *   - amount within ±1%:                  +25
 *   - date within ±2 days:                +20
 *   - description similar (Jaccard > .6): +20
 *   - same customer/supplier:             +10
 *   - status compatible:                  +10
 */

export type ScoreInput = {
  bankAmount: number;
  bankDate: string; // ISO yyyy-mm-dd
  bankDescription: string;
  bankType: "CREDIT" | "DEBIT";
  finAmount: number;
  finDate: string | null; // due_date or paid_at
  finDescription: string;
  finType: "INCOME" | "EXPENSE";
  finStatus: "PLANNED" | "PAID" | "OVERDUE" | "CANCELED" | "RECONCILED";
  customerCompatible?: boolean;
  supplierCompatible?: boolean;
};

const STOPWORDS = new Set([
  "de","da","do","para","com","em","na","no","a","o","e",
  "pagamento","pagto","transferencia","ted","doc","pix","boleto","compra","venda",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function daysBetween(a: string, b: string | null): number {
  if (!b) return Number.POSITIVE_INFINITY;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

export function typesCompatible(
  bankType: ScoreInput["bankType"],
  finType: ScoreInput["finType"]
): boolean {
  return (
    (bankType === "CREDIT" && finType === "INCOME") ||
    (bankType === "DEBIT" && finType === "EXPENSE")
  );
}

export function scoreMatch(input: ScoreInput): number {
  if (!typesCompatible(input.bankType, input.finType)) return 0;
  if (input.finStatus === "CANCELED" || input.finStatus === "RECONCILED") return 0;

  let score = 0;

  // Amount
  const bankAbs = Math.abs(input.bankAmount);
  const finAbs = Math.abs(input.finAmount);
  const diff = Math.abs(bankAbs - finAbs);
  if (diff <= 0.01) score += 40;
  else if (bankAbs > 0 && diff / bankAbs <= 0.01) score += 25;

  // Date
  const dd = daysBetween(input.bankDate, input.finDate);
  if (dd <= 2) score += 20;
  else if (dd <= 5) score += 10;

  // Description
  const sim = jaccardSimilarity(input.bankDescription, input.finDescription);
  if (sim >= 0.6) score += 20;
  else if (sim >= 0.3) score += 10;

  // Party
  if (input.customerCompatible || input.supplierCompatible) score += 10;

  // Status
  if (input.finStatus === "PLANNED" || input.finStatus === "OVERDUE" || input.finStatus === "PAID") {
    score += 10;
  }

  return Math.min(100, score);
}

export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export function tierFor(score: number): ConfidenceTier {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}
