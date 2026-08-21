import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui/page-header";
import { PlanCard } from "@/components/billing/PlanCard";
import { BillingCycleToggle } from "@/components/billing/BillingCycleToggle";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { PlanChangeModal } from "@/components/billing/PlanChangeModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import {
  listPlansWithFeatures,
  getCurrentCompanySubscription,
  type PlanWithFeatures,
} from "@/lib/billing.functions";
import {
  getPendingPlanChange,
  cancelPendingPlanChange,
} from "@/lib/billing-plan-changes.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing/plans")({
  head: () => ({ meta: [{ title: "Planos — SmartPro" }] }),
  component: PlansPage,
});

function PlansPage() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [picking, setPicking] = useState<PlanWithFeatures | null>(null);
  const [checkout, setCheckout] = useState<PlanWithFeatures | null>(null);

  const plansFn = useServerFn(listPlansWithFeatures);
  const subFn = useServerFn(getCurrentCompanySubscription);
  const pendingFn = useServerFn(getPendingPlanChange);
  const cancelFn = useServerFn(cancelPendingPlanChange);

  const { data: plans } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => plansFn(),
  });
  const { data: sub } = useQuery({
    queryKey: ["billing", "current-subscription"],
    queryFn: () => subFn(),
  });
  const { data: pending } = useQuery({
    queryKey: ["billing", "pending-plan-change"],
    queryFn: () => pendingFn(),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => {
      toast.success("Alteração pendente cancelada.");
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar"),
  });

  const currentSort = plans?.find((p) => p.id === sub?.plan_id)?.sort_order ?? 0;

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para sua operação. A ativação ocorre após a confirmação do pagamento."
      />

      {pending ? (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>
            {pending.pending_plan_change_type === "UPGRADE"
              ? "Upgrade pendente"
              : "Downgrade agendado"}{" "}
            — {pending.pending_plan_name}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              Efetivo em {fmtDate(pending.pending_plan_change_at)} (
              {pending.pending_plan_billing_cycle === "YEARLY" ? "anual" : "mensal"}
              ).
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}
            >
              Cancelar alteração
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-center">
        <BillingCycleToggle value={cycle} onChange={setCycle} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {(plans ?? []).map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={cycle}
            recommended={p.slug === "pro"}
            current={sub?.plan_id === p.id}
            disabled={!!pending}
            onSelect={(plan) => {
              if (!sub) {
                setCheckout(plan);
                return;
              }
              setPicking(plan);
            }}
          />
        ))}
      </div>

      {picking && (
        <PlanChangeModal
          open={!!picking}
          onOpenChange={(v) => !v && setPicking(null)}
          targetPlan={picking}
          cycle={cycle}
          currentPlanId={sub?.plan_id}
          currentPlanSortOrder={currentSort}
          onUpgradeCheckout={(plan) => {
            setPicking(null);
            setCheckout(plan);
          }}
        />
      )}

      {checkout && (
        <CheckoutDialog
          open={!!checkout}
          onOpenChange={(v) => !v && setCheckout(null)}
          planSlug={checkout.slug as "starter" | "pro" | "business"}
          planName={checkout.name}
          cycle={cycle}
        />
      )}
    </div>
  );
}
