import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { scheduleCancellation } from "@/lib/billing-cancellation.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd: string | null | undefined;
};

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export function CancelSubscriptionDialog({ open, onOpenChange, periodEnd }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fn = useServerFn(scheduleCancellation);

  const mut = useMutation({
    mutationFn: () => fn({ data: { reason: reason.trim() || undefined, immediate } }),
    onSuccess: (res) => {
      toast.success(
        res.immediate
          ? "Assinatura cancelada."
          : `Cancelamento agendado para ${fmtDate(res.effective_at)}.`,
      );
      qc.invalidateQueries({ queryKey: ["billing"] });
      onOpenChange(false);
      setReason("");
      setImmediate(false);
      setConfirmed(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar assinatura
          </DialogTitle>
          <DialogDescription>
            Por padrão, o cancelamento é agendado para o fim do período já pago (
            {fmtDate(periodEnd)}). Você continua com acesso até lá.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Conte por que está cancelando — nos ajuda a melhorar."
              rows={3}
              maxLength={2000}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={immediate} onCheckedChange={(v) => setImmediate(v === true)} />
            <span>
              Cancelar <strong>imediatamente</strong> (perde acesso agora; sem reembolso do período
              em curso).
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>Entendo que poderei reativar a assinatura voltando a contratar um plano.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending
              ? "Processando..."
              : immediate
                ? "Cancelar agora"
                : "Agendar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
