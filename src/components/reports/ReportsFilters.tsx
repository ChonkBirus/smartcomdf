import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarRange } from "lucide-react";

export type ReportsPeriod =
  | "today"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type ReportsFiltersValue = {
  period: ReportsPeriod;
  from: string | null;
  to: string | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolvePeriod(
  period: ReportsPeriod,
  from: string | null,
  to: string | null,
): { from: string | null; to: string | null } {
  if (period === "custom") return { from, to };
  const now = new Date();
  let f: Date;
  let t: Date = endOfDay(now);
  switch (period) {
    case "today":
      f = startOfDay(now);
      break;
    case "7d":
      f = startOfDay(new Date(now.getTime() - 6 * 86400000));
      break;
    case "30d":
      f = startOfDay(new Date(now.getTime() - 29 * 86400000));
      break;
    case "this_month":
      f = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      break;
    case "this_year":
      f = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      f = startOfDay(new Date(now.getTime() - 29 * 86400000));
  }
  return { from: f.toISOString(), to: t.toISOString() };
}

const PRESETS: { value: ReportsPeriod; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export function ReportsFilters({
  value,
  onChange,
  onClear,
}: {
  value: ReportsFiltersValue;
  onChange: (next: ReportsFiltersValue) => void;
  onClear: () => void;
}) {
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  function applyPreset(period: ReportsPeriod) {
    if (period === "custom") {
      onChange({ period, from: from || null, to: to || null });
    } else {
      onChange({ period, from: null, to: null });
    }
  }

  function applyCustom() {
    onChange({
      period: "custom",
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to + "T23:59:59").toISOString() : null,
    });
  }

  return (
    <Card className="card-elevated">
      <CardContent className="p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarRange className="h-4 w-4" /> Período
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={value.period === p.value ? "default" : "outline"}
              onClick={() => applyPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {value.period === "custom" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="from">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={applyCustom}>Aplicar</Button>
              <Button variant="ghost" onClick={onClear}>
                Limpar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
