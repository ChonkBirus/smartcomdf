import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Trophy, XCircle, CircleDot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listPipelineStages,
  createStage,
  deleteStage,
  reorderStages,
  updateStage,
  type CrmStage,
} from "@/lib/crm.functions";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; pipelineId: string };

export function StageManagerDialog({ open, onOpenChange, pipelineId }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listPipelineStages);
  const create = useServerFn(createStage);
  const remove = useServerFn(deleteStage);
  const rename = useServerFn(updateStage);
  const reorder = useServerFn(reorderStages);

  const key = ["crm", "stages", pipelineId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { pipeline_id: pipelineId } }),
    enabled: open,
  });

  const [items, setItems] = useState<CrmStage[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"open" | "won" | "lost">("open");
  const [toDelete, setToDelete] = useState<CrmStage | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm"] });
    qc.invalidateQueries({ queryKey: key });
  };

  const createMut = useMutation({
    mutationFn: () =>
      create({ data: { pipeline_id: pipelineId, name: newName.trim(), stage_type: newType } }),
    onSuccess: () => {
      setNewName("");
      setNewType("open");
      invalidate();
      toast.success("Estágio criado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar estágio."),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; name: string }) => rename({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao renomear."),
  });

  const reorderMut = useMutation({
    mutationFn: (ordered_ids: string[]) =>
      reorder({ data: { pipeline_id: pipelineId, ordered_ids } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reordenar."),
  });

  const deleteMut = useMutation({
    mutationFn: (v: { id: string; move_to_stage_id: string }) => remove({ data: v }),
    onSuccess: () => {
      setToDelete(null);
      setMoveTarget("");
      invalidate();
      toast.success("Estágio removido.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((s) => s.id === active.id);
    const to = items.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    reorderMut.mutate(next.map((s) => s.id));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar estágios</DialogTitle>
            <DialogDescription>
              Arraste para reordenar, renomeie inline e defina estágios de ganho ou perda.
            </DialogDescription>
          </DialogHeader>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map((s) => (
                  <SortableStageRow
                    key={s.id}
                    stage={s}
                    onRename={(name) => renameMut.mutate({ id: s.id, name })}
                    onDelete={() => setToDelete(s)}
                    canDelete={items.length > 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 border-t border-border pt-3">
            <Input
              placeholder="Novo estágio"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="won">Ganho</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover estágio "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha para onde mover os leads deste estágio antes de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={moveTarget} onValueChange={setMoveTarget}>
            <SelectTrigger>
              <SelectValue placeholder="Mover leads para…" />
            </SelectTrigger>
            <SelectContent>
              {items
                .filter((s) => s.id !== toDelete?.id)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!moveTarget || deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!toDelete || !moveTarget) return;
                deleteMut.mutate({ id: toDelete.id, move_to_stage_id: moveTarget });
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SortableStageRow({
  stage,
  onRename,
  onDelete,
  canDelete,
}: {
  stage: CrmStage;
  onRename: (name: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [name, setName] = useState(stage.name);
  useEffect(() => setName(stage.name), [stage.name]);
  const TypeIcon = stage.is_won ? Trophy : stage.is_lost ? XCircle : CircleDot;
  const iconClass = stage.is_won
    ? "text-success"
    : stage.is_lost
      ? "text-destructive"
      : "text-primary";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card p-2",
        isDragging && "opacity-60",
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <TypeIcon className={cn("h-4 w-4 shrink-0", iconClass)} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== stage.name) onRename(name.trim());
        }}
        className="h-8 flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        disabled={!canDelete}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
