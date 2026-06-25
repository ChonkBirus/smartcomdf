import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowUpRight, Clock } from "lucide-react";
import { SubscriptionStatusBadge } from "@/components/billing/SubscriptionStatusBadge";
import { SubscriptionUsageCards } from "@/components/billing/SubscriptionUsageCards";
import { BillingChargesTable } from "@/components/billing/BillingChargesTable";
import {
  getCurrentCompanySubscription,
  getCompanySubscriptionUsage,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/settings/subscription")({
  head: () => ({ meta: [{ title: "Assinatura — SecureERP" }] }),
  component: SubscriptionPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";
const daysUntil = (s: string | null | undefined) => {
  if (!s) return null;
  const ms = new Date(s).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
};

function SubscriptionPage() {
  const navigate = useNavigate();
  const subFn = useServerFn(getCurrentCompanySubscription);
  const usageFn = useServerFn(getCompanySubscriptionUsage);

  const { data: sub, isLoading } = useQuery({
    queryKey: ["billing", "current-subscription"],
    queryFn: () => subFn(),
  });
  const { data: usage } = useQuery({
    queryKey: ["billing", "current-usage"],
    queryFn: () => usageFn(),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando assinatura...</div>;
  }

  if (!sub) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sem assinatura</AlertTitle>
        <AlertDescription>
          Não encontramos uma assinatura para esta empresa.{" "}
          <Link to="/billing/plans" className="underline">
            Ver planos
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  const trialDays = sub.status === "TRIALING" ? daysUntil(sub.trial_ends_at) : null;
  const graceDays = sub.status === "PAST_DUE" ? daysUntil(sub.grace_period_ends_at) : null;

  return (
    <div className="space-y-6">
      {sub.status === "TRIALING" && trialDays !== null ? (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Você está em período de teste</AlertTitle>
          <AlertDescription>
            Restam <strong>{trialDays} dia(s)</strong> do trial Pro. Termina em{" "}
            {fmtDate(sub.trial_ends_at)}.
          </AlertDescription>
        </Alert>
      ) : null}

      {sub.status === "PAST_DUE" ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pagamento pendente</AlertTitle>
          <AlertDescription>
            Regularize até {fmtDate(sub.grace_period_ends_at)} (
            {graceDays ?? 0} dia(s) restantes) para evitar suspensão.
          </AlertDescription>
        </Alert>
      ) : null}

      {sub.status === "SUSPENDED" ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Assinatura suspensa</AlertTitle>
          <AlertDescription>
            Sua assinatura está suspensa por pendência de pagamento. Regularize para voltar a
            utilizar o sistema.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">{sub.plan_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ciclo: {sub.billing_cycle === "MONTHLY" ? "Mensal" : "Anual"}
            </p>
          </div>
          <SubscriptionStatusBadge status={sub.status} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Valor mensal" value={fmt(sub.monthly_price)} />
          <Info
            label="Valor anual"
            value={sub.yearly_price ? fmt(sub.yearly_price) : "—"}
          />
          <Info label="Próxima cobrança" value={fmtDate(sub.next_billing_date)} />
          <Info label="Fim do período" value={fmtDate(sub.current_period_end)} />

          {sub.trial_ends_at ? (
            <Info label="Fim do trial" value={fmtDate(sub.trial_ends_at)} />
          ) : null}
          {sub.grace_period_ends_at ? (
            <Info label="Fim da tolerância" value={fmtDate(sub.grace_period_ends_at)} />
          ) : null}
          {sub.activated_at ? (
            <Info label="Ativada em" value={fmtDate(sub.activated_at)} />
          ) : null}
          {sub.canceled_at ? (
            <Info label="Cancelada em" value={fmtDate(sub.canceled_at)} />
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Uso atual</h3>
        <SubscriptionUsageCards
          usage={
            usage ?? {
              users_count: 0,
              storage_used_mb: 0,
              ocr_used_count: 0,
              imports_used_count: 0,
              service_orders_count: 0,
            }
          }
          limits={sub.limits}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate({ to: "/billing/plans" })}>
          <ArrowUpRight className="mr-2 h-4 w-4" />
          Alterar plano
        </Button>
        {sub.status === "PAST_DUE" || sub.status === "SUSPENDED" ? (
          <Button variant="default">Regularizar pagamento</Button>
        ) : null}
        <Button variant="outline">Falar com suporte</Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
