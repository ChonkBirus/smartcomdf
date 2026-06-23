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
  Copy, Download, MessageCircle, Send, Eye, CheckCircle2, Link2, History, Mail,
} from "lucide-react";
import { toast } from "sonner";
import {
  getQuote, getQuoteHistory, logQuoteEvent, markQuoteSent,
} from "@/lib/quotes.functions";
import { generateQuotePDF } from "@/lib/quote-pdf";

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
    mutationFn: (vars: { quote_id: string; event_type: "sent" | "link_copied" | "whatsapp_sent" | "pdf_downloaded" | "email_sent"; meta?: Record<string, any> }) =>
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

  function handleDownloadPDF() {
    if (!quote) return;
    generateQuotePDF({
      quote, items, customer,
      company: null, // logo/cnpj rendered from quote header
      publicLink: publicUrl,
    });
    logMut.mutate({ quote_id: quoteId!, event_type: "pdf_downloaded" });
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

                <div className="grid gap-2 sm:grid-cols-3">
                  <Button onClick={handleWhatsApp} className="w-full">
                    <MessageCircle className="mr-1 h-4 w-4" />WhatsApp
                  </Button>
                  <Button variant="outline" onClick={handleDownloadPDF} className="w-full">
                    <Download className="mr-1 h-4 w-4" />PDF
                  </Button>
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
    </Sheet>
  );
}
