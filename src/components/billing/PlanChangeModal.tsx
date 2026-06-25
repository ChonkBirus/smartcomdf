import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/hooks/use-toast";
import {
  requestPlanChangeV2,
  type RequestPlanChangeResult,
} from "@/lib/billing-plan-changes.functions";
import type { PlanWithFeatures } from "@/lib/billing.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: PlanWithFeatures | null;
  cycle: "MONTHLY" | "YEARLY";
  currentPlanId?: string | null;
  currentPlanSortOrder?: number;
  onUpgradeCheckout: (plan: PlanWithFeatures) => void;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export function PlanChangeModal({
  open,
  onOpenChange,
  targetPlan,
  cycle,
  currentPlanSortOrder = 0,
  onUpgradeCheckout,
}: Props) {
  const qc = useQueryClient();
  const requestFn = useServerFn(requestPlanChangeV2);
  const [result, setResult] = useState<RequestPlanChangeResult | null>(null);

  const kind = useMemo<"UPGRADE" | "DOWNGRADE" | null>(() => {
    if (!targetPlan) return null;
    return (targetPlan.sort_order ?? 0) > currentPlanSortOrder
      ? "UPGRADE"
      : "DOWNGRADE";
  }, [targetPlan, currentPlanSortOrder]);

  const amount =
    cycle === "YEARLY"
      ? (targetPlan?.annual_price ?? 0)
      : (targetPlan?.monthly_price ?? 0);

  const mutation = useMutation({
    mutationFn: () =>
      requestFn({
        data: {
          plan_slug: (targetPlan?.slug ?? "starter") as
            | "starter"
            | "pro"
            | "business",
          billing_cycle: cycle,
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["billing"] });
      if (res.kind === "UPGRADE" && res.requires_checkout && targetPlan) {
        onOpenChange(false);
        onUpgradeCheckout(targetPlan);
      } else if (res.kind === "DOWNGRADE") {
        toast({
          title: "Downgrade agendado",
          description: `O plano será alterado em ${fmtDate(res.scheduled_at)}.`,
        });
      } else if (res.kind === "NOOP") {
        toast({ title: "Sem alterações", description: res.reason });
        onOpenChange(false);
      }
    },
    onError: (err: any) => {
      toast({
        title: "Não foi possível alterar o plano",
        description: err?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  if (!targetPlan) return null;
  const Icon = kind === "UPGRADE" ? ArrowUpCircle : ArrowDownCircle;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setResult(null);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {kind === "UPGRADE" ? "Upgrade de plano" : "Downgrade de plano"}
          </DialogTitle>
          <DialogDescription>
            {kind === "UPGRADE"
              ? `Você fará upgrade para ${targetPlan.name} (${cycle === "YEARLY" ? "anual" : "mensal"}). O novo plano será ativado imediatamente após a confirmação do pagamento.`
              : `O downgrade para ${targetPlan.name} será aplicado ao final do ciclo atual. Você continuará usando o plano atual até lá.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium">{targetPlan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ciclo</span>
              <span className="font-medium">
                {cycle === "YEARLY" ? "Anual" : "Mensal"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-semibold">
                {fmt(amount)}
                {cycle === "YEARLY" ? "/ano" : "/mês"}
              </span>
            </div>
          </div>

          {kind === "DOWNGRADE" ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Verifique seus limites</AlertTitle>
              <AlertDescription>
                Se o uso atual (usuários, OCR, importações, OSs) exceder os
                limites do plano de destino, o agendamento será recusado.
              </AlertDescription>
            </Alert>
          ) : null}

          {result?.kind === "DOWNGRADE" ? (
            <Alert>
              <AlertTitle>Downgrade agendado</AlertTitle>
              <AlertDescription>
                Mudança efetiva em {fmtDate(result.scheduled_at)}.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Processando..."
              : kind === "UPGRADE"
                ? "Continuar para pagamento"
                : "Agendar downgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
