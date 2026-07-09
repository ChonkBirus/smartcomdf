import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Eye, XCircle, FileText, ShieldCheck } from "lucide-react";
import {
  approveQuotePayment,
  rejectQuotePaymentReceipt,
  getQuoteReceiptSignedUrl,
} from "@/lib/quote-payments.functions";
import { usePermissions } from "@/lib/permissions";

type PaymentWithReceipt = {
  id: string;
  amount: number;
  payment_status: string;
  payer_name?: string | null;
  payment_date?: string | null;
  receipt_file_path?: string | null;
  receipt_status?: string | null;
  receipt_uploaded_at?: string | null;
  receipt_rejection_reason?: string | null;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ReceiptBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; v: "default" | "secondary" | "destructive" }> = {
    PENDING_REVIEW: { label: "Aguardando revisão", v: "secondary" },
    APPROVED: { label: "Comprovante aprovado", v: "default" },
    REJECTED: { label: "Comprovante rejeitado", v: "destructive" },
  };
  const m = map[status];
  if (!m) return null;
  return <Badge variant={m.v}>{m.label}</Badge>;
}

export function QuotePaymentReceiptReview({
  payments,
  quoteId,
}: {
  payments: PaymentWithReceipt[];
  quoteId: string;
}) {
  const qc = useQueryClient();
  const { has, isSuperAdmin, isOwner } = usePermissions();
  const approve = useServerFn(approveQuotePayment);
  const reject = useServerFn(rejectQuotePaymentReceipt);
  const getUrl = useServerFn(getQuoteReceiptSignedUrl);

  const canManage =
    isSuperAdmin || isOwner || has("finance.receivables.manage") || has("finance.manage");

  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const withReceipt = (payments ?? []).filter((p) => p.receipt_file_path);
  if (withReceipt.length === 0) return null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["quote-payments", quoteId] });
    qc.invalidateQueries({ queryKey: ["quote", quoteId, "for-send"] });
    qc.invalidateQueries({ queryKey: ["quotes"] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  }

  const viewMut = useMutation({
    mutationFn: async (id: string) => getUrl({ data: { payment_id: id } }),
    onSuccess: (res: any) => {
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error("Não foi possível abrir o comprovante.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar link."),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { id } }),
    onSuccess: () => { toast.success("Pagamento aprovado."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aprovar."),
  });

  const rejectMut = useMutation({
    mutationFn: (args: { id: string; reason: string }) =>
      reject({ data: { id: args.id, reason: args.reason || undefined } }),
    onSuccess: () => {
      toast.success("Comprovante rejeitado.");
      setRejectOpen(null); setReason(""); invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao rejeitar."),
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />Comprovantes recebidos
      </div>
      <ul className="space-y-3">
        {withReceipt.map((p) => {
          const canDecide = canManage && p.receipt_status === "PENDING_REVIEW";
          return (
            <li key={p.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">{fmtBRL(Number(p.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.payer_name ? `${p.payer_name} · ` : ""}
                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString("pt-BR") : ""}
                  </p>
                  {p.receipt_rejection_reason && (
                    <p className="mt-1 text-xs text-destructive">
                      Motivo: {p.receipt_rejection_reason}
                    </p>
                  )}
                </div>
                <ReceiptBadge status={p.receipt_status} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewMut.mutate(p.id)}
                  disabled={viewMut.isPending}
                >
                  <Eye className="mr-1 h-4 w-4" />Ver comprovante
                </Button>
                {canDecide && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approveMut.mutate(p.id)}
                      disabled={approveMut.isPending}
                    >
                      <ShieldCheck className="mr-1 h-4 w-4" />Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectOpen(p.id)}
                    >
                      <XCircle className="mr-1 h-4 w-4" />Rejeitar
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar comprovante</DialogTitle>
            <DialogDescription>
              Informe o motivo. O cliente poderá enviar um novo comprovante.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: valor não confere, comprovante ilegível…"
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => rejectOpen && rejectMut.mutate({ id: rejectOpen, reason })}
              disabled={rejectMut.isPending}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
