import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quote, QuoteItem } from "./quotes.functions";

type Company = {
  corporate_name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  logo_url?: string | null;
};

type Customer = {
  name?: string | null;
  trade_name?: string | null;
  corporate_name?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

/**
 * Generates a client-facing PDF for a quote.
 * The client never sees unit_price, item subtotals, or labor cost.
 * Only quantity per item and the single TOTAL value are shown.
 */
export function generateQuotePDF(opts: {
  quote: Quote;
  items: QuoteItem[];
  customer: Customer | null;
  company: Company | null;
  publicLink?: string;
}) {
  const { quote, items, customer, company, publicLink } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company?.trade_name || company?.corporate_name || "Empresa", 40, y);
  y += 18;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const headerLines = [
    company?.cnpj ? `CNPJ: ${company.cnpj}` : null,
    [company?.phone, company?.email].filter(Boolean).join(" • "),
  ].filter(Boolean) as string[];
  headerLines.forEach((l) => { doc.text(l, 40, y); y += 12; });

  // Title block
  y += 8;
  doc.setDrawColor(220);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Orçamento ${quote.quote_number}`, 40, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${fmtDate(quote.issue_date)}`, W - 40, y, { align: "right" });
  y += 14;
  if (quote.valid_until) {
    doc.text(`Validade: ${fmtDate(quote.valid_until)}`, W - 40, y, { align: "right" });
    y += 14;
  }
  if (quote.title) {
    doc.setFont("helvetica", "italic");
    doc.text(quote.title, 40, y);
    y += 14;
  }

  // Customer block
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 40, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  const cName = customer?.trade_name || customer?.name || customer?.corporate_name || "—";
  doc.text(cName, 40, y); y += 12;
  if (customer?.cpf_cnpj) { doc.text(`Documento: ${customer.cpf_cnpj}`, 40, y); y += 12; }
  const cContact = [customer?.phone, customer?.email].filter(Boolean).join(" • ");
  if (cContact) { doc.text(cContact, 40, y); y += 12; }

  // Items table — NO unit price, NO subtotal per row, NO labor as line
  const visible = items.filter((it) => it.kind !== "LABOR");
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["#", "Item / Descrição", "Qtd"]],
    body: visible.map((it, i) => [
      String(i + 1),
      it.description ? `${it.name}\n${it.description}` : it.name,
      String(Number(it.quantity)).replace(".", ","),
    ]),
    styles: { fontSize: 10, cellPadding: 6, valign: "top" },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 60, halign: "center" },
    },
    margin: { left: 40, right: 40 },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 18;

  // Single total + mandatory disclosure
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("VALOR TOTAL DA PROPOSTA", 40, y);
  doc.text(fmtBRL(quote.total_amount), W - 40, y, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text("Valor total com materiais, serviços e mão de obra inclusos.", 40, y);
  doc.setTextColor(0);
  y += 18;

  // Conditions
  doc.setFontSize(10);
  const block = (label: string, value?: string | null) => {
    if (!value) return;
    doc.setFont("helvetica", "bold");
    doc.text(label, 40, y); y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 6;
    if (y > 760) { doc.addPage(); y = 40; }
  };
  block("Forma de pagamento", quote.payment_terms);
  block("Prazo de execução / entrega", quote.delivery_terms);
  block("Estimativa de conclusão", quote.completion_estimate);
  block("Garantia", quote.warranty_terms);
  block("Observações", quote.customer_notes);

  if (publicLink) {
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Versão online: ${publicLink}`, 40, y);
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${company?.trade_name || ""} — Orçamento ${quote.quote_number}`, 40, 820);
    doc.text(`${i} / ${pageCount}`, W - 40, 820, { align: "right" });
  }

  doc.save(`Orcamento-${quote.quote_number}.pdf`);
}
