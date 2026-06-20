import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({ title, value, icon, trend, hint }: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  hint?: string;
}) {
  return (
    <Card className="card-elevated">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {icon && (
            <div className="brand-gradient flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground">
              {icon}
            </div>
          )}
        </div>
        {trend && (
          <p className={cn("mt-3 text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "▲" : "▼"} {trend.value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
