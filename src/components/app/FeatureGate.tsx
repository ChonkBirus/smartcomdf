import type { ReactNode } from "react";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFeatures, type FeatureCode } from "@/lib/features";

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

export function FeatureBlocked({ feature }: { feature: FeatureCode }) {
  const { openUpgrade } = useFeatures();
  const label = FEATURE_LABELS[feature] ?? feature;

  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center py-12">
      <Card className="card-elevated w-full">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Recurso Premium
            </div>
            <h2 className="text-2xl font-bold">{label} não está disponível</h2>
            <p className="text-sm text-muted-foreground">
              Esta funcionalidade não está incluída no seu plano atual.
              Faça upgrade para desbloquear {label} e outros recursos avançados.
            </p>
          </div>
          <Button onClick={() => openUpgrade(feature)} className="brand-gradient text-primary-foreground">
            <Sparkles className="mr-2 h-4 w-4" />
            Ver planos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function FeatureGate({
  feature,
  children,
  fallback,
}: {
  feature: FeatureCode;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasFeature } = useFeatures();
  if (!hasFeature(feature)) return <>{fallback ?? <FeatureBlocked feature={feature} />}</>;
  return <>{children}</>;
}
