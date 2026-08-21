import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PlanLimits, SubscriptionUsage } from "@/lib/billing.functions";

type Props = {
  usage: SubscriptionUsage;
  limits: PlanLimits | null;
};

function UsageCard({
  title,
  used,
  limit,
  suffix,
}: {
  title: string;
  used: number;
  limit: number | null | undefined;
  suffix?: string;
}) {
  const limitLabel =
    limit === null || limit === undefined ? "ilimitado" : `${limit}${suffix ?? ""}`;
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = limit !== null && limit !== undefined && limit > 0 && used >= limit;
  return (
    <Card className="card-elevated">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used}
          {suffix ?? ""}
          <span className="ml-1 text-sm font-normal text-muted-foreground">/ {limitLabel}</span>
        </div>
        {limit && limit > 0 ? (
          <Progress value={pct} className={`mt-3 ${over ? "[&>div]:bg-destructive" : ""}`} />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SubscriptionUsageCards({ usage, limits }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UsageCard title="Usuários ativos" used={usage.users_count} limit={limits?.max_users} />
      <UsageCard title="OCR no mês" used={usage.ocr_used_count} limit={limits?.monthly_ocr_limit} />
      <UsageCard
        title="Importações no mês"
        used={usage.imports_used_count}
        limit={limits?.monthly_import_limit}
      />
      <UsageCard
        title="Ordens de serviço no mês"
        used={usage.service_orders_count}
        limit={limits?.monthly_service_order_limit}
      />
    </div>
  );
}
