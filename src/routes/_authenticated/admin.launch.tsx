import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getLaunchChecklist,
  toggleLaunchChecklistItem,
  getLaunchReadiness,
  type LaunchChecklistItem,
} from "@/lib/commercial-launch.functions";

export const Route = createFileRoute("/_authenticated/admin/launch")({
  head: () => ({ meta: [{ title: "Lançamento Comercial — Super Admin" }] }),
  component: LaunchPage,
});

function LaunchPage() {
  const qc = useQueryClient();
  const fetchChecklist = useServerFn(getLaunchChecklist);
  const fetchReadiness = useServerFn(getLaunchReadiness);
  const toggleFn = useServerFn(toggleLaunchChecklistItem);

  const { data: checklist = [] } = useQuery({
    queryKey: ["admin", "launch-checklist"],
    queryFn: () => fetchChecklist(),
  });
  const { data: readiness } = useQuery({
    queryKey: ["admin", "launch-readiness"],
    queryFn: () => fetchReadiness(),
  });

  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; completed: boolean }) =>
      toggleFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "launch-checklist"] });
      qc.invalidateQueries({ queryKey: ["admin", "launch-readiness"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar item"),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Prontidão para lançamento</h2>
        </div>
        {readiness && (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Checklist concluído</span>
                <span className="font-medium">
                  {readiness.checklistDone}/{readiness.checklistTotal} ({readiness.checklistPercent}%)
                </span>
              </div>
              <Progress value={readiness.checklistPercent} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ReadinessFlag label="Gateway configurado" ok={readiness.providerConfigured} />
              <ReadinessFlag label="Planos ativos" ok={readiness.hasActivePlan} />
              <ReadinessFlag label="Termos e Privacidade" ok={readiness.hasTermsAndPrivacy} />
              <ReadinessFlag label="Canais de suporte" ok={readiness.hasSupportChannels} />
              <ReadinessFlag label="Régua de cobrança" ok={readiness.hasActiveDunningRules} />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              <Metric label="Pilotos ativos" value={readiness.activePilots} />
              <Metric label="Convertidos" value={readiness.convertedPilots} />
              <Metric label="Perdidos" value={readiness.lostPilots} />
            </div>
          </>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Checklist de lançamento</h2>
        <div className="space-y-2">
          {checklist.map((item: LaunchChecklistItem) => (
            <label
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-muted/40 cursor-pointer"
            >
              <Checkbox
                checked={item.completed}
                onCheckedChange={(c) =>
                  toggleMut.mutate({ id: item.id, completed: !!c })
                }
                disabled={toggleMut.isPending}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={item.completed ? "line-through text-muted-foreground" : "font-medium"}>
                    {item.title}
                  </span>
                  {item.completed && item.completed_at && (
                    <Badge variant="secondary" className="text-xs">
                      {new Date(item.completed_at).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                )}
              </div>
            </label>
          ))}
          {checklist.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item do checklist.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function ReadinessFlag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span>{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
