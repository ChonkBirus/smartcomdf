import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { CheckoutDialog } from "./CheckoutDialog";
import type { CurrentSubscription } from "@/lib/billing.functions";

type Props = Omit<ButtonProps, "onClick" | "children"> & {
  sub: CurrentSubscription;
  label?: string;
};

export function RegularizeSubscriptionButton({ sub, label = "Regularizar assinatura", ...btn }: Props) {
  const [open, setOpen] = useState(false);
  const slug = (sub.plan_slug || "pro") as "starter" | "pro" | "business";
  const cycle = (sub.billing_cycle ?? "MONTHLY") as "MONTHLY" | "YEARLY";

  return (
    <>
      <Button {...btn} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <CheckoutDialog
        open={open}
        onOpenChange={setOpen}
        planSlug={slug}
        planName={sub.plan_name}
        cycle={cycle}
      />
    </>
  );
}
