import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy, Download, MessageCircle, Send, Eye, CheckCircle2, Link2, History, Mail, Banknote, XCircle, Rocket, FileSearch,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import { toast } from "sonner";
import {
  getQuote, getQuoteHistory, logQuoteEvent, markQuoteSent,
} from "@/lib/quotes.functions";
import {
  listQuotePayments, approveQuotePayment, cancelQuotePayment, getCompanyPix,
} from "@/lib/quote-payments.functions";
import { generateQuotePDF, type QuotePdfTemplate } from "@/lib/quote-pdf-index";
import { getQuotePdfPayload } from "@/lib/quote-pdf.functions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Can } from "@/components/app/PermissionRoute";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConvertQuoteToProjectButton } from "./ConvertQuoteToProjectButton";

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const EVENT_LABEL: Record<string, string> = {
  sent: "Marcado como enviado",
  link_copied: "Link copiado",
  whatsapp_sent: "Enviado via WhatsApp",
  pdf_downloaded: "PDF baixado",
  email_sent: "Enviado por e-mail",
  viewed: "Visualizado pelo cliente",
  accepted: "Aceito pelo cliente",
  payment_created: "Cobrança Pix criada",
  payment_approved: "Pagamento aprovado",
  payment_cancelled: "Cobrança cancelada",
  pix_sent_whatsapp: "Pix enviado via WhatsApp",
  pix_copied: "Pix copiado",
};

function publicUrlFor(token: string) {
  if (typeof window === "undefined") return `/q/${token}`;
  return `${window.location.origin}/q/${token}`;
}

