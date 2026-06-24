import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import type { CurrentSubscription } from "@/lib/billing.functions";

const COPY: Record<string, { title: string; description: string }> = {
  SUSPENDED: {
    title: "Conta suspensa",
    description:
      "Sua assinatura foi suspensa por falta de pagamento. Regularize para reativar o acesso ao sistema.",
  },
  CANCELED: {
    title: "Assinatura cancelada",
    description: "Sua assinatura foi cancelada. Escolha um plano para retomar o uso do sistema.",
  },
  EXPIRED: {
    title: "Trial expirado",
    description:
      "Seu período de avaliação chegou ao fim. Escolha um plano para continuar usando o sistema.",
  },
};

export function SubscriptionBlockedScreen({ sub }: { sub: CurrentSubscription }) {
  const copy = COPY[sub.status] ?? COPY.SUSPENDED;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Lock className="h-6 w-6" />
          </div>
          <div className="flex justify-center">
            <SubscriptionStatusBadge status={sub.status} />
          </div>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild size="lg">
            <Link to="/billing/plans">Ver planos disponíveis</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/settings/subscription">Detalhes da assinatura</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
