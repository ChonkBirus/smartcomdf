import { describe, it, expect, vi } from "vitest";
import { mirrorQuotePaymentToFinancial } from "./quote-payments.functions";

/**
 * Regressão: marcar orçamento como pago 2× não pode duplicar
 * lançamento em `financial_transactions`.
 *
 * Estratégia: mock do client Supabase que simula o comportamento das
 * queries (`.from().select().eq()... .maybeSingle()` / `.insert()` /
 * `.update()`) mantendo o estado em memória, e o índice único
 * `(company_id, quote_id, type=INCOME)` inerente à lógica: a 2ª chamada
 * encontra a linha existente e chama apenas UPDATE — nunca INSERT.
 */

type Row = {
  id: string;
  company_id: string;
  quote_id: string;
  type: string;
  status: string;
  deleted_at: string | null;
};

const PAYMENT_ID = "11111111-1111-1111-1111-111111111111";
const QUOTE_ID = "22222222-2222-2222-2222-222222222222";
const COMPANY_ID = "33333333-3333-3333-3333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-4444-444444444444";
const USER_ID = "55555555-5555-5555-5555-555555555555";

function makeSb(initialFinancial: Row[] = []) {
  const financial: Row[] = [...initialFinancial];
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();

  const financialBuilder = () => {
    const filters: Record<string, unknown> = {};
    const nullFilters: string[] = [];
    const api: any = {
      select: () => api,
      eq: (k: string, v: unknown) => { filters[k] = v; return api; },
      is: (k: string, v: unknown) => { if (v === null) nullFilters.push(k); return api; },
      maybeSingle: async () => {
        const row = financial.find((r) =>
          Object.entries(filters).every(([k, v]) => (r as any)[k] === v) &&
          nullFilters.every((k) => (r as any)[k] === null),
        );
        return { data: row ?? null, error: null };
      },
      insert: async (payload: any) => {
        insertSpy(payload);
        financial.push({
          id: `fin-${financial.length + 1}`,
          company_id: payload.company_id,
          quote_id: payload.quote_id,
          type: payload.type,
          status: payload.status,
          deleted_at: null,
        });
        return { data: null, error: null };
      },
      update: (patch: any) => {
        updateSpy(patch);
        return {
          eq: async (k: string, v: unknown) => {
            const row = financial.find((r) => (r as any)[k] === v);
            if (row) Object.assign(row, patch);
            return { data: null, error: null };
          },
        };
      },
    };
    return api;
  };

  const payment = {
    quote_id: QUOTE_ID,
    payment_method: "PIX",
    company_id: COMPANY_ID,
    amount: 1000,
  };
  const quote = {
    customer_id: CUSTOMER_ID,
    total_amount: 1000,
    valid_until: "2026-12-31",
  };

  const paymentsBuilder = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: payment, error: null }) }) }),
  });
  const quotesBuilder = () => ({
    select: () => ({
      eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: quote, error: null }) }) }),
    }),
  });

  const sb = {
    from: (table: string) => {
      if (table === "quote_payments") return paymentsBuilder();
      if (table === "quotes") return quotesBuilder();
      if (table === "financial_transactions") return financialBuilder();
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { sb, financial, insertSpy, updateSpy };
}

describe("mirrorQuotePaymentToFinancial — regressão de duplicidade", () => {
  it("primeira aprovação cria 1 lançamento PAID", async () => {
    const { sb, financial, insertSpy } = makeSb();
    const res = await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    expect(res.action).toBe("created");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(financial).toHaveLength(1);
    expect(financial[0].status).toBe("PAID");
  });

  it("aprovar 2× NÃO duplica: 2ª chamada é no-op (já está PAID)", async () => {
    const { sb, financial, insertSpy, updateSpy } = makeSb();
    await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    const res = await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    expect(res.action).toBe("noop");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(financial).toHaveLength(1);
  });

  it("recebível pré-existente PENDING vira PAID sem duplicar", async () => {
    const { sb, financial, insertSpy, updateSpy } = makeSb([
      {
        id: "fin-existing",
        company_id: COMPANY_ID,
        quote_id: QUOTE_ID,
        type: "INCOME",
        status: "PENDING",
        deleted_at: null,
      },
    ]);
    const res = await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    expect(res.action).toBe("updated");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(financial).toHaveLength(1);
    expect(financial[0].status).toBe("PAID");
  });

  it("aprovar 3× seguido continua com exatamente 1 lançamento", async () => {
    const { sb, financial, insertSpy } = makeSb();
    await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    await mirrorQuotePaymentToFinancial(sb, { paymentId: PAYMENT_ID, userId: USER_ID });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(financial).toHaveLength(1);
  });
});
