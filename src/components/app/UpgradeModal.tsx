import { Check, Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeatures, usePlan, useUpgradeDialog } from "@/lib/features";
import { listPlansWithFeatures, requestPlanUpgrade } from "@/lib/billing.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Produtos",
  inventory: "Estoque",
  customers: "Clientes",
  quotes: "Orçamentos",
  crm: "CRM",
  financial: "Financeiro",
  service_orders: "Ordens de Serviço",
  nfe: "Nota Fiscal Eletrônica",
  pix: "PIX",
  reports: "Relatórios",
  settings: "Configurações",
  users: "Usuários",
  notifications: "Notificações",
  audit: "Auditoria",
};

export function UpgradeModal() {
  const { upgradeFor, upgradeOpen, closeUpgrade } = useUpgradeDialog();
  const { plan: currentPlan } = usePlan();
  const { hasFeature } = useFeatures();
  const listFn = useServerFn(listPlansWithFeatures);
  const requestFn = useServerFn(requestPlanUpgrade);

  const { data: plans } = useQuery({
    queryKey: ["billing", "plans-with-features"],
    queryFn: () => listFn(),
    enabled: upgradeOpen,
  });

  const featureLabel = upgradeFor ? (FEATURE_LABELS[upgradeFor] ?? upgradeFor) : null;

  const handleRequest = async (planSlug: string) => {
    try {
      await requestFn({ data: { plan_slug: planSlug, feature_code: upgradeFor ?? undefined } });
      toast.success("Solicitação enviada! Nossa equipe entrará em contato.");
      closeUpgrade();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao solicitar upgrade.");
    }
  };

  return (
    <Dialog open={upgradeOpen} onOpenChange={(o) => !o && closeUpgrade()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Faça upgrade do seu plano
          </DialogTitle>
          <DialogDescription>
            {featureLabel ? (
              <>
                A funcionalidade{" "}
                <span className="font-semibold text-foreground">{featureLabel}</span> não está
                disponível no plano{" "}
                <span className="font-semibold text-foreground">{currentPlan?.name}</span>. Escolha
                um plano superior para liberar o acesso.
              </>
            ) : (
              "Compare os planos disponíveis e escolha o que melhor atende sua empresa."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          {(plans ?? []).map((p) => {
            const isCurrent = p.id === currentPlan?.id;
            const highlight = p.slug === "pro";
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-lg border p-5",
                  highlight ? "border-primary shadow-lg shadow-primary/10" : "border-border",
                  isCurrent && "opacity-70",
                )}
              >
                {highlight && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 brand-gradient text-primary-foreground">
                    Mais popular
                  </Badge>
                )}
                <div className="mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.name}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      R$ {Number(p.monthly_price).toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>
                </div>
                <ul className="mb-4 flex-1 space-y-1.5 text-xs">
                  {p.features.map((f) => {
                    const enabled = f.enabled;
                    return (
                      <li
                        key={f.code}
                        className={cn(
                          "flex items-center gap-2",
                          enabled ? "text-foreground" : "text-muted-foreground/60 line-through",
                        )}
                      >
                        {enabled ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {FEATURE_LABELS[f.code] ?? f.code}
                      </li>
                    );
                  })}
                </ul>
                <div className="mb-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div>Usuários: {p.max_users || "Ilimitado"}</div>
                  <div>Armazenamento: {p.max_storage_gb} GB</div>
                </div>
                <Button
                  onClick={() => handleRequest(p.slug)}
                  disabled={isCurrent}
                  variant={highlight ? "default" : "outline"}
                  className={cn("w-full", highlight && "brand-gradient text-primary-foreground")}
                >
                  {isCurrent ? "Plano atual" : "Solicitar upgrade"}
                </Button>
                {upgradeFor && !hasFeature(upgradeFor) && (
                  <div className="mt-2 text-center text-nano text-muted-foreground">
                    {p.features.find((f) => f.code === upgradeFor)?.enabled ? (
                      <span className="text-success">✓ Inclui {featureLabel}</span>
                    ) : (
                      <span>Não inclui {featureLabel}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
