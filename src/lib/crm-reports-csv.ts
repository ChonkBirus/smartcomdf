export type CrmReportsData = {
  bySource: { key: string; label: string; count: number; value: number }[];
  byAssigned: { key: string; label: string; count: number; won: number; lost: number; value: number }[];
  lostReasons: { reason: string; count: number }[];
};

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(";")).join("\n");
}

const fmt = (n: number) =>
  Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildCrmReportRows(data: CrmReportsData, days: number): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push([`Relatório CRM - Últimos ${days} dias`]);
  rows.push([]);

  rows.push(["Leads por origem"]);
  rows.push(["Origem", "Quantidade", "Valor (R$)"]);
  if (data.bySource.length === 0) rows.push(["(sem dados)", 0, fmt(0)]);
  else data.bySource.forEach((r) => rows.push([r.label, r.count, fmt(r.value)]));
  rows.push([
    "Total",
    data.bySource.reduce((s, r) => s + r.count, 0),
    fmt(data.bySource.reduce((s, r) => s + r.value, 0)),
  ]);
  rows.push([]);

  rows.push(["Performance por responsável"]);
  rows.push(["Responsável", "Leads", "Ganhos", "Perdidos", "Valor (R$)"]);
  if (data.byAssigned.length === 0) rows.push(["(sem dados)", 0, 0, 0, fmt(0)]);
  else data.byAssigned.forEach((r) => rows.push([r.label, r.count, r.won, r.lost, fmt(r.value)]));
  rows.push([
    "Total",
    data.byAssigned.reduce((s, r) => s + r.count, 0),
    data.byAssigned.reduce((s, r) => s + r.won, 0),
    data.byAssigned.reduce((s, r) => s + r.lost, 0),
    fmt(data.byAssigned.reduce((s, r) => s + r.value, 0)),
  ]);
  rows.push([]);

  rows.push(["Motivos de perda"]);
  rows.push(["Motivo", "Ocorrências"]);
  if (data.lostReasons.length === 0) rows.push(["(sem dados)", 0]);
  else data.lostReasons.forEach((r) => rows.push([r.reason, r.count]));
  rows.push(["Total", data.lostReasons.reduce((s, r) => s + r.count, 0)]);

  return rows;
}

export function buildCrmReportCsv(data: CrmReportsData, days: number): string {
  return toCsv(buildCrmReportRows(data, days));
}
