import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Flame, Snowflake, Thermometer, Calendar, User2, Search, X, Settings2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getCrmBoard, listCrmTeam, moveOpportunityStage, reorderOpportunitiesInStage,
  type CrmOpportunity, type CrmStage,
} from "@/lib/crm.functions";
import { NewOpportunitySheet } from "./NewOpportunitySheet";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { StageManagerDialog } from "./StageManagerDialog";
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
  const reorder = useServerFn(reorderOpportunitiesInStage);

  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined);
  const [dragging, setDragging] = useState<CrmOpportunity | null>(null);
  const [filters, setFilters] = useState<Filters>({ search: "", assigned_to: "", temperature: "" });
  const [openStages, setOpenStages] = useState(false);
  const [lossPrompt, setLossPrompt] = useState<{ oppId: string; stageId: string } | null>(null);
  const [lossReason, setLossReason] = useState("");

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

  // Local ordering per stage to allow optimistic drag-sort within column.
  const [localOrders, setLocalOrders] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!data) return;
    const next: Record<string, string[]> = {};
    for (const s of data.stages) next[s.id] = [];
    for (const o of data.opportunities) {
      if (!next[o.stage_id]) next[o.stage_id] = [];
      next[o.stage_id].push(o.id);
    }
    setLocalOrders(next);
  }, [data]);

  const oppMap = useMemo(() => {
    const m = new Map<string, CrmOpportunity>();
    for (const o of data?.opportunities ?? []) m.set(o.id, o);
    return m;
  }, [data]);

  const snapshotRef = useRef<Record<string, string[]> | null>(null);
  const rollback = (message: string) => {
    if (snapshotRef.current) {
      setLocalOrders(snapshotRef.current);
      snapshotRef.current = null;
    }
    toast.error(message);
  };

  const moveMutation = useMutation({
    mutationFn: async (v: { id: string; stage_id: string; sort_order?: number; lost_reason?: string }) =>
      await move({ data: v }),
    onError: (e: any) => rollback(e?.message ?? "Erro ao mover lead."),
    onSuccess: () => { snapshotRef.current = null; },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (v: { stage_id: string; ordered_ids: string[] }) =>
      await reorder({ data: v }),
    onError: (e: any) => rollback(e?.message ?? "Erro ao reordenar."),
    onSuccess: () => { snapshotRef.current = null; },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm"] }),
  });

  const isPending = moveMutation.isPending || reorderMutation.isPending;

  const clearFilters = () => setFilters({ search: "", assigned_to: "", temperature: "" });
  const hasFilters = filters.search || filters.assigned_to || filters.temperature;

  if (isLoading && !data) return <p className="text-sm text-muted-foreground">Carregando funil…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const stages = data.stages;

  const findStageOfOpp = (id: string) => {
    for (const [sid, ids] of Object.entries(localOrders)) {
      if (ids.includes(id)) return sid;
    }
    return oppMap.get(id)?.stage_id ?? null;
  };

  const onDragStart = (e: DragStartEvent) => {
    const opp = oppMap.get(String(e.active.id));
    setDragging(opp ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const oppId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const sourceStageId = findStageOfOpp(oppId);
    if (!sourceStageId) return;

    let targetStageId = sourceStageId;
    let targetIndex: number | null = null;

    if (overId.startsWith("stage:")) {
      targetStageId = overId.slice(6);
      targetIndex = (localOrders[targetStageId] ?? []).length;
    } else {
      // dropped on another opportunity — resolve its stage
      const overStage = findStageOfOpp(overId);
      if (!overStage) return;
      targetStageId = overStage;
      targetIndex = (localOrders[targetStageId] ?? []).indexOf(overId);
      if (targetIndex < 0) targetIndex = (localOrders[targetStageId] ?? []).length;
    }

    const stage = stages.find((s) => s.id === targetStageId);
    if (!stage) return;

    // Prompt for loss reason when moving into a "lost" stage from a different one.
    if (stage.is_lost && sourceStageId !== targetStageId) {
      setLossReason("");
      setLossPrompt({ oppId, stageId: targetStageId });
      return;
    }

    applyMove(oppId, sourceStageId, targetStageId, targetIndex);
  };

  const applyMove = (
    oppId: string,
    sourceStageId: string,
    targetStageId: string,
    targetIndex: number | null,
    lost_reason?: string,
  ) => {
    setLocalOrders((prev) => {
      const source = [...(prev[sourceStageId] ?? [])];
      const target = sourceStageId === targetStageId ? source : [...(prev[targetStageId] ?? [])];
      const fromIdx = source.indexOf(oppId);
      if (fromIdx < 0) return prev;
      if (sourceStageId === targetStageId) {
        const moved = arrayMove(source, fromIdx, targetIndex ?? source.length - 1);
        return { ...prev, [sourceStageId]: moved };
      }
      source.splice(fromIdx, 1);
      const insertAt = targetIndex ?? target.length;
      target.splice(insertAt, 0, oppId);
      return { ...prev, [sourceStageId]: source, [targetStageId]: target };
    });

    const nextIds =
      sourceStageId === targetStageId
        ? arrayMove(
            [...(localOrders[sourceStageId] ?? [])],
            (localOrders[sourceStageId] ?? []).indexOf(oppId),
            targetIndex ?? 0,
          )
        : (() => {
            const t = [...(localOrders[targetStageId] ?? [])];
            const insertAt = targetIndex ?? t.length;
            t.splice(insertAt, 0, oppId);
            return t;
          })();
    const newIndex = nextIds.indexOf(oppId);
    const sort_order = (newIndex + 1) * 100;

    // Persist: single move (also handles stage change + lost_reason)
    moveMutation.mutate({
      id: oppId,
      stage_id: targetStageId,
      sort_order,
      lost_reason,
    });

    // If pure intra-column reorder with many items, also send a bulk reorder for stability.
    if (sourceStageId === targetStageId && nextIds.length > 2) {
      reorderMutation.mutate({ stage_id: targetStageId, ordered_ids: nextIds });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Funil: <span className="font-medium text-foreground">{data.pipeline.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenStages(true)}>
            <Settings2 className="mr-1 h-4 w-4" /> Estágios
          </Button>
          <Button size="sm" onClick={() => { setDefaultStageId(undefined); setOpenNew(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Novo lead
          </Button>
        </div>
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
          {stages.map((stage) => {
            const ids = localOrders[stage.id] ?? [];
            const opps = ids.map((id) => oppMap.get(id)).filter(Boolean) as CrmOpportunity[];
            return (
              <StageColumn
                key={stage.id}
                stage={stage}
                opportunities={opps}
                onSelect={setSelectedId}
                onAdd={() => { setDefaultStageId(stage.id); setOpenNew(true); }}
              />
            );
          })}
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
      <StageManagerDialog
        open={openStages}
        onOpenChange={setOpenStages}
        pipelineId={data.pipeline.id}
      />

      <AlertDialog open={!!lossPrompt} onOpenChange={(v) => !v && setLossPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar lead como perdido?</AlertDialogTitle>
            <AlertDialogDescription>
              Registre o motivo para acompanhar os principais gargalos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Ex.: Preço acima do orçamento, escolheu concorrente…"
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLossPrompt(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!lossPrompt) return;
                const src = findStageOfOpp(lossPrompt.oppId) ?? "";
                applyMove(
                  lossPrompt.oppId,
                  src,
                  lossPrompt.stageId,
                  (localOrders[lossPrompt.stageId] ?? []).length,
                  lossReason.trim() || undefined,
                );
                setLossPrompt(null);
              }}
            >
              Confirmar perda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

        <SortableContext items={opportunities.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[80px]">
            {opportunities.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Solte um lead aqui
              </div>
            )}
            {opportunities.map((o) => (
              <SortableOpportunity key={o.id} opp={o} onOpen={() => onSelect(o.id)} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableOpportunity({ opp, onOpen }: { opp: CrmOpportunity; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id: opp.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
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
