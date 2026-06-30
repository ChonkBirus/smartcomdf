import { describe, it, expect } from "vitest";
import { scoreMatch, jaccardSimilarity, tierFor, typesCompatible } from "./match-score";

const base = {
  bankAmount: 100,
  bankDate: "2026-06-10",
  bankDescription: "Pagamento cliente ACME LTDA",
  bankType: "CREDIT" as const,
  finAmount: 100,
  finDate: "2026-06-10",
  finDescription: "Recebimento ACME LTDA fatura 123",
  finType: "INCOME" as const,
  finStatus: "PLANNED" as const,
};

describe("scoreMatch", () => {
  it("scores a perfect CREDIT match high", () => {
    const s = scoreMatch({ ...base, customerCompatible: true });
    expect(s).toBeGreaterThanOrEqual(75);
    expect(tierFor(s)).toBe("HIGH");
  });

  it("scores 0 when types are incompatible (CREDIT vs EXPENSE)", () => {
    expect(scoreMatch({ ...base, finType: "EXPENSE" })).toBe(0);
  });

  it("scores 0 when fin tx is already reconciled or canceled", () => {
    expect(scoreMatch({ ...base, finStatus: "RECONCILED" })).toBe(0);
    expect(scoreMatch({ ...base, finStatus: "CANCELED" })).toBe(0);
  });

  it("gives partial date credit within 5 days, full within 2", () => {
    const close = scoreMatch({ ...base, bankDate: "2026-06-11" });
    const farther = scoreMatch({ ...base, bankDate: "2026-06-14" });
    const tooFar = scoreMatch({ ...base, bankDate: "2026-06-30" });
    expect(close).toBeGreaterThan(farther);
    expect(farther).toBeGreaterThan(tooFar);
  });

  it("falls below LOW threshold for very different descriptions and wrong amount", () => {
    const s = scoreMatch({
      ...base,
      finAmount: 999,
      bankDescription: "compra mercado",
      finDescription: "energia eletrica",
      finDate: "2026-05-01",
    });
    expect(tierFor(s)).toBe("LOW");
  });

  it("DEBIT vs EXPENSE is compatible", () => {
    expect(typesCompatible("DEBIT", "EXPENSE")).toBe(true);
    expect(typesCompatible("DEBIT", "INCOME")).toBe(false);
  });

  it("jaccard similarity is symmetric and ignores stopwords", () => {
    const a = jaccardSimilarity("Pagamento de ACME LTDA", "ACME pagamento ltda");
    expect(a).toBeGreaterThan(0.5);
  });
});
