import { describe, it, expect } from "vitest";
import { buildCrmReportRows, buildCrmReportCsv, type CrmReportsData } from "./crm-reports-csv";

const sample: CrmReportsData = {
  bySource: [
    { key: "site", label: "Site", count: 3, value: 1500 },
    { key: "indicacao", label: "Indicação; VIP", count: 2, value: 999.5 },
  ],
  byAssigned: [
    { key: "u1", label: "Ana", count: 5, won: 2, lost: 1, value: 2500 },
  ],
  lostReasons: [
    { reason: "Preço alto", count: 4 },
    { reason: 'Cliente disse "não"', count: 1 },
  ],
  byTemperature: [] as any,
} as CrmReportsData;

describe("buildCrmReportRows", () => {
  for (const days of [7, 30, 90, 180, 365]) {
    it(`monta seções obrigatórias para período de ${days} dias`, () => {
      const rows = buildCrmReportRows(sample, days);
      const flat = rows.map((r) => r.join("|"));
      expect(flat[0]).toBe(`Relatório CRM - Últimos ${days} dias`);
      expect(flat).toContain("Leads por origem");
      expect(flat).toContain("Origem|Quantidade|Valor (R$)");
      expect(flat).toContain("Performance por responsável");
      expect(flat).toContain("Responsável|Leads|Ganhos|Perdidos|Valor (R$)");
      expect(flat).toContain("Motivos de perda");
      expect(flat).toContain("Motivo|Ocorrências");
    });
  }

  it("inclui linhas de dados com quantidades e valores em pt-BR", () => {
    const rows = buildCrmReportRows(sample, 30);
    const flat = rows.map((r) => r.join("|"));
    expect(flat).toContain("Site|3|1.500,00");
    expect(flat).toContain("Indicação; VIP|2|999,50");
    expect(flat).toContain("Ana|5|2|1|2.500,00");
    expect(flat).toContain("Preço alto|4");
    expect(flat).toContain('Cliente disse "não"|1');
  });

  it("adiciona totais por seção", () => {
    const rows = buildCrmReportRows(sample, 30);
    const flat = rows.map((r) => r.join("|"));
    expect(flat).toContain("Total|5|2.499,50");
    expect(flat).toContain("Total|5|2|1|2.500,00");
    expect(flat).toContain("Total|5");
  });

  it("gera placeholder quando não há dados no período", () => {
    const empty: CrmReportsData = { bySource: [], byAssigned: [], lostReasons: [] } as any;
    const rows = buildCrmReportRows(empty, 7);
    const flat = rows.map((r) => r.join("|"));
    expect(flat).toContain("(sem dados)|0|0,00");
    expect(flat).toContain("(sem dados)|0|0|0|0,00");
    expect(flat).toContain("(sem dados)|0");
  });
});

describe("buildCrmReportCsv", () => {
  it("usa ; como separador e escapa aspas/pontos-e-vírgulas", () => {
    const csv = buildCrmReportCsv(sample, 30);
    expect(csv.split("\n")[0]).toBe("Relatório CRM - Últimos 30 dias");
    expect(csv).toContain('"Indicação; VIP";2;"999,50"');
    expect(csv).toContain('"Cliente disse ""não""";1');
  });
});