export function QuoteSendSheet({
  open, onOpenChange, quoteId,
}: { open: boolean; onOpenChange: (v: boolean) => void; quoteId: string | null }) {
  const qc = useQueryClient();
  const fetchQuote = useServerFn(getQuote);
  const fetchHistory = useServerFn(getQuoteHistory);
  const logEvent = useServerFn(logQuoteEvent);
  const sendIt = useServerFn(markQuoteSent);
  const fetchPayments = useServerFn(listQuotePayments);
  const fetchPix = useServerFn(getCompanyPix);
  const approvePay = useServerFn(approveQuotePayment);
  const cancelPay = useServerFn(cancelQuotePayment);
  const fetchPdfPayload = useServerFn(getQuotePdfPayload);
  const [pdfTemplate, setPdfTemplate] = useState<QuotePdfTemplate>("premium");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);


  const enabled = open && !!quoteId;
  const { data, isLoading } = useQuery({
    queryKey: ["quote", quoteId, "for-send"],
    queryFn: () => fetchQuote({ data: { id: quoteId! } }),
    enabled,
  });
  const { data: history } = useQuery({
    queryKey: ["quote-history", quoteId],
    queryFn: () => fetchHistory({ data: { quote_id: quoteId! } }),
    enabled,
  });
  const { data: payments } = useQuery({
    queryKey: ["quote-payments", quoteId],
    queryFn: () => fetchPayments({ data: { quote_id: quoteId! } }),
    enabled,
  });
  const { data: companyPix } = useQuery({
    queryKey: ["company-pix"],
    queryFn: () => fetchPix(),
    enabled: open,
    staleTime: 60_000,
  });

  const [customMsg, setCustomMsg] = useState<string>("");

  const quote = data?.quote;
  const items = data?.items ?? [];
  const customer = data?.customer ?? null;

  const publicUrl = quote ? publicUrlFor(quote.public_token) : "";

  const waMessage = useMemo(() => {
    if (!quote) return "";
    if (customMsg.trim()) return customMsg;
    const total = fmtBRL(quote.total_amount);
    const lines = [
      `Olá${customer?.name ? `, ${customer.trade_name || customer.name}` : ""}!`,
      "",
      `Segue o orçamento *${quote.quote_number}* para sua avaliação.`,
      quote.title ? `Referente a: ${quote.title}` : "",
      "",
      `*Valor Total da Proposta: ${total}*`,
      `_Materiais, serviços e mão de obra inclusos._`,
      quote.valid_until ? `Validade da proposta: ${new Date(quote.valid_until).toLocaleDateString("pt-BR")}` : "",
      quote.completion_estimate ? `Estimativa de conclusão: ${quote.completion_estimate}` : "",
      "",
      `Você pode visualizar e aceitar diretamente neste link:`,
      publicUrl,
      "",
      "Qualquer dúvida estou à disposição.",
    ].filter(Boolean);
    return lines.join("\n");
  }, [quote, customer, publicUrl, customMsg]);

  const logMut = useMutation({
    mutationFn: (vars: { quote_id: string; event_type: "sent" | "link_copied" | "whatsapp_sent" | "pdf_downloaded" | "email_sent" | "pix_sent_whatsapp" | "pix_copied"; meta?: Record<string, any> }) =>
      logEvent({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote-history", quoteId] }),
  });
  const sendMut = useMutation({
    mutationFn: () => sendIt({ data: { id: quoteId! } }),
    onSuccess: () => {
      toast.success("Status: Enviado.");
      qc.invalidateQueries({ queryKey: ["quote", quoteId, "for-send"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote-metrics"] });
      logMut.mutate({ quote_id: quoteId!, event_type: "sent" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado.");
      logMut.mutate({ quote_id: quoteId!, event_type: "link_copied" });
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function handleDownloadPDF() {
    if (!quote) return;
    setPdfBusy(true);
    try {
      const payload = await fetchPdfPayload({ data: { quote_id: quote.id } });
      await generateQuotePDF({
        template: pdfTemplate,
        quote: payload.quote as any,
        items: payload.items as any,
        customer: payload.customer as any,
        company: payload.company as any,
        settings: payload.settings,
        publicLink: publicUrl,
      });
      logMut.mutate({ quote_id: quoteId!, event_type: "pdf_downloaded", meta: { template: pdfTemplate } });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handlePreviewPDF() {
    if (!quote) return;
    setPreviewBusy(true);
    try {
      const payload = await fetchPdfPayload({ data: { quote_id: quote.id } });
      const blob = await generateQuotePDF({
        template: pdfTemplate,
        quote: payload.quote as any,
        items: payload.items as any,
        customer: payload.customer as any,
        company: payload.company as any,
        settings: payload.settings,
        publicLink: publicUrl,
        output: "blob",
      });
      if (!(blob instanceof Blob)) throw new Error("PDF inválido.");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar pré-visualização.");
    } finally {
      setPreviewBusy(false);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }



  function handleWhatsApp() {
    if (!quote) return;
    const phone = (customer as any)?.whatsapp || (customer as any)?.phone || "";
    const digits = phone.replace(/\D/g, "");
    const base = digits
      ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`
      : `https://wa.me/`;
    const url = `${base}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    logMut.mutate({ quote_id: quoteId!, event_type: "whatsapp_sent" });
    if (quote.status === "DRAFT") sendMut.mutate();
  }

  function handleEmail() {
    if (!quote) return;
    const to = (customer as any)?.email || "";
    const subject = `Orçamento ${quote.quote_number}`;
    const body = [
      `Olá${customer?.name ? `, ${customer.trade_name || customer.name}` : ""}!`,
      "",
      "Segue o link da sua proposta:",
      publicUrl,
      "",
      `Valor total da proposta: ${fmtBRL(quote.total_amount)}`,
      quote.valid_until ? `Validade: ${new Date(quote.valid_until).toLocaleDateString("pt-BR")}` : "",
      quote.completion_estimate ? `Estimativa de conclusão: ${quote.completion_estimate}` : "",
      "",
      "O valor total já inclui materiais, serviços e mão de obra.",
      "",
      "Qualquer dúvida estamos à disposição.",
    ].filter(Boolean).join("\n");
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    logMut.mutate({ quote_id: quoteId!, event_type: "email_sent" });
    if (quote.status === "DRAFT") sendMut.mutate();
  }

  // Active down payment (most recent non-cancelled, or fallback to latest)
  const activePayment = (payments ?? []).find(
    (p) => p.payment_type === "DOWN_PAYMENT" && p.payment_status !== "CANCELLED",
  ) ?? (payments ?? [])[0] ?? null;

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");

  const approveMut = useMutation({
    mutationFn: (id: string) => approvePay({ data: { id, note: approveNote || undefined } }),
    onSuccess: () => {
      toast.success("Pagamento aprovado.");
      setApproveOpen(false);
      setApproveNote("");
      qc.invalidateQueries({ queryKey: ["quote", quoteId, "for-send"] });
      qc.invalidateQueries({ queryKey: ["quote-payments", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote-history", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });
  const cancelPayMut = useMutation({
    mutationFn: (id: string) => cancelPay({ data: { id } }),
    onSuccess: () => {
      toast.success("Cobrança cancelada.");
      qc.invalidateQueries({ queryKey: ["quote", quoteId, "for-send"] });
      qc.invalidateQueries({ queryKey: ["quote-payments", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote-history", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  function pixWhatsAppMessage(): string {
    if (!quote || !activePayment) return "";
    const lines = [
      `Olá, ${customer?.trade_name || customer?.name || "cliente"}! Tudo bem?`,
      "",
      `Seu orçamento *${quote.quote_number}* foi aprovado.`,
      "",
      `Para iniciarmos o serviço, segue o Pix referente à entrada de ${quote.down_payment_percent}%:`,
      `*Valor da entrada: ${fmtBRL(Number(activePayment.amount))}*`,
      "",
      activePayment.pix_key ? `Chave Pix: ${activePayment.pix_key}` : (companyPix?.pix_key ? `Chave Pix: ${companyPix.pix_key}` : ""),
      activePayment.pix_copy_paste ? `Pix Copia e Cola:\n${activePayment.pix_copy_paste}` : "",
      "",
      "Após o pagamento, envie o comprovante por aqui.",
      "",
      `Valor total da proposta: ${fmtBRL(quote.total_amount)}`,
      `Saldo restante: ${fmtBRL(quote.remaining_amount)}`,
      "",
      "Obrigado!",
    ].filter(Boolean);
    return lines.join("\n");
  }

  function handleSendPixWhatsApp() {
    if (!quote || !activePayment) return;
    const phone = (customer as any)?.whatsapp || (customer as any)?.phone || "";
    const digits = phone.replace(/\D/g, "");
    const base = digits
      ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`
      : `https://wa.me/`;
    const url = `${base}?text=${encodeURIComponent(pixWhatsAppMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
    logMut.mutate({ quote_id: quoteId!, event_type: "pix_sent_whatsapp" });
  }

  async function handleCopyPix() {
    const text = activePayment?.pix_copy_paste || activePayment?.pix_key || companyPix?.pix_key || "";
    if (!text) {
      toast.error("Nenhuma chave Pix disponível.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Pix copiado.");
      logMut.mutate({ quote_id: quoteId!, event_type: "pix_copied" });
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            Enviar orçamento {quote?.quote_number ?? "..."}
          </SheetTitle>
          <SheetDescription>
            Compartilhe via WhatsApp, link ou PDF. O cliente vê apenas o valor total.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-65px)]">
          <div className="space-y-5 p-6">
            {isLoading || !quote ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">
                      {customer?.trade_name || customer?.name || "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-lg font-semibold">{fmtBRL(quote.total_amount)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Badge variant="outline">{quote.status}</Badge>
                    {quote.viewed_at && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3 w-3" />Visualizado {fmtDateTime(quote.viewed_at)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Link2 className="h-4 w-4" />Link público
                  </Label>
                  <div className="flex gap-2">
                    <Input value={publicUrl} readOnly className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copiar">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Não exige login. O cliente vê apenas o valor total da proposta.
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Mensagem para WhatsApp</Label>
                  <Textarea
                    value={waMessage}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    className="min-h-[160px] font-mono text-xs"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleWhatsApp} className="w-full">
                    <MessageCircle className="mr-1 h-4 w-4" />WhatsApp
                  </Button>
                  <Button variant="outline" onClick={handleEmail} className="w-full">
                    <Mail className="mr-1 h-4 w-4" />E-mail
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="outline" onClick={handleDownloadPDF} className="flex-1" disabled={pdfBusy}>
                      <Download className="mr-1 h-4 w-4" />{pdfBusy ? "Gerando..." : "PDF"}
                    </Button>
                    <Select value={pdfTemplate} onValueChange={(v) => setPdfTemplate(v as QuotePdfTemplate)}>
                      <SelectTrigger className="w-[120px]" title="Modelo do PDF">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="simple">Simples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => sendMut.mutate()}
                    disabled={!["DRAFT", "VIEWED"].includes(quote.status) || sendMut.isPending}
                    className="w-full"
                  >
                    <Send className="mr-1 h-4 w-4" />Marcar enviado
                  </Button>
                </div>

                {quote.accepted_at && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/30">
                    <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />Aceito pelo cliente
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por <strong>{quote.accepted_by_name}</strong> em {fmtDateTime(quote.accepted_at)}
                    </p>
                  </div>
                )}

                {quote.payment_status !== "NOT_STARTED" && (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Banknote className="h-4 w-4" />Pagamento da entrada
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Total da proposta</div>
                      <div className="text-right font-medium">{fmtBRL(quote.total_amount)}</div>
                      <div className="text-muted-foreground">Entrada ({quote.down_payment_percent}%)</div>
                      <div className="text-right font-semibold">{fmtBRL(quote.down_payment_amount)}</div>
                      <div className="text-muted-foreground">Saldo restante</div>
                      <div className="text-right">{fmtBRL(quote.remaining_amount)}</div>
                      <div className="text-muted-foreground">Status</div>
                      <div className="text-right">
                        <Badge
                          variant={
                            quote.payment_status === "PAYMENT_APPROVED" ? "default"
                            : quote.payment_status === "WAITING_PAYMENT" ? "secondary"
                            : "destructive"
                          }
                        >
                          {quote.payment_status === "WAITING_PAYMENT" && "Aguardando pagamento"}
                          {quote.payment_status === "PAYMENT_APPROVED" && "Pagamento aprovado"}
                          {quote.payment_status === "PAYMENT_REJECTED" && "Recusado"}
                          {quote.payment_status === "PAYMENT_CANCELLED" && "Cancelado"}
                        </Badge>
                      </div>
                      {quote.payment_approved_at && (
                        <>
                          <div className="text-muted-foreground">Aprovado em</div>
                          <div className="text-right">{fmtDateTime(quote.payment_approved_at)}</div>
                        </>
                      )}
                    </div>

                    {!companyPix?.pix_key && quote.payment_status === "WAITING_PAYMENT" && (
                      <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                        Cadastre sua chave Pix em Configurações &gt; Empresa para enviar a cobrança de entrada.
                      </div>
                    )}

                    {quote.payment_status === "WAITING_PAYMENT" && activePayment && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <Can module="quote_payments" action="send_pix">
                          <Button onClick={handleSendPixWhatsApp} className="w-full">
                            <MessageCircle className="mr-1 h-4 w-4" />Enviar Pix WhatsApp
                          </Button>
                        </Can>
                        <Button variant="outline" onClick={handleCopyPix} className="w-full">
                          <Copy className="mr-1 h-4 w-4" />Copiar Pix
                        </Button>
                        <Can module="quote_payments" action="approve">
                          <Button
                            variant="secondary"
                            onClick={() => setApproveOpen(true)}
                            className="w-full"
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />Marcar como pago
                          </Button>
                        </Can>
                        <Can module="quote_payments" action="cancel">
                          <Button
                            variant="outline"
                            onClick={() => cancelPayMut.mutate(activePayment.id)}
                            className="w-full"
                          >
                            <XCircle className="mr-1 h-4 w-4" />Cancelar cobrança
                          </Button>
                        </Can>
                      </div>
                    )}
                  </div>
                )}

                {(quote.status === "APPROVED" || quote.status === "CONVERTED") && (
                  <div className="rounded-lg border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Rocket className="h-4 w-4" />Projeto de execução
                    </div>
                    <ConvertQuoteToProjectButton
                      quoteId={quote.id}
                      status={quote.status}
                      paymentStatus={quote.payment_status}
                    />
                  </div>
                )}

                <Separator />

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4" />Histórico
                  </div>
                  <ul className="space-y-2 text-xs">
                    {(history ?? []).length === 0 ? (
                      <li className="text-muted-foreground">Nenhum evento registrado ainda.</li>
                    ) : (
                      history!.map((h) => (
                        <li key={h.id} className="flex items-start justify-between gap-2 rounded border p-2">
                          <div>
                            <p className="font-medium">{EVENT_LABEL[h.event_type] ?? h.event_type}</p>
                            {h.actor_label && (
                              <p className="text-muted-foreground">{h.actor_label}</p>
                            )}
                          </div>
                          <span className="whitespace-nowrap text-muted-foreground">
                            {fmtDateTime(h.created_at)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento aprovado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação indicará que a entrada do orçamento foi recebida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="approve-note">Observação (opcional)</Label>
            <Textarea
              id="approve-note"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Ex: pago via Pix em 12/06."
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activePayment && approveMut.mutate(activePayment.id)}
              disabled={!activePayment || approveMut.isPending}
            >
              Aprovar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
