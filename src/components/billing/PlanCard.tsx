import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanWithFeatures } from "@/lib/billing.functions";

type Props = {
  plan: PlanWithFeatures;
  cycle: "MONTHLY" | "YEARLY";
  recommended?: boolean;
  current?: boolean;
  onSelect?: (plan: PlanWithFeatures) => void;
  disabled?: boolean;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LIMIT_LABELS: { key: keyof NonNullable<PlanWithFeatures["limits"]>; label: string; suffix?: string }[] = [
  { key: "max_users", label: "Usuários" },
  { key: "storage_gb", label: "Armazenamento", suffix: " GB" },
  { key: "monthly_ocr_limit", label: "OCR/mês" },
  { key: "monthly_import_limit", label: "Importações/mês" },
];

export function PlanCard({ plan, cycle, recommended, current, onSelect, disabled }: Props) {
  const monthlyEquivalent =
    cycle === "YEARLY" && plan.annual_price > 0 ? plan.annual_price / 12 : plan.monthly_price;
  const totalLabel =
    cycle === "YEARLY"
      ? `${fmt(plan.annual_price)}/ano`
      : `${fmt(plan.monthly_price)}/mês`;

  const features = plan.features.filter((f) => f.enabled).slice(0, 8);

  return (
    <Card
      className={cn(
        "card-elevated relative flex flex-col",
        recommended && "border-2 border-primary shadow-lg",
      )}
    >
      {recommended ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Mais recomendado
        </div>
      ) : null}
      <CardHeader>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        {plan.description ? (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <div className="text-3xl font-bold text-primary">
            {fmt(monthlyEquivalent)}
            <span className="text-sm font-normal text-muted-foreground">/mês</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {cycle === "YEARLY" ? `Cobrado ${totalLabel}` : totalLabel}
          </div>
        </div>

        {plan.limits ? (
          <ul className="space-y-1 border-t border-border pt-3 text-sm">
            {LIMIT_LABELS.map(({ key, label, suffix }) => {
              const v = plan.limits?.[key];
              const display = v === null || v === undefined ? "Ilimitado" : `${v}${suffix ?? ""}`;
              return (
                <li key={key} className="flex justify-between text-muted-foreground">
                  <span>{label}</span>
                  <span className="font-medium text-foreground">{display}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {features.length > 0 ? (
          <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
            {features.map((f) => (
              <li key={f.code} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto pt-2">
          <Button
            className="w-full"
            variant={current ? "outline" : recommended ? "default" : "secondary"}
            disabled={disabled || current}
            onClick={() => onSelect?.(plan)}
          >
            {current ? "Plano atual" : "Escolher plano"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
