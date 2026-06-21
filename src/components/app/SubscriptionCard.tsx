import { Calendar, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "./PlanBadge";
import { useFeatures, useSubscription } from "@/lib/features";

export function SubscriptionCard() {
  const { subscription, plan, expiresAt, daysLeft, expired, expiringSoon } = useSubscription();
  const { openUpgrade } = useFeatures();

  if (!plan) return null;

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Plano atual</CardTitle>
        <PlanBadge />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">R$ {Number(plan.monthly_price).toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">/mês</span>
        </div>

        {subscription?.trial && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
            Período de avaliação gratuita
          </div>
        )}

        {expiresAt && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Vence em {expiresAt.toLocaleDateString("pt-BR")}
            </div>
            <div
              className={
                "flex items-center gap-2 font-medium " +
                (expired
                  ? "text-destructive"
                  : expiringSoon
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground")
              }
            >
              {expired ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Plano expirado
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
                </>
              )}
            </div>
          </div>
        )}

        {plan.slug !== "business" && (
          <Button
            onClick={() => openUpgrade()}
            size="sm"
            className="w-full brand-gradient text-primary-foreground"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Fazer upgrade
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
