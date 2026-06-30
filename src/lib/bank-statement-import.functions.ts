import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankStatementImport = {
  id: string;
  company_id: string;
  bank_account_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  status: "UPLOADED" | "PARSING" | "PREVIEW" | "IMPORTED" | "FAILED" | "CANCELED";
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  error_rows: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  bank_account?: { id: string; name: string } | null;
};

export type BankStatementTransaction = {
  id: string;
  import_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  document_number: string | null;
  external_id: string | null;
  transaction_hash: string;
  reconciliation_status: "PENDING" | "SUGGESTED" | "RECONCILED" | "IGNORED";
  raw_payload: any;
  created_at: string;
};

async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle();
  const cid = data?.company_id as string | undefined;
  if (!cid) throw new Error("Sem empresa.");
  return cid;
}

const ParsedRowSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  description: z.string().max(500).default(""),
  amount: z.number().finite(),
  type: z.enum(["CREDIT", "DEBIT"]),
  document_number: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  raw_payload: z.any().optional(),
});

const CreateImportSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_type: z.enum(["OFX", "CSV", "XLSX"]),
  file_size: z.number().int().nonnegative(),
  bank_account_id: z.string().uuid().nullable().optional(),
  rows: z.array(ParsedRowSchema).min(1).max(10_000),
});

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const createBankStatementImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof CreateImportSchema>) => CreateImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);

    const { data: imp, error: impErr } = await context.supabase
      .from("bank_statement_imports")
      .insert({
        company_id: cid,
        bank_account_id: data.bank_account_id ?? null,
        file_name: data.file_name,
        file_type: data.file_type,
        file_size: data.file_size,
        status: "PREVIEW",
        total_rows: data.rows.length,
        imported_by: context.userId,
      })
      .select("id")
      .single();
    if (impErr) throw new Error(impErr.message);

    // Build hashes and dedupe within file
    const seen = new Set<string>();
    const enriched: Array<any> = [];
    for (const r of data.rows) {
      const key = `${r.transaction_date}|${r.amount.toFixed(2)}|${(r.description ?? "").trim().toLowerCase()}|${r.external_id ?? ""}`;
      const hash = await sha256(`${cid}|${key}`);
      if (seen.has(hash)) continue;
      seen.add(hash);
      enriched.push({
        company_id: cid,
        import_id: imp.id,
        bank_account_id: data.bank_account_id ?? null,
        transaction_date: r.transaction_date,
        description: r.description ?? "",
        amount: r.amount,
        type: r.type,
        document_number: r.document_number ?? null,
        external_id: r.external_id ?? null,
        transaction_hash: hash,
        raw_payload: r.raw_payload ?? null,
        reconciliation_status: "PENDING" as const,
      });
    }

    // Detect existing hashes
    const hashes = enriched.map((e) => e.transaction_hash);
    const { data: existing } = await context.supabase
      .from("bank_statement_transactions")
      .select("transaction_hash")
      .eq("company_id", cid)
      .in("transaction_hash", hashes);
    const existingSet = new Set((existing ?? []).map((e: any) => e.transaction_hash));
    const toInsert = enriched.filter((e) => !existingSet.has(e.transaction_hash));
    const duplicates = enriched.length - toInsert.length;

    if (toInsert.length) {
      const batchSize = 500;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error: insErr } = await context.supabase
          .from("bank_statement_transactions")
          .insert(batch);
        if (insErr) throw new Error(insErr.message);
      }
    }

    await context.supabase
      .from("bank_statement_imports")
      .update({
        total_rows: data.rows.length,
        imported_rows: toInsert.length,
        duplicate_rows: duplicates,
        status: "PREVIEW",
      })
      .eq("id", imp.id);

    return {
      import_id: imp.id as string,
      total: data.rows.length,
      inserted: toInsert.length,
      duplicates,
    };
  });

export const confirmBankStatementImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { import_id: string }) =>
    z.object({ import_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("bank_statement_imports")
      .update({ status: "IMPORTED" })
      .eq("id", data.import_id)
      .eq("company_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelBankStatementImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { import_id: string }) =>
    z.object({ import_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    // Cascade delete via FK
    const { error } = await context.supabase
      .from("bank_statement_imports")
      .delete()
      .eq("id", data.import_id)
      .eq("company_id", cid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBankStatementImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("bank_statement_imports")
      .select("*, bank_account:financial_bank_accounts(id,name)")
      .eq("company_id", cid)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as BankStatementImport[];
  });

export const listBankStatementTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { import_id: string }) =>
    z.object({ import_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cid = await getCompanyId(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("bank_statement_transactions")
      .select("*")
      .eq("company_id", cid)
      .eq("import_id", data.import_id)
      .order("transaction_date", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []) as BankStatementTransaction[];
  });
