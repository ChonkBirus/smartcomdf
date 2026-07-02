import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Flame, Snowflake, Thermometer, Calendar, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCrmBoard, moveOpportunityStage, type CrmOpportunity, type CrmStage } from "@/lib/crm.functions";
import { NewOpportunitySheet } from "./NewOpportunitySheet";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { cn } from "@/lib/utils";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TEMP_META: Record<string, { label: string; icon: any; className: string }> = {
  cold: { label: "Frio", icon: Snowflake, className: "text-sky-500" },
  warm: { label: "Morno", icon: Thermometer, className: "text-amber-500" },
  hot: { label: "Quente", icon: Flame, className: "text-destructive" },
};

export function CrmBoard() {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getCrmBoard);
  const move = useServerFn(moveOpportunityStage);
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "board"],
    queryFn: () => fetchBoard(),
    staleTime: 15_000,
  });

  const oppsByStage = useMemo(() => {
    const m = new Map<string, CrmOpportunity[]>();
    for (const o of data?.opportunities ?? []) {
      if (!m.has(o.stage_id)) m.set(o.stage_id, []);
      m.get(o.stage_id)!.push(o);
    }
    return m;
  }, [data?.opportunities]);

  const moveMutation = useMutation({
    mutationFn: async (v: { id: string; stage_id: string }) => await move({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao mover lead."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando funil…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const stages = data.stages;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Funil: <span className="font-medium text-foreground">{data.pipeline.name}</span>
        </div>
        <Button size="sm" onClick={() => { setDefaultStageId(undefined); setOpenNew(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo lead
        </Button>
      </div>

      <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            allStages={stages}
            opportunities={oppsByStage.get(stage.id) ?? []}
            onSelect={setSelectedId}
            onMove={(id, stage_id) => moveMutation.mutate({ id, stage_id })}
            onAdd={() => { setDefaultStageId(stage.id); setOpenNew(true); }}
          />
        ))}
      </div>

      <NewOpportunitySheet
        open={openNew}
        onOpenChange={setOpenNew}
        pipelineId={data.pipeline.id}
        defaultStageId={defaultStageId}
      />
      <OpportunityDrawer
        opportunityId={selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
      />
    </div>
  );
}

function StageColumn({
  stage,
  allStages,
  opportunities,
  onSelect,
  onMove,
  onAdd,
}: {
  stage: CrmStage;
  allStages: CrmStage[];
  opportunities: CrmOpportunity[];
  onSelect: (id: string) => void;
  onMove: (id: string, stage_id: string) => void;
  onAdd: () => void;
}) {
  const total = opportunities.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
  const accent = stage.is_won
    ? "border-t-success"
    : stage.is_lost
    ? "border-t-destructive"
    : "border-t-primary";

  return (
    <div className="w-72 shrink-0 snap-start">
      <div className={cn("rounded-lg border border-border border-t-4 bg-card p-3", accent)}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{stage.name}</div>
            <div className="text-xs text-muted-foreground">
              {opportunities.length} · {brl(total)}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {opportunities.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Sem leads
            </div>
          )}
          {opportunities.map((o) => (
            <OpportunityCard
              key={o.id}
              opp={o}
              stages={allStages}
              onOpen={() => onSelect(o.id)}
              onMove={(sid) => onMove(o.id, sid)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({
  opp,
  stages,
  onOpen,
  onMove,
}: {
  opp: CrmOpportunity;
  stages: CrmStage[];
  onOpen: () => void;
  onMove: (stage_id: string) => void;
}) {
  const temp = TEMP_META[opp.temperature] ?? TEMP_META.warm;
  const TempIcon = temp.icon;
  return (
    <Card className="cursor-pointer border-border bg-background p-3 shadow-sm transition hover:shadow-md">
      <div onClick={onOpen} className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{opp.lead_name}</div>
            {opp.company_name && (
              <div className="truncate text-xs text-muted-foreground">{opp.company_name}</div>
            )}
          </div>
          <TempIcon className={cn("h-4 w-4 shrink-0", temp.className)} />
        </div>
        {opp.service_interest && (
          <div className="line-clamp-1 text-xs text-muted-foreground">{opp.service_interest}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{brl(opp.estimated_value)}</Badge>
          {opp.next_follow_up_at && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(opp.next_follow_up_at).toLocaleDateString("pt-BR")}
            </span>
          )}
          {opp.assigned_to && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <User2 className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <Select value={opp.stage_id} onValueChange={onMove}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
