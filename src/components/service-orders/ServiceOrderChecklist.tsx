import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Loader2, AlertTriangle, CheckCircle2, Pencil, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  listChecklistItems, toggleChecklistItem, addChecklistItem,
  updateChecklistItem, deleteChecklistItem, reorderChecklistItems,
  type ChecklistItem,
} from "@/lib/service-order-checklist.functions";


type Status = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

export function ServiceOrderChecklist({
  serviceOrderId,
  status,
  canManage,
}: {
  serviceOrderId: string;
  status: Status;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listChecklistItems);
  const toggleFn = useServerFn(toggleChecklistItem);
  const addFn = useServerFn(addChecklistItem);

  const { data = [], isLoading } = useQuery({
    queryKey: ["so-checklist", serviceOrderId],
    queryFn: () => fetchFn({ data: { id: serviceOrderId } }),
  });

  const editable = canManage && (status === "IN_PROGRESS" || status === "PAUSED");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["so-checklist", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["so-exec-logs", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["so-required-pending", serviceOrderId] });
  };

  const toggle = useMutation({
    mutationFn: toggleFn,
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const add = useMutation({
    mutationFn: addFn,
    onSuccess: () => { invalidate(); toast.success("Item adicionado."); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao adicionar item"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando checklist…</p>;

  const done = data.filter((i) => i.checked).length;
  const reqPending = data.filter((i) => i.required && !i.checked).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{done}/{data.length} concluídos</span>
        {reqPending > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            <AlertTriangle className="h-3 w-3" /> {reqPending} obrigatório(s) pendente(s)
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem itens no checklist.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {data.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              editable={editable}
              busy={toggle.isPending}
              onToggle={(checked, notes) =>
                toggle.mutate({ data: { itemId: item.id, checked, notes } })
              }
            />
          ))}
        </ul>
      )}

      {editable && (
        <AddItemDialog
          busy={add.isPending}
          onSubmit={(values) =>
            add.mutate({ data: { serviceOrderId, ...values } })
          }
        />
      )}
    </div>
  );
}

function ChecklistRow({
  item, editable, busy, onToggle,
}: {
  item: ChecklistItem;
  editable: boolean;
  busy: boolean;
  onToggle: (checked: boolean, notes?: string) => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const [editingNote, setEditingNote] = useState(false);

  return (
    <li className="p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.checked}
          disabled={!editable || busy}
          onCheckedChange={(v) => onToggle(Boolean(v))}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}>
              {item.title}
            </span>
            {item.required && <Badge variant="outline" className="text-xs">Obrigatório</Badge>}
            {item.checked && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          )}
          {item.checked && item.checked_by_name && (
            <p className="text-xs text-muted-foreground mt-1">
              Por {item.checked_by_name}
              {item.checked_at && ` · ${new Date(item.checked_at).toLocaleString("pt-BR")}`}
            </p>
          )}
          {item.notes && !editingNote && (
            <p className="text-xs italic text-muted-foreground mt-1">Obs: {item.notes}</p>
          )}
          {editable && (
            editingNote ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Observação"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { onToggle(item.checked, notes); setEditingNote(false); }}
                    disabled={busy}
                  >
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingNote(false); setNotes(item.notes ?? ""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 mt-1 text-xs"
                onClick={() => setEditingNote(true)}>
                {item.notes ? "Editar observação" : "Adicionar observação"}
              </Button>
            )
          )}
        </div>
      </div>
    </li>
  );
}

function AddItemDialog({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (values: { title: string; description?: string; required: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);

  const submit = () => {
    if (!title.trim()) { toast.error("Informe o título."); return; }
    onSubmit({ title: title.trim(), description: description.trim() || undefined, required });
    setOpen(false); setTitle(""); setDescription(""); setRequired(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar item ao checklist
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar item de checklist</DialogTitle>
          <DialogDescription>Inclua uma verificação manual nesta OS.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(Boolean(v))} />
            Item obrigatório
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
