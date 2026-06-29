import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import {
  getProductionChecklist,
  updateProductionChecklistItem,
} from "@/lib/homologation.functions";
import { useCompanyId } from "@/hooks/use-company-id";

export const Route = createFileRoute("/_authenticated/settings/homologation")({
  head: () => ({ meta: [{ title: "Homologação — SmartCom Pro" }] }),
  component: HomologationPage,
});

function HomologationPage() {
  return (
    <PermissionRoute module="settings" action="manage">
      <HomologationContent />
    </PermissionRoute>
  );
}

type Item = {
  id: string;
  code: string;
  title: string;
  status: "pending" | "done";
  note: string | null;
  responsible: string | null;
  completed_at: string | null;
};

function HomologationContent() {
  const qc = useQueryClient();
  const fetchList = useServerFn(getProductionChecklist);
  const updateFn = useServerFn(updateProductionChecklistItem);

  const companyId = useCompanyId();
  const q = useQuery({
    queryKey: ["homologation-checklist", companyId],
    queryFn: () => fetchList(),
    enabled: !!companyId,
  });

  const mut = useMutation({
    mutationFn: (vars: {
      id: string;
      status?: "pending" | "done";
      note?: string | null;
      responsible?: string | null;
    }) => updateFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["homologation-checklist", companyId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const items = (q.data?.items ?? []) as Item[];
  const total = q.data?.total ?? 0;
  const done = q.data?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Checklist de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Use este checklist para homologar sua operação antes de receber clientes pagantes.
            </span>
            <Badge variant="secondary">
              {done}/{total} ({pct}%)
            </Badge>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              disabled={mut.isPending}
              onUpdate={(patch) => mut.mutate({ id: item.id, ...patch })}
            />
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  disabled,
  onUpdate,
}: {
  item: Item;
  disabled: boolean;
  onUpdate: (patch: {
    status?: "pending" | "done";
    note?: string | null;
    responsible?: string | null;
  }) => void;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const [responsible, setResponsible] = useState(item.responsible ?? "");
  const isDone = item.status === "done";
  const completedLabel = useMemo(
    () => (item.completed_at ? new Date(item.completed_at).toLocaleDateString("pt-BR") : null),
    [item.completed_at],
  );

  return (
    <Card className="card-elevated">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Checkbox
            checked={isDone}
            disabled={disabled}
            onCheckedChange={(c) => onUpdate({ status: c ? "done" : "pending" })}
            className="mt-1"
            aria-label={`Marcar ${item.title}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={isDone ? "line-through text-muted-foreground" : "font-medium"}>
                {item.title}
              </span>
              {completedLabel && (
                <Badge variant="secondary" className="text-xs">{completedLabel}</Badge>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr]">
              <Input
                placeholder="Responsável"
                value={responsible}
                disabled={disabled}
                onChange={(e) => setResponsible(e.target.value)}
                onBlur={() => {
                  if ((item.responsible ?? "") !== responsible) {
                    onUpdate({ responsible: responsible || null });
                  }
                }}
              />
              <Textarea
                placeholder="Observação"
                value={note}
                rows={2}
                disabled={disabled}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if ((item.note ?? "") !== note) {
                    onUpdate({ note: note || null });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
