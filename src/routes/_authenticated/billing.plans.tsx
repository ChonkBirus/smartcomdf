import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/PageHeader";
import { PlanCard } from "@/components/billing/PlanCard";
import { BillingCycleToggle } from "@/components/billing/BillingCycleToggle";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import {
  listPlansWithFeatures,
  getCurrentCompanySubscription,
  type PlanWithFeatures,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/billing/plans")({
  head: () => ({ meta: [{ title: "Planos — SecureERP" }] }),
  component: PlansPage,
});

function PlansPage() {
  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selected, setSelected] = useState<PlanWithFeatures | null>(null);

  const plansFn = useServerFn(listPlansWithFeatures);
  const subFn = useServerFn(getCurrentCompanySubscription);

  const { data: plans } = useQuery({
    queryKey: ["billing", "plans"],
    queryFn: () => plansFn(),
  });
  const { data: sub } = useQuery({
    queryKey: ["billing", "current-subscription"],
    queryFn: () => subFn(),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para sua operação. A ativação ocorre após a confirmação do pagamento."
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
            disabled={false}
            onSelect={(plan) => setSelected(plan)}
          />
        ))}
      </div>

      {selected && (
        <CheckoutDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          planSlug={selected.slug as "starter" | "pro" | "business"}
          planName={selected.name}
          cycle={cycle}
        />
      )}
    </div>
  );
}
