import { Calendar, Clock, AlertTriangle, Sparkles, Users, HardDrive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlanBadge } from "./PlanBadge";
import { useFeatures, useSubscription, usePlan } from "@/lib/features";
import { getCompanyUsage } from "@/lib/billing.functions";

export function SubscriptionCard() {
  const { subscription, plan, expiresAt, daysLeft, expired, expiringSoon } = useSubscription();
  const { getPlanLimits } = usePlan();
  const { openUpgrade } = useFeatures();
  const usageFn = useServerFn(getCompanyUsage);
  const { data: usage } = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: () => usageFn(),
    enabled: !!plan,
  });

  if (!plan) return null;

  const limits = getPlanLimits();
  const usedUsers = usage?.users ?? 0;
  const userLimitText = limits.max_users === 0 ? "Ilimitado" : `${usedUsers}/${limits.max_users}`;
  const userPct = limits.max_users === 0 ? 0 : Math.min(100, (usedUsers / limits.max_users) * 100);
  const usersFull = limits.max_users > 0 && usedUsers >= limits.max_users;

  return (
    <Card className="card-elevated">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Plano atual</CardTitle>
        <PlanBadge />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">R$ {Number(plan.monthly_price).toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">/mês</span>
          </div>
          {subscription?.trial && (
            <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
              Período de avaliação gratuita
            </div>
          )}
        </div>

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

        <div className="space-y-2 border-t border-border pt-3 text-xs">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3 w-3" /> Usuários
              </span>
              <span className={usersFull ? "font-semibold text-destructive" : "font-medium"}>
                {userLimitText}
              </span>
            </div>
            {limits.max_users > 0 && <Progress value={userPct} className="h-1" />}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="h-3 w-3" /> Armazenamento
              </span>
              <span className="font-medium">{limits.max_storage_gb} GB</span>
            </div>
          </div>
        </div>

        {usersFull && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Limite de usuários atingido. Faça upgrade para adicionar mais.</span>
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
