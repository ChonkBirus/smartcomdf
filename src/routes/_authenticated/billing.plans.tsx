import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { PlanCard } from "@/components/billing/PlanCard";
import { BillingCycleToggle } from "@/components/billing/BillingCycleToggle";
import {
  listPlansWithFeatures,
  getCurrentCompanySubscription,
  requestPlanChange,
  type PlanWithFeatures,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/billing/plans")({
  head: () => ({ meta: [{ title: "Planos — SecureERP" }] }),
  component: PlansPage,
});

function PlansPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const plansFn = useServerFn(listPlansWithFeatures);
  const subFn = useServerFn(getCurrentCompanySubscription);
  const requestFn = useServerFn(requestPlanChange);

  const { data: plans } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => plansFn(),
  });
  const { data: sub } = useQuery({
    queryKey: ["billing", "current-subscription"],
    queryFn: () => subFn(),
  });

  const m = useMutation({
    mutationFn: (plan: PlanWithFeatures) =>
      requestFn({ data: { plan_slug: plan.slug as "starter" | "pro" | "business", billing_cycle: cycle } }),
    onSuccess: () => {
      toast.success("Solicitação registrada", {
        description: "A alteração de plano será concluída na etapa de pagamento (Fase 2.7B).",
      });
      qc.invalidateQueries({ queryKey: ["billing"] });
      navigate({ to: "/settings/subscription" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao solicitar alteração"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para sua operação. A cobrança real será integrada na próxima fase."
      />

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
            disabled={m.isPending}
            onSelect={(plan) => m.mutate(plan)}
          />
        ))}
      </div>
    </div>
  );
}
