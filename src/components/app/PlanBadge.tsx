import { Crown, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/lib/features";
import { cn } from "@/lib/utils";

export function PlanBadge({ className }: { className?: string }) {
  const plan = usePlan();
  if (!plan) return null;
  const slug = plan.slug;
  const Icon = slug === "business" ? Crown : slug === "pro" ? Sparkles : Zap;
  const tone =
    slug === "business"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
      : slug === "pro"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-muted text-muted-foreground border-border";

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-semibold", tone, className)}>
      <Icon className="h-3 w-3" />
      {plan.name}
    </Badge>
  );
}
