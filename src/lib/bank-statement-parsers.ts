import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ParsedTx = {
  transaction_date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  document_number: string | null;
  external_id: string | null;
  raw_payload?: any;
};

export type ParseResult = {
  rows: ParsedTx[];
  warnings: string[];
};

// --------- Helpers ---------
function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function toISODate(input: any): string | null {
  if (input == null || input === "") return null;
  if (input instanceof Date && !isNaN(input.getTime())) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
  }
  const s = String(input).trim();
  // OFX YYYYMMDD or YYYYMMDDHHMMSS
  let m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Excel serial number
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 80000) {
    const d = XLSX.SSF.parse_date_code(num);
    if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  // Generic Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return null;
}

function toAmount(input: any): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" && isFinite(input)) return input;
  let s = String(input).trim().replace(/\s+/g, "");
  // Drop currency symbols
  s = s.replace(/[R$\u00A0]/gi, "");
  const negParen = /^\(.+\)$/.test(s);
  if (negParen) s = s.slice(1, -1);
  // BR format: 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  const n = Number(s);
  if (isNaN(n)) return null;
  return negParen ? -n : n;
}

// --------- OFX ---------
function decodeXmlEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseOFX(text: string): ParseResult {
  const warnings: string[] = [];
  const rows: ParsedTx[] = [];
  // Strip header (SGML key:value lines before first <)
  const xmlStart = text.indexOf("<OFX");
  const body = xmlStart >= 0 ? text.slice(xmlStart) : text;

  // Match each STMTTRN block (SGML-tolerant: tags may be unclosed)
  const trnRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTTRNRS>|<\/STMTRS>|$)/gi;
  const getField = (block: string, tag: string) => {
    const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
    const m = block.match(re);
    return m ? decodeXmlEntities(m[1].trim()) : null;
  };

  let match: RegExpExecArray | null;
  while ((match = trnRegex.exec(body)) !== null) {
    const block = match[1];
    const dt = toISODate(getField(block, "DTPOSTED"));
    const amt = toAmount(getField(block, "TRNAMT"));
    if (!dt || amt == null) { warnings.push("Transação OFX ignorada (data/valor inválidos)"); continue; }
    const memo = getField(block, "MEMO") ?? getField(block, "NAME") ?? "";
    const fitid = getField(block, "FITID");
    const checknum = getField(block, "CHECKNUM");
    rows.push({
      transaction_date: dt,
      description: memo,
      amount: amt,
      type: amt >= 0 ? "CREDIT" : "DEBIT",
      document_number: checknum,
      external_id: fitid,
      raw_payload: { ofx: block.slice(0, 500) },
    });
  }
  if (!rows.length) warnings.push("Nenhuma transação OFX encontrada (<STMTTRN>).");
  return { rows, warnings };
}

// --------- CSV / XLSX ---------
const HEADER_MAP: Record<string, "date" | "description" | "amount" | "credit" | "debit" | "doc" | "type" | "id"> = {
  data: "date", date: "date", "data do lancamento": "date", "data lancamento": "date", "data movimento": "date",
  descricao: "description", "descrição": "description", historico: "description", "histórico": "description", description: "description", memo: "description",
  valor: "amount", amount: "amount", "valor (r$)": "amount", montante: "amount",
  credito: "credit", "crédito": "credit", entrada: "credit", credit: "credit",
  debito: "debit", "débito": "debit", saida: "debit", "saída": "debit", debit: "debit",
  documento: "doc", "nº documento": "doc", "n documento": "doc", doc: "doc", "doc.": "doc",
  tipo: "type", type: "type",
  id: "id", fitid: "id", "id transacao": "id",
};

function normHeader(h: string) {
  return h
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function rowsFromTable(records: Record<string, any>[]): ParseResult {
  const warnings: string[] = [];
  if (!records.length) return { rows: [], warnings: ["Arquivo sem linhas."] };

  const headers = Object.keys(records[0]);
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const key = HEADER_MAP[normHeader(h)];
    if (key) mapping[key] = h;
  }

  if (!mapping.date) warnings.push("Coluna de data não reconhecida.");
  const hasAmount = mapping.amount || (mapping.credit && mapping.debit) || mapping.credit || mapping.debit;
  if (!hasAmount) warnings.push("Coluna de valor não reconhecida.");

  const rows: ParsedTx[] = [];
  for (const rec of records) {
    const dt = toISODate(mapping.date ? rec[mapping.date] : null);
    let amt: number | null = null;
    if (mapping.amount) amt = toAmount(rec[mapping.amount]);
    else {
      const cr = mapping.credit ? toAmount(rec[mapping.credit]) : null;
      const db = mapping.debit ? toAmount(rec[mapping.debit]) : null;
      if (cr && cr !== 0) amt = Math.abs(cr);
      else if (db && db !== 0) amt = -Math.abs(db);
    }
    if (!dt || amt == null || amt === 0) continue;
    let type: "CREDIT" | "DEBIT" = amt >= 0 ? "CREDIT" : "DEBIT";
    if (mapping.type && rec[mapping.type]) {
      const t = normHeader(String(rec[mapping.type]));
      if (/cred|entr|c$/.test(t)) type = "CREDIT";
      else if (/deb|sai|d$/.test(t)) type = "DEBIT";
    }
    rows.push({
      transaction_date: dt,
      description: mapping.description ? String(rec[mapping.description] ?? "") : "",
      amount: amt,
      type,
      document_number: mapping.doc ? String(rec[mapping.doc] ?? "") || null : null,
      external_id: mapping.id ? String(rec[mapping.id] ?? "") || null : null,
    });
  }
  if (!rows.length) warnings.push("Nenhuma linha válida foi reconhecida no arquivo.");
  return { rows, warnings };
}

async function parseCSV(file: File): Promise<ParseResult> {
  const text = await file.text();
  const res = Papa.parse<Record<string, any>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: "",
    transformHeader: (h) => h.trim(),
  });
  const records = (res.data ?? []).filter(
    (r) => r && Object.values(r).some((v) => v !== "" && v != null),
  );
  return rowsFromTable(records);
}

async function parseXLSX(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "", raw: true });
  return rowsFromTable(json);
}

export async function parseStatementFile(file: File): Promise<ParseResult & { fileType: "OFX" | "CSV" | "XLSX" }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ofx") || name.endsWith(".qfx")) {
    const text = await file.text();
    return { ...parseOFX(text), fileType: "OFX" };
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return { ...(await parseCSV(file)), fileType: "CSV" };
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return { ...(await parseXLSX(file)), fileType: "XLSX" };
  }
  throw new Error("Formato não suportado. Use OFX, CSV, XLSX ou XLS.");
}
