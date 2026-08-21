import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, FileText, Loader2, Mail, MessageCircle, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { appUrl } from "@/lib/app-url";
import {
  generateServiceOrderFinalReport,
  getServiceOrderReport,
  listServiceOrderReportSendEvents,
  logServiceOrderReportSend,
  uploadServiceOrderReportPdf,
} from "@/lib/service-order-reports.functions";

type Props = {
  serviceOrderId: string;
  companyId: string;
  status: string;
  canGenerate: boolean;
  canSend: boolean;
  canDownload: boolean;
  canSeePublicLink: boolean;
  customerName?: string | null;
  customerEmail?: string | null;
  customerWhatsapp?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  SIGNED: "Assinado",
  SENT: "Enviado",
  CANCELLED: "Cancelado",
};

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  COPY_LINK: "Link copiado",
  PDF_DOWNLOAD: "PDF baixado",
  MANUAL: "Manual",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

function publicLink(token: string | null | undefined) {
  if (!token) return "";
  return appUrl(`/r/${token}`);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

function buildPdfBlob(opts: {
  reportNumber: string;
  serviceOrderNumber: string;
  customerName: string;
  customerEmail?: string | null;
  serviceTitle: string;
  description?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  issue?: string | null;
  solution?: string | null;
  technicianReport?: string | null;
  materials: Array<{ name: string; quantity: number; unit: string }>;
  checklist: Array<{ title: string; is_completed: boolean; is_required: boolean }>;
  signatures: Array<{ signer_name: string; signature_type: string; signed_at: string }>;
}): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Relatório de Serviço ${opts.reportNumber}`, 40, y);
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`OS #${opts.serviceOrderNumber}`, 40, y);
  y += 14;
  doc.text(`Cliente: ${opts.customerName}`, 40, y);
  y += 14;
  if (opts.customerEmail) {
    doc.text(`E-mail: ${opts.customerEmail}`, 40, y);
    y += 14;
  }
  y += 6;
  doc.setDrawColor(220);
  doc.line(40, y, W - 40, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("Serviço realizado", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(opts.serviceTitle, 40, y);
  y += 14;
  if (opts.description) {
    const lines = doc.splitTextToSize(opts.description, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 4;
  }
  doc.text(`Início: ${fmtDate(opts.startedAt)}`, 40, y);
  y += 12;
  doc.text(`Conclusão: ${fmtDate(opts.completedAt)}`, 40, y);
  y += 16;

  if (opts.issue) {
    doc.setFont("helvetica", "bold");
    doc.text("Problema relatado", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(opts.issue, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 8;
  }
  if (opts.solution) {
    doc.setFont("helvetica", "bold");
    doc.text("Solução aplicada", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(opts.solution, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 8;
  }
  if (opts.technicianReport) {
    doc.setFont("helvetica", "bold");
    doc.text("Relatório do técnico", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(opts.technicianReport, W - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12 + 8;
  }

  if (opts.checklist.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Checklist", "Status"]],
      body: opts.checklist.map((c) => [
        (c.is_required ? "* " : "") + c.title,
        c.is_completed ? "Concluído" : "Pendente",
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  if (opts.materials.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Materiais utilizados", "Qtd"]],
      body: opts.materials.map((m) => [
        m.name,
        `${Number(m.quantity).toLocaleString("pt-BR")} ${m.unit ?? ""}`,
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  if (opts.signatures.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Assinaturas", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    opts.signatures.forEach((s) => {
      doc.text(
        `${s.signature_type === "CUSTOMER" ? "Cliente" : "Técnico"}: ${s.signer_name} — ${fmtDate(s.signed_at)}`,
        40,
        y,
      );
      y += 12;
    });
  }

  return doc.output("blob");
}

export function ServiceOrderFinalReport({
  serviceOrderId,
  companyId,
  status,
  canGenerate,
  canSend,
  canDownload,
  canSeePublicLink,
  customerName,
  customerEmail,
  customerWhatsapp,
}: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getServiceOrderReport);
  const genFn = useServerFn(generateServiceOrderFinalReport);
  const uploadFn = useServerFn(uploadServiceOrderReportPdf);
  const logFn = useServerFn(logServiceOrderReportSend);
  const listEvents = useServerFn(listServiceOrderReportSendEvents);

  const [busy, setBusy] = useState(false);

  const { data: report } = useQuery({
    queryKey: ["so-report", serviceOrderId],
    queryFn: () => getFn({ data: { service_order_id: serviceOrderId } }),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["so-report-events", report?.id],
    queryFn: () => listEvents({ data: { report_id: report!.id } }),
    enabled: !!report?.id,
  });

  const link = useMemo(() => publicLink(report?.public_token), [report?.public_token]);
  const isCompleted = status === "COMPLETED";

  async function handleGenerate() {
    if (!isCompleted) {
      toast.error("Finalize a OS antes de gerar o relatório.");
      return;
    }
    setBusy(true);
    try {
      // 1) Create / fetch the report row
      const rep = await genFn({ data: { service_order_id: serviceOrderId } });

      // 2) Build PDF on the client using current OS payload
      const { getMobileServiceOrderDetails } =
        await import("@/lib/technician-service-orders.functions");
      const { listChecklistItems } = await import("@/lib/service-order-checklist.functions");
      const { listMaterialUsage } = await import("@/lib/service-order-materials.functions");
      const { listServiceOrderSignatures } =
        await import("@/lib/service-order-signatures.functions");

      const [details, checklist, materials, signatures] = await Promise.all([
        (getMobileServiceOrderDetails as any)({ data: { id: serviceOrderId } }),
        (listChecklistItems as any)({ data: { id: serviceOrderId } }),
        (listMaterialUsage as any)({ data: { id: serviceOrderId } }),
        (listServiceOrderSignatures as any)({ data: { id: serviceOrderId } }),
      ]);

      const so = details.so;
      const blob = buildPdfBlob({
        reportNumber: rep.report_number,
        serviceOrderNumber: so.service_order_number,
        customerName: so.customer_name ?? customerName ?? "—",
        customerEmail,
        serviceTitle: so.title,
        description: so.description,
        startedAt: so.started_at,
        completedAt: so.completed_at,
        issue: so.issue_found,
        solution: so.solution_applied,
        technicianReport: so.technician_report,
        materials: (materials ?? []).map((m: any) => ({
          name: m.item_name ?? "Material",
          quantity: Number(m.used_quantity ?? 0),
          unit: m.unit ?? "",
        })),
        checklist: (checklist ?? []).map((c: any) => ({
          title: c.title,
          is_completed: !!c.is_completed,
          is_required: !!c.is_required,
        })),
        signatures: (signatures ?? []).map((s: any) => ({
          signer_name: s.signer_name,
          signature_type: s.signature_type,
          signed_at: s.signed_at,
        })),
      });

      const file_base64 = await blobToBase64(blob);
      await uploadFn({
        data: {
          report_id: rep.id,
          company_id: companyId,
          service_order_id: serviceOrderId,
          file_name: `${rep.report_number}.pdf`,
          file_base64,
        },
      });

      toast.success("Relatório gerado com sucesso.");
      qc.invalidateQueries({ queryKey: ["so-report", serviceOrderId] });
      qc.invalidateQueries({ queryKey: ["so-mobile", serviceOrderId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar relatório.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado.");
    if (report?.id) {
      await logFn({
        data: { report_id: report.id, channel: "COPY_LINK", status: "COPIED" },
      });
      qc.invalidateQueries({ queryKey: ["so-report-events", report.id] });
    }
  }

  async function handleDownload() {
    if (!report?.signed_pdf_url) {
      toast.error("PDF ainda não está disponível.");
      return;
    }
    window.open(report.signed_pdf_url, "_blank");
    await logFn({
      data: { report_id: report.id, channel: "PDF_DOWNLOAD", status: "DOWNLOADED" },
    });
    qc.invalidateQueries({ queryKey: ["so-report-events", report.id] });
  }

  async function handleWhatsApp() {
    if (!report?.id || !link) return;
    const phone = (customerWhatsapp ?? "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá ${customerName ?? ""}, segue o relatório do serviço realizado: ${link}`,
    );
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
    await logFn({
      data: {
        report_id: report.id,
        channel: "WHATSAPP",
        status: "SENT",
        recipient_name: customerName ?? null,
        recipient_contact: customerWhatsapp ?? null,
      },
    });
    qc.invalidateQueries({ queryKey: ["so-report-events", report.id] });
    qc.invalidateQueries({ queryKey: ["so-report", serviceOrderId] });
  }

  async function handleEmail() {
    if (!report?.id || !link) return;
    const to = customerEmail ?? "";
    const subject = encodeURIComponent(`Relatório ${report.report_number}`);
    const body = encodeURIComponent(
      `Olá ${customerName ?? ""},\n\nSegue o relatório do serviço realizado:\n${link}\n`,
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
    await logFn({
      data: {
        report_id: report.id,
        channel: "EMAIL",
        status: "SENT",
        recipient_name: customerName ?? null,
        recipient_contact: to || null,
      },
    });
    qc.invalidateQueries({ queryKey: ["so-report-events", report.id] });
    qc.invalidateQueries({ queryKey: ["so-report", serviceOrderId] });
  }

  if (!report) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isCompleted ? "Nenhum relatório gerado ainda." : "Finalize a OS para gerar o relatório."}
        </p>
        {canGenerate && (
          <Button onClick={handleGenerate} disabled={!isCompleted || busy} size="sm">
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Gerar relatório final
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{report.report_number}</Badge>
        <Badge>{STATUS_LABEL[report.status] ?? report.status}</Badge>
        <span className="text-xs text-muted-foreground">
          Gerado em {fmtDate(report.generated_at)}
        </span>
      </div>

      {canSeePublicLink && link && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 text-xs bg-muted rounded px-2 py-1 border"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canDownload && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={!report.signed_pdf_url}
          >
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        )}
        {canSend && (
          <>
            <Button size="sm" variant="outline" onClick={handleWhatsApp} disabled={!link}>
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={handleEmail} disabled={!link}>
              <Mail className="h-4 w-4 mr-1" /> E-mail
            </Button>
          </>
        )}
        {canGenerate && (
          <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-1" />
            )}
            Regerar PDF
          </Button>
        )}
      </div>

      {events.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs font-semibold text-muted-foreground mb-1">
            Histórico de envios
          </div>
          <ul className="space-y-1 text-xs">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium">{CHANNEL_LABEL[ev.channel] ?? ev.channel}</span>
                  {ev.recipient_contact && (
                    <span className="text-muted-foreground"> · {ev.recipient_contact}</span>
                  )}
                </div>
                <span className="text-muted-foreground whitespace-nowrap">
                  {fmtDate(ev.sent_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
