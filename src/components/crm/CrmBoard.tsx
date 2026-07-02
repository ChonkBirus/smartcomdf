import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Flame, Snowflake, Thermometer, Calendar, User2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCrmBoard,
  listCrmTeam,
  moveOpportunityStage,
  type CrmOpportunity,
  type CrmStage,
} from "@/lib/crm.functions";
import { NewOpportunitySheet } from "./NewOpportunitySheet";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { cn } from "@/lib/utils";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TEMP_META: Record<string, { label: string; icon: any; className: string }> = {
  cold: { label: "Frio", icon: Snowflake, className: "text-sky-500" },
  warm: { label: "Morno", icon: Thermometer, className: "text-amber-500" },
  hot: { label: "Quente", icon: Flame, className: "text-destructive" },
};

type Filters = { search: string; assigned_to: string; temperature: string };

export function CrmBoard() {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getCrmBoard);
  const fetchTeam = useServerFn(listCrmTeam);
  const move = useServerFn(moveOpportunityStage);
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined);
  const [dragging, setDragging] = useState<CrmOpportunity | null>(null);
  const [filters, setFilters] = useState<Filters>({ search: "", assigned_to: "", temperature: "" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const boardKey = ["crm", "board", filters];
  const { data, isLoading, error } = useQuery({
    queryKey: boardKey,
    queryFn: () =>
      fetchBoard({
        data: {
          search: filters.search || undefined,
          assigned_to: filters.assigned_to || undefined,
          temperature: (filters.temperature || undefined) as any,
        },
      }),
    staleTime: 15_000,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["crm", "team"],
    queryFn: () => fetchTeam(),
    staleTime: 60_000,
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
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["crm"] });
      const prev = qc.getQueryData<any>(boardKey);
      if (prev) {
        qc.setQueryData(boardKey, {
          ...prev,
          opportunities: prev.opportunities.map((o: CrmOpportunity) =>
            o.id === v.id ? { ...o, stage_id: v.stage_id } : o,
          ),
        });
      }
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey, ctx.prev);
      toast.error(e?.message ?? "Erro ao mover lead.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  const clearFilters = () => setFilters({ search: "", assigned_to: "", temperature: "" });
  const hasFilters = filters.search || filters.assigned_to || filters.temperature;

  if (isLoading && !data) return <p className="text-sm text-muted-foreground">Carregando funil…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const stages = data.stages;

  const onDragStart = (e: DragStartEvent) => {
    const opp = data.opportunities.find((o) => o.id === e.active.id);
    setDragging(opp ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const oppId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const targetStageId = overId.startsWith("stage:") ? overId.slice(6) : null;
    if (!targetStageId) return;
    const opp = data.opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage_id === targetStageId) return;
    moveMutation.mutate({ id: oppId, stage_id: targetStageId });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Funil: <span className="font-medium text-foreground">{data.pipeline.name}</span>
        </div>
        <Button size="sm" onClick={() => { setDefaultStageId(undefined); setOpenNew(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder="Buscar por nome, empresa, e-mail…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <Select
          value={filters.assigned_to || "__all__"}
          onValueChange={(v) => setFilters({ ...filters, assigned_to: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os responsáveis</SelectItem>
            {team.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.temperature || "__all__"}
          onValueChange={(v) => setFilters({ ...filters, temperature: v === "__all__" ? "" : v })}
        >
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Temperatura" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            <SelectItem value="cold">Frio</SelectItem>
            <SelectItem value="warm">Morno</SelectItem>
            <SelectItem value="hot">Quente</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-3">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              opportunities={oppsByStage.get(stage.id) ?? []}
              onSelect={setSelectedId}
              onAdd={() => { setDefaultStageId(stage.id); setOpenNew(true); }}
            />
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="w-72">
              <OpportunityCardBody opp={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
  opportunities,
  onSelect,
  onAdd,
}: {
  stage: CrmStage;
  opportunities: CrmOpportunity[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `stage:${stage.id}` });
  const total = opportunities.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
  const accent = stage.is_won
    ? "border-t-success"
    : stage.is_lost
    ? "border-t-destructive"
    : "border-t-primary";

  return (
    <div className="w-72 shrink-0 snap-start">
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg border border-border border-t-4 bg-card p-3 transition-colors",
          accent,
          isOver && "bg-muted/50 ring-2 ring-primary/40",
        )}
      >
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

        <div className="space-y-2 min-h-[80px]">
          {opportunities.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Solte um lead aqui
            </div>
          )}
          {opportunities.map((o) => (
            <DraggableOpportunity key={o.id} opp={o} onOpen={() => onSelect(o.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DraggableOpportunity({ opp, onOpen }: { opp: CrmOpportunity; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <OpportunityCardBody opp={opp} />
    </div>
  );
}

function OpportunityCardBody({ opp }: { opp: CrmOpportunity }) {
  const temp = TEMP_META[opp.temperature] ?? TEMP_META.warm;
  const TempIcon = temp.icon;
  return (
    <Card className="border-border bg-background p-3 shadow-sm transition hover:shadow-md">
      <div className="space-y-2">
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
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {brl(Number(opp.estimated_value || 0))}
          </Badge>
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
    </Card>
  );
}
