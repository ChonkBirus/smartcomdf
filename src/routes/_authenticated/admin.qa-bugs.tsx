import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bug, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listQaBugs,
  createQaBug,
  updateQaBug,
  deleteQaBug,
} from "@/lib/qa-bugs.functions";

export const Route = createFileRoute("/_authenticated/admin/qa-bugs")({
  head: () => ({ meta: [{ title: "QA Bugs — Super Admin" }] }),
  component: QaBugsPage,
});

const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const STATUSES = [
  { v: "open", label: "Aberto" },
  { v: "in_progress", label: "Em andamento" },
  { v: "fixed", label: "Corrigido" },
  { v: "wont_fix", label: "Não será corrigido" },
  { v: "closed", label: "Fechado" },
] as const;

type Bug = {
  id: string;
  screen: string;
  description: string;
  impact: string | null;
  root_cause: string | null;
  fix: string | null;
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number]["v"];
  assignee: string | null;
  created_at: string;
};

const priorityVariant: Record<string, "destructive" | "default" | "secondary"> = {
  P0: "destructive",
  P1: "destructive",
  P2: "default",
  P3: "secondary",
};

function QaBugsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listQaBugs);
  const createFn = useServerFn(createQaBug);
  const updateFn = useServerFn(updateQaBug);
  const deleteFn = useServerFn(deleteQaBug);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bug | null>(null);

  const q = useQuery({
    queryKey: ["qa-bugs"],
    queryFn: () => fetchList(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["qa-bugs"] });

  const upsert = useMutation({
    mutationFn: (vars: any) =>
      editing ? updateFn({ data: { id: editing.id, ...vars } }) : createFn({ data: vars }),
    onSuccess: () => {
      toast.success(editing ? "Bug atualizado" : "Bug registrado");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removido");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const items = (q.data?.items ?? []) as Bug[];
  const filtered = useMemo(
    () =>
      items.filter(
        (b) =>
          (statusFilter === "all" || b.status === statusFilter) &&
          (priorityFilter === "all" || b.priority === priorityFilter),
      ),
    [items, statusFilter, priorityFilter],
  );

  const stats = useMemo(() => {
    const by = (s: string) => items.filter((b) => b.status === s).length;
    return { total: items.length, open: by("open"), in_progress: by("in_progress"), fixed: by("fixed") };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Total: {stats.total}</Badge>
          <Badge variant="destructive">Abertos: {stats.open}</Badge>
          <Badge>Em andamento: {stats.in_progress}</Badge>
          <Badge variant="secondary">Corrigidos: {stats.fixed}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="mr-2 h-4 w-4" /> Novo bug
              </Button>
            </SheetTrigger>
            <BugFormSheet
              editing={editing}
              disabled={upsert.isPending}
              onSubmit={(v) => upsert.mutate(v)}
            />
          </Sheet>
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bug className="h-6 w-6" />}
          title="Nenhum bug registrado"
          description="Use 'Novo bug' para registrar achados durante o QA."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Card key={b.id} className="card-elevated">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={priorityVariant[b.priority]}>{b.priority}</Badge>
                      <Badge variant="outline">
                        {STATUSES.find((s) => s.v === b.status)?.label ?? b.status}
                      </Badge>
                      <span className="font-medium">{b.screen}</span>
                      {b.assignee && (
                        <span className="text-xs text-muted-foreground">@ {b.assignee}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{b.description}</p>
                    {(b.impact || b.root_cause || b.fix) && (
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        {b.impact && <div><b>Impacto:</b> {b.impact}</div>}
                        {b.root_cause && <div><b>Causa:</b> {b.root_cause}</div>}
                        {b.fix && <div><b>Correção:</b> {b.fix}</div>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditing(b); setOpen(true); }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este bug?")) remove.mutate(b.id);
                      }}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BugFormSheet({
  editing,
  disabled,
  onSubmit,
}: {
  editing: Bug | null;
  disabled: boolean;
  onSubmit: (v: any) => void;
}) {
  const [screen, setScreen] = useState(editing?.screen ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [impact, setImpact] = useState(editing?.impact ?? "");
  const [root_cause, setRootCause] = useState(editing?.root_cause ?? "");
  const [fix, setFix] = useState(editing?.fix ?? "");
  const [priority, setPriority] = useState<string>(editing?.priority ?? "P2");
  const [status, setStatus] = useState<string>(editing?.status ?? "open");
  const [assignee, setAssignee] = useState(editing?.assignee ?? "");

  return (
    <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{editing ? "Editar bug" : "Novo bug"}</SheetTitle>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tela / módulo *</label>
          <Input value={screen} onChange={(e) => setScreen(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Descrição *</label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Prioridade</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Responsável</label>
          <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Impacto</label>
          <Textarea rows={2} value={impact} onChange={(e) => setImpact(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Causa raiz</label>
          <Textarea rows={2} value={root_cause} onChange={(e) => setRootCause(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Correção aplicada</label>
          <Textarea rows={2} value={fix} onChange={(e) => setFix(e.target.value)} />
        </div>
      </div>
      <SheetFooter className="mt-4">
        <Button
          disabled={disabled || !screen.trim() || !description.trim()}
          onClick={() =>
            onSubmit({
              screen: screen.trim(),
              description: description.trim(),
              impact: impact.trim() || null,
              root_cause: root_cause.trim() || null,
              fix: fix.trim() || null,
              priority,
              status,
              assignee: assignee.trim() || null,
            })
          }
        >
          {editing ? "Salvar" : "Registrar"}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
