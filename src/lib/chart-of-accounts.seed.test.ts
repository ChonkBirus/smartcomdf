import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  levelFromCode,
  parentCode,
  sortOrderFromCode,
} from "./chart-of-accounts.seed";

/**
 * In-memory fake of the subset of the supabase client used by the seed loop.
 * Enforces the same UNIQUE (company_id, code) constraint the DB enforces,
 * so we can validate idempotency deterministically in a unit test.
 */
function createFakeSupabase() {
  const rows: Array<{ id: string; company_id: string; code: string | null }> = [];
  let counter = 0;

  return {
    rows,
    from(_table: string) {
      const self = {
        _filters: {} as { company_id?: string; codeNotNull?: boolean },
        _pendingInsert: null as null | { company_id: string; code: string | null },
        select(_cols: string) {
          return self;
        },
        eq(col: string, val: string) {
          if (col === "company_id") self._filters.company_id = val;
          return self;
        },
        not(col: string, _op: string, _val: null) {
          if (col === "code") self._filters.codeNotNull = true;
          return self;
        },
        insert(payload: { company_id: string; code: string | null }) {
          self._pendingInsert = payload;
          return self;
        },
        single() {
          const p = self._pendingInsert!;
          const dup = rows.find(
            (r) => r.company_id === p.company_id && r.code !== null && r.code === p.code,
          );
          if (dup) return Promise.resolve({ data: null, error: { message: "duplicate" } });
          const row = { id: `id_${++counter}`, company_id: p.company_id, code: p.code };
          rows.push(row);
          return Promise.resolve({ data: row, error: null });
        },
        then(resolve: (r: { data: typeof rows; error: null }) => void) {
          // await on the select-eq chain
          const filtered = rows.filter(
            (r) =>
              r.company_id === self._filters.company_id &&
              (!self._filters.codeNotNull || r.code !== null),
          );
          resolve({ data: filtered, error: null });
        },
      };
      return self;
    },
  };
}

async function runSeed(supabase: ReturnType<typeof createFakeSupabase>, companyId: string) {
  const { data: existing } = await (supabase
    .from("financial_categories")
    .select("id, code")
    .eq("company_id", companyId)
    .not("code", "is", null) as unknown as Promise<{
    data: Array<{ id: string; code: string | null }>;
    error: null;
  }>);
  const codeToId = new Map<string, string>();
  for (const r of existing) if (r.code) codeToId.set(r.code, r.id);

  let inserted = 0;
  for (const node of DEFAULT_CHART_OF_ACCOUNTS) {
    if (codeToId.has(node.code)) continue;
    const pcode = parentCode(node.code);
    const parent_id = pcode ? (codeToId.get(pcode) ?? null) : null;
    const { data: row, error } = await supabase
      .from("financial_categories")
      .insert({
        company_id: companyId,
        code: node.code,
        // extra fields omitted; fake only tracks (company_id, code)
        // but we still exercise the same code path.
        // @ts-expect-error - fake accepts extra props
        name: node.name,
        type: node.type,
        parent_id,
        level: levelFromCode(node.code),
        sort_order: sortOrderFromCode(node.code),
      })
      .select("id, code")
      .single();
    if (error) continue;
    if (row) codeToId.set(row.code as string, row.id);
    inserted += 1;
  }
  return inserted;
}

describe("chart-of-accounts seed idempotency", () => {
  it("inserts every default node on the first run", async () => {
    const fake = createFakeSupabase();
    const inserted = await runSeed(fake, "companyA");
    expect(inserted).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
    expect(fake.rows.length).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);
  });

  it("does not duplicate categories when run again on the same company", async () => {
    const fake = createFakeSupabase();
    await runSeed(fake, "companyA");
    const secondRun = await runSeed(fake, "companyA");
    expect(secondRun).toBe(0);
    expect(fake.rows.length).toBe(DEFAULT_CHART_OF_ACCOUNTS.length);

    // No duplicate (company_id, code) pair exists.
    const seen = new Set<string>();
    for (const r of fake.rows) {
      const key = `${r.company_id}::${r.code}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("keeps separate rows per company (multi-tenant safe)", async () => {
    const fake = createFakeSupabase();
    await runSeed(fake, "companyA");
    await runSeed(fake, "companyB");
    await runSeed(fake, "companyA"); // re-run, still no dupes
    expect(fake.rows.length).toBe(DEFAULT_CHART_OF_ACCOUNTS.length * 2);
  });

  it("has unique codes in the seed source itself", () => {
    const codes = DEFAULT_CHART_OF_ACCOUNTS.map((n) => n.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
