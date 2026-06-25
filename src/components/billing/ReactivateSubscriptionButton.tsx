import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { reactivateSubscription } from "@/lib/billing-cancellation.functions";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";

type Props = {
  planName: string;
  variant?: "default" | "outline";
};

export function ReactivateSubscriptionButton({ planName, variant = "default" }: Props) {
  const qc = useQueryClient();
  const fn = useServerFn(reactivateSubscription);
  const [checkout, setCheckout] = useState<{
    open: boolean;
    plan_slug: "starter" | "pro" | "business";
    cycle: "MONTHLY" | "YEARLY";
  } | null>(null);

  const mut = useMutation({
    mutationFn: () => fn(),
    onSuccess: (res) => {
      if (res.kind === "REACTIVATED") {
        toast.success("Assinatura reativada.");
        qc.invalidateQueries({ queryKey: ["billing"] });
        return;
      }
      setCheckout({
        open: true,
        plan_slug: res.plan_slug as "starter" | "pro" | "business",
        cycle: res.billing_cycle,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reativar."),
  });

  return (
    <>
      <Button
        variant={variant}
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        {mut.isPending ? "Reativando..." : "Reativar assinatura"}
      </Button>
      {checkout ? (
        <CheckoutDialog
          open={checkout.open}
          onOpenChange={(o) =>
            setCheckout((s) => (s ? { ...s, open: o } : s))
          }
          planSlug={checkout.plan_slug}
          planName={planName}
          cycle={checkout.cycle}
        />
      ) : null}
    </>
  );
}
