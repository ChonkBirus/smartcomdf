import { Link } from "@tanstack/react-router";
import { AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CurrentSubscription } from "@/lib/billing.functions";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function SubscriptionBanner({ sub }: { sub: CurrentSubscription | null }) {
  if (!sub) return null;

  if (sub.status === "TRIALING") {
    const left = daysUntil(sub.trial_ends_at);
    if (left === null || left < 0) return null;
    return (
      <div className="flex items-center justify-between gap-3 border-b border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Clock className="h-4 w-4" />
          <span>
            Você está em período de avaliação. {left === 0 ? "Termina hoje" : `Restam ${left} ${left === 1 ? "dia" : "dias"}`} do seu trial do plano <strong>{sub.plan_name}</strong>.
          </span>
        </div>
        <Button asChild size="sm" variant="default">
          <Link to="/billing/plans">Escolher plano</Link>
        </Button>
      </div>
    );
  }

  if (sub.status === "PAST_DUE") {
    const left = daysUntil(sub.grace_period_ends_at);
    return (
      <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          <span>
            Pagamento pendente.{" "}
            {left !== null && left >= 0
              ? `Você tem ${left} ${left === 1 ? "dia" : "dias"} de tolerância para regularizar antes da suspensão.`
              : "Regularize agora para evitar a suspensão da conta."}
          </span>
        </div>
        <Button asChild size="sm" variant="default">
          <Link to="/settings/subscription">Regularizar</Link>
        </Button>
      </div>
    );
  }

  return null;
}
