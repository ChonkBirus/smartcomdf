import { cn } from "@/lib/utils";

type Props = {
  value: "MONTHLY" | "YEARLY";
  onChange: (v: "MONTHLY" | "YEARLY") => void;
};

export function BillingCycleToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {(["MONTHLY", "YEARLY"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt === "MONTHLY" ? "Mensal" : "Anual"}
          {opt === "YEARLY" ? (
            <span className="ml-1 text-xs opacity-80">(2 meses grátis)</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
