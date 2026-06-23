import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ShieldCheck, FileText, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/q/$token")({
  ssr: false,
  head: () => ({ meta: [{ title: "Proposta — SecureERP" }] }),
  component: PublicQuotePage,
  notFoundComponent: () => <ErrorView message="Orçamento não encontrado." />,
  errorComponent: ({ error }) => <ErrorView message={error?.message ?? "Erro."} />,
});

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

type PublicQuote = {
  quote: {
    id: string;
    quote_number: string;
    status: string;
    title: string | null;
    issue_date: string;
    valid_until: string | null;
    payment_terms: string | null;
    delivery_terms: string | null;
    warranty_terms: string | null;
    completion_estimate: string | null;
    customer_notes: string | null;
    total_amount: number;
    accepted_at: string | null;
    accepted_by_name: string | null;
    payment_status?: string;
    down_payment_amount?: number;
    remaining_amount?: number;
    down_payment_percent?: number;
  };
  customer: { name: string; document: string | null };
  company: {
    name: string; cnpj: string | null; email: string | null;
    phone: string | null; whatsapp: string | null; logo_url: string | null;
  };
  items: Array<{
    id: string; name: string; description: string | null;
    kind: string; quantity: number; position: number;
    unit?: string | null; image_url?: string | null;
  }>;
  pix?: {
    pix_key: string; pix_key_type: string | null;
    receiver_name: string | null; receiver_city: string | null;
  } | null;
  payment?: {
    id: string; amount: number; payment_status: string;
    pix_key: string | null; pix_copy_paste: string | null;
    pix_qr_code_url: string | null; paid_at: string | null;
  } | null;
};

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Não foi possível abrir</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function PublicQuotePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<PublicQuote | null>({
    queryKey: ["public-quote", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_quote_by_token", { _token: token });
      if (error) throw error;
      return data as PublicQuote | null;
    },
  });

  // Register view once
  useEffect(() => {
    if (!data?.quote?.id) return;
    supabase.rpc("register_public_quote_view", { _token: token });
  }, [data?.quote?.id, token]);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");

  const acceptMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("accept_public_quote", {
        _token: token, _name: name, _document: doc || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Orçamento aceito! Obrigado.");
      setAcceptOpen(false);
      qc.invalidateQueries({ queryKey: ["public-quote", token] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando proposta...
      </div>
    );
  }
  if (error || !data) {
    return <ErrorView message={(error as any)?.message ?? "Orçamento não encontrado."} />;
  }

  const { quote, customer, company, items } = data;
  const visibleItems = items.filter((i) => i.kind !== "LABOR");
  const isAccepted = quote.status === "APPROVED" || !!quote.accepted_at;
  const isClosed = ["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"].includes(quote.status);
  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        {/* Company header */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              {company.logo_url && (
                <img src={company.logo_url} alt={company.name} className="mb-2 max-h-14" />
              )}
              <h1 className="text-lg font-bold">{company.name}</h1>
              {company.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>}
              <p className="text-xs text-muted-foreground">
                {[company.phone, company.email].filter(Boolean).join(" • ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Proposta</p>
              <p className="text-base font-bold">{quote.quote_number}</p>
              <p className="text-xs text-muted-foreground">Emitida em {fmtDate(quote.issue_date)}</p>
              {quote.valid_until && (
                <p className="text-xs text-muted-foreground">Válida até {fmtDate(quote.valid_until)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </h2>
          <p className="mt-1 font-medium">{customer.name}</p>
          {customer.document && (
            <p className="text-sm text-muted-foreground">Documento: {customer.document}</p>
          )}
          {quote.title && <p className="mt-2 text-sm italic">{quote.title}</p>}
        </div>

        {/* Items (no prices, no subtotals) */}
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="mr-2 inline h-4 w-4" />
            Itens da proposta
          </div>
          <ul className="divide-y">
            {visibleItems.map((it, i) => (
              <li key={it.id} className="flex gap-3 p-4">
                <span className="mt-1 w-6 shrink-0 text-center text-xs text-muted-foreground">
                  {i + 1}
                </span>
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.name}
                    className="h-16 w-16 shrink-0 rounded border bg-muted object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{it.name}</p>
                  {it.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line">
                      {it.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-sm">
                  <span className="font-semibold">
                    {String(Number(it.quantity)).replace(".", ",")}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {it.unit || "UN"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Total */}
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Valor Total da Proposta
          </p>
          <p className="mt-1 text-3xl font-bold">{fmtBRL(quote.total_amount)}</p>
          <p className="mt-2 text-xs italic text-muted-foreground">
            Valor total com materiais, serviços e mão de obra inclusos.
          </p>
          {quote.completion_estimate && (
            <p className="mt-2 text-sm text-muted-foreground">
              Estimativa de conclusão: <strong>{quote.completion_estimate}</strong>
            </p>
          )}
        </div>

        {/* Conditions */}
        {(quote.payment_terms || quote.delivery_terms || quote.warranty_terms || quote.customer_notes) && (
          <div className="space-y-3 rounded-lg border bg-card p-5 shadow-sm text-sm">
            {quote.payment_terms && (
              <div><strong>Forma de pagamento:</strong><p className="text-muted-foreground whitespace-pre-line">{quote.payment_terms}</p></div>
            )}
            {quote.delivery_terms && (
              <div><strong>Prazo / entrega:</strong><p className="text-muted-foreground whitespace-pre-line">{quote.delivery_terms}</p></div>
            )}
            {quote.warranty_terms && (
              <div><strong>Garantia:</strong><p className="text-muted-foreground whitespace-pre-line">{quote.warranty_terms}</p></div>
            )}
            {quote.customer_notes && (
              <div><strong>Observações:</strong><p className="text-muted-foreground whitespace-pre-line">{quote.customer_notes}</p></div>
            )}
            {data.payment && data.payment.payment_status === "APPROVED" && (
              <p className="mt-2 inline-block rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                Pagamento aprovado
              </p>
            )}
          </div>
        )}

        {isAccepted && data.payment && data.payment.payment_status !== "APPROVED" && (
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold">Pagamento da entrada</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para iniciarmos o serviço, realize o pagamento da entrada
              {quote.down_payment_percent ? ` (${quote.down_payment_percent}%)` : ""}.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Valor da entrada</div>
              <div className="text-right font-bold">{fmtBRL(Number(data.payment.amount))}</div>
              <div className="text-muted-foreground">Saldo restante</div>
              <div className="text-right">{fmtBRL(Number(quote.remaining_amount ?? 0))}</div>
            </div>

            {data.pix?.pix_key || data.payment.pix_key ? (
              <div className="mt-3 space-y-2 rounded border bg-muted/40 p-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Chave Pix: </span>
                  <strong className="break-all">{data.payment.pix_key || data.pix?.pix_key}</strong>
                </div>
                {data.payment.pix_copy_paste && (
                  <div>
                    <span className="text-muted-foreground">Pix Copia e Cola:</span>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-xs">
                      {data.payment.pix_copy_paste}
                    </pre>
                  </div>
                )}
                {data.payment.pix_qr_code_url && (
                  <img src={data.payment.pix_qr_code_url} alt="QR Pix" className="mx-auto h-48 w-48" />
                )}
              </div>
            ) : (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                A empresa ainda não cadastrou a chave Pix. Entre em contato para combinar o pagamento.
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const text = data.payment?.pix_copy_paste || data.payment?.pix_key || data.pix?.pix_key || "";
                  if (!text) return toast.error("Sem chave Pix.");
                  try { await navigator.clipboard.writeText(text); toast.success("Pix copiado."); }
                  catch { toast.error("Não foi possível copiar."); }
                }}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />Copiar Pix
              </Button>
              {company.whatsapp && (
                <Button
                  onClick={() => {
                    const digits = String(company.whatsapp).replace(/\D/g, "");
                    const num = digits.startsWith("55") ? digits : `55${digits}`;
                    const msg = `Olá! Acabei de aceitar o orçamento ${quote.quote_number}. Gostaria de finalizar o pagamento da entrada de ${fmtBRL(Number(data.payment?.amount ?? 0))}.`;
                    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />Falar no WhatsApp

        {/* Accept */}
        {isAccepted ? (
          <div className="rounded-lg border border-green-300 bg-green-50 p-5 text-center dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <h3 className="mt-2 font-semibold text-green-800 dark:text-green-300">
              Proposta aceita
            </h3>
            {quote.accepted_by_name && (
              <p className="text-sm text-muted-foreground">
                Por <strong>{quote.accepted_by_name}</strong>
                {quote.accepted_at ? ` em ${new Date(quote.accepted_at).toLocaleString("pt-BR")}` : ""}
              </p>
            )}
          </div>
        ) : isClosed || expired ? (
          <div className="rounded-lg border bg-card p-5 text-center text-sm text-muted-foreground">
            Esta proposta não está mais disponível para aceite ({expired ? "expirada" : quote.status.toLowerCase()}).
            Entre em contato com {company.name}.
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-5 text-center shadow-sm">
            <p className="mb-3 text-sm text-muted-foreground">
              Ao aceitar, você concorda com os termos desta proposta.
            </p>
            <Button size="lg" onClick={() => setAcceptOpen(true)}>
              <ShieldCheck className="mr-2 h-5 w-5" />Aceitar proposta
            </Button>
          </div>
        )}

        {company.whatsapp && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                const digits = String(company.whatsapp).replace(/\D/g, "");
                const num = digits.startsWith("55") ? digits : `55${digits}`;
                const msg = `Olá! Estou vendo o orçamento ${quote.quote_number} e gostaria de tirar uma dúvida.`;
                window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />Falar no WhatsApp
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Proposta gerada por SecureERP — link seguro com validação por token.
        </p>
      </div>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceitar proposta {quote.quote_number}</DialogTitle>
            <DialogDescription>
              Confirme seus dados. Eles ficarão registrados como aceite eletrônico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ac-name">Nome completo *</Label>
              <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Como assinaria um contrato" />
            </div>
            <div>
              <Label htmlFor="ac-doc">CPF / CNPJ (opcional)</Label>
              <Input id="ac-doc" value={doc} onChange={(e) => setDoc(e.target.value)} />
            </div>
            <div className="rounded border bg-muted/40 p-3 text-xs text-muted-foreground">
              Valor total: <strong>{fmtBRL(quote.total_amount)}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => acceptMut.mutate()}
              disabled={name.trim().length < 3 || acceptMut.isPending}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
