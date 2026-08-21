import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  listFinancialCategories,
  createFinancialCategory,
  updateFinancialCategory,
  deactivateFinancialCategory,
  deleteFinancialCategory,
  ensureDefaultChartOfAccounts,
  type FinancialCategory,
  type FinTxType,
  type CategoryGroup,
} from "@/lib/finance.functions";
import { useCompanyId } from "@/hooks/use-company-id";

// -------- Utilities --------

function levelFromCode(code: string | null): number {
  return code ? code.split(".").length : 1;
}

function suggestNextChildCode(parentCode: string | null, siblings: FinancialCategory[]): string {
  const used = new Set(
    siblings
      .map((s) => s.code)
      .filter((c): c is string => !!c)
      .map((c) => c.split(".").pop()!)
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n < 99),
  );
  let next = 1;
  while (used.has(next)) next += 1;
  const prefix = parentCode ? `${parentCode}.` : "";
  return `${prefix}${next}`;
}

const GROUP_LABEL: Record<CategoryGroup, string> = {
  REVENUE: "Receita",
  VARIABLE_COST: "Custo variável",
  FIXED_EXPENSE: "Despesa fixa",
  INVESTMENT: "Investimento",
  NON_OPERATIONAL: "Não operacional",
  CASH_ADJUSTMENT: "Acerto de caixa",
};

type TreeNode = FinancialCategory & { children: TreeNode[] };

function buildTree(rows: FinancialCategory[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (a: TreeNode, b: TreeNode) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const ac = a.code ?? "";
    const bc = b.code ?? "";
    if (ac !== bc) return ac.localeCompare(bc);
    return a.name.localeCompare(b.name);
  };
  const walk = (list: TreeNode[]) => {
    list.sort(sort);
    list.forEach((n) => walk(n.children));
  };
  walk(roots);
  return roots;
}

// -------- Form Dialog --------

type FormMode =
  | { mode: "create"; parent: FinancialCategory | null; type: FinTxType }
  | { mode: "edit"; category: FinancialCategory };

function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  siblings,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: FormMode | null;
  siblings: FinancialCategory[];
  onSaved: () => void;
}) {
  const createFn = useServerFn(createFinancialCategory);
  const updateFn = useServerFn(updateFinancialCategory);

  const initial = useMemo(() => {
    if (!mode) return { code: "", name: "", type: "EXPENSE" as FinTxType, active: true };
    if (mode.mode === "edit") {
      return {
        code: mode.category.code ?? "",
        name: mode.category.name,
        type: mode.category.type,
        active: mode.category.active,
      };
    }
    return {
      code: suggestNextChildCode(mode.parent?.code ?? null, siblings),
      name: "",
      type: mode.parent?.type ?? mode.type,
      active: true,
    };
  }, [mode, siblings]);

  const [form, setForm] = useState(initial);
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!mode) return;
      if (!form.name.trim()) throw new Error("Nome obrigatório.");
      if (mode.mode === "create") {
        const parent = mode.parent;
        return createFn({
          data: {
            name: form.name.trim(),
            type: form.type,
            code: form.code.trim() || null,
            parent_id: parent?.id ?? null,
            category_group: parent?.category_group ?? null,
            cost_behavior: parent?.cost_behavior ?? null,
            active: form.active,
          },
        });
      }
      return updateFn({
        data: {
          id: mode.category.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          type: form.type,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      toast.success(mode?.mode === "edit" ? "Categoria atualizada." : "Categoria criada.");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  if (!mode) return null;
  const title = mode.mode === "edit" ? "Editar categoria" : "Nova categoria";
  const parentLabel =
    mode.mode === "create" && mode.parent
      ? `${mode.parent.code ? `${mode.parent.code} — ` : ""}${mode.parent.name}`
      : "Nível 1 (sem categoria pai)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Categoria pai</Label>
            <div className="mt-1 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {parentLabel}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label>Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex.: 3.1.6"
              />
            </div>
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo financeiro</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as FinTxType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Entrada</SelectItem>
                  <SelectItem value="EXPENSE">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível</Label>
              <div className="mt-1 flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                {levelFromCode(form.code || null)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
            <Label className="cursor-pointer">Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Tree row --------

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onAddChild,
  onEdit,
  onToggleActive,
  onDelete,
  canManage,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (n: TreeNode) => void;
  onEdit: (n: TreeNode) => void;
  onToggleActive: (n: TreeNode) => void;
  onDelete: (n: TreeNode) => void;
  canManage: boolean;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const currentLevel = node.level ?? levelFromCode(node.code);
  const canAddChild = canManage && currentLevel < 3;
  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-muted/60",
          !node.active && "opacity-60",
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted disabled:opacity-30"
          onClick={() => hasChildren && onToggle(node.id)}
          disabled={!hasChildren}
          aria-label={isOpen ? "Recolher" : "Expandir"}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {node.code && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{node.code}</span>
          )}
          <span className={cn("truncate text-sm", !node.active && "line-through")}>
            {node.name}
          </span>
          {node.is_default && (
            <Badge variant="outline" className="ml-1 shrink-0 text-[10px]">
              padrão
            </Badge>
          )}
          {node.category_group && (
            <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">
              {GROUP_LABEL[node.category_group]}
            </Badge>
          )}
          {!node.active && (
            <Badge variant="outline" className="ml-1 shrink-0 text-[10px]">
              inativa
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canAddChild && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onAddChild(node)}
              title="Nova subcategoria"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(node)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onToggleActive(node)}
              title={node.active ? "Inativar" : "Ativar"}
            >
              <Switch checked={node.active} className="pointer-events-none scale-75" />
            </Button>
          )}
          {canManage && !node.is_default && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => onDelete(node)}
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {isOpen &&
        node.children.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
            canManage={canManage}
          />
        ))}
    </>
  );
}

// -------- Main Page --------

export function ChartOfAccountsPage({ canManage = true }: { canManage?: boolean } = {}) {
  const companyId = useCompanyId();
  const qc = useQueryClient();

  const listFn = useServerFn(listFinancialCategories);
  const ensureFn = useServerFn(ensureDefaultChartOfAccounts);
  const deactivateFn = useServerFn(deactivateFinancialCategory);
  const deleteFn = useServerFn(deleteFinancialCategory);

  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [levelView, setLevelView] = useState<"1" | "2" | "3">("2");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FinancialCategory | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);

  // Seed on first mount for this company (idempotent).
  useQuery({
    queryKey: ["fin-coa-seed", companyId],
    queryFn: () => ensureFn(),
    enabled: !!companyId,
    staleTime: Infinity,
  });

  const q = useQuery({
    queryKey: ["fin-coa-all", companyId],
    queryFn: () => listFn({ data: { activeOnly: false } }),
    enabled: !!companyId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fin-coa-all", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-cats", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-cats-all", companyId] });
    qc.invalidateQueries({ queryKey: ["fin-cats-coa", companyId] });
  };

  const filtered = useMemo(() => {
    let rows = (q.data ?? []) as FinancialCategory[];
    if (!showInactive) rows = rows.filter((r) => r.active);
    const term = search.trim().toLowerCase();
    if (term) {
      const matching = new Set<string>();
      const byId = new Map(rows.map((r) => [r.id, r]));
      rows.forEach((r) => {
        const hay = `${r.code ?? ""} ${r.name}`.toLowerCase();
        if (hay.includes(term)) {
          // include self + ancestors so tree remains valid
          let cur: FinancialCategory | undefined = r;
          while (cur) {
            matching.add(cur.id);
            cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
          }
        }
      });
      rows = rows.filter((r) => matching.has(r.id));
    }
    return rows;
  }, [q.data, showInactive, search]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  // Auto-expand: on search, expand matched branches.
  // Otherwise expand up to the selected view level (1 = collapse all, 2 = show level 2, 3 = show level 3).
  useEffect(() => {
    if (search.trim()) {
      setExpanded(new Set(filtered.map((r) => r.id)));
      return;
    }
    const targetDepth = parseInt(levelView, 10); // 1..3
    const ids = new Set<string>();
    // Expand every node whose own level is strictly less than targetDepth
    // so its children (at level = its level + 1) become visible.
    filtered.forEach((r) => {
      const lvl = r.level ?? levelFromCode(r.code);
      if (lvl < targetDepth) ids.add(r.id);
    });
    setExpanded(ids);
  }, [search, filtered, levelView]);

  const onToggle = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const openCreateRoot = () => {
    setFormMode({ mode: "create", parent: null, type: "EXPENSE" });
    setFormOpen(true);
  };
  const openCreateChild = (parent: TreeNode) => {
    setFormMode({ mode: "create", parent, type: parent.type });
    setFormOpen(true);
  };
  const openEdit = (n: TreeNode) => {
    setFormMode({ mode: "edit", category: n });
    setFormOpen(true);
  };

  const toggleActive = useMutation({
    mutationFn: (n: FinancialCategory) => deactivateFn({ data: { id: n.id, active: !n.active } }),
    onSuccess: (_r, n) => {
      toast.success(n.active ? "Categoria inativada." : "Categoria reativada.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro."),
  });

  const doDelete = useMutation({
    mutationFn: (n: FinancialCategory) => deleteFn({ data: { id: n.id } }),
    onSuccess: (res, n) => {
      if ("deleted" in res && res.deleted) {
        toast.success("Categoria excluída.");
        invalidate();
      } else {
        // Fallback: deactivate.
        const reason = (res as any).reason as "has_transactions" | "has_children" | "default";
        const msg =
          reason === "has_transactions"
            ? "Esta categoria possui lançamentos vinculados. Para preservar o histórico, ela será apenas inativada."
            : reason === "has_children"
              ? "Esta categoria tem subcategorias. Ela será apenas inativada."
              : "Categoria padrão não pode ser excluída. Foi apenas inativada.";
        toast.message(msg);
        toggleActive.mutate({ ...n, active: true }); // pretend it was active so we flip to inactive
      }
      setPendingDelete(null);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro ao excluir.");
      setPendingDelete(null);
    },
  });

  const runSeed = useMutation({
    mutationFn: () => ensureFn(),
    onSuccess: (res: any) => {
      toast.success(
        res?.inserted
          ? `${res.inserted} categorias adicionadas.`
          : "Categorias padrão já estavam presentes.",
      );
      invalidate();
      setConfirmSeed(false);
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erro.");
      setConfirmSeed(false);
    },
  });

  // Siblings of the parent-in-form (used to suggest next code).
  const siblingsForForm = useMemo(() => {
    if (!formMode || formMode.mode !== "create") return [];
    const parentId = formMode.parent?.id ?? null;
    return (q.data ?? []).filter((c) => (c.parent_id ?? null) === parentId);
  }, [formMode, q.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Plano de Contas</h2>
              <p className="text-sm text-muted-foreground">
                Estrutura hierárquica de categorias em três níveis. Usada nos lançamentos
                financeiros.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setConfirmSeed(true)}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Restaurar categorias padrão
                </Button>
              )}
              {canManage && (
                <Button size="sm" onClick={openCreateRoot}>
                  <Plus className="mr-1 h-4 w-4" /> Nível 1
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código ou nome..."
                className="pl-9"
              />
            </div>
            <Tabs value={levelView} onValueChange={(v) => setLevelView(v as "1" | "2" | "3")}>
              <TabsList>
                <TabsTrigger value="1">Nível 1</TabsTrigger>
                <TabsTrigger value="2">Nível 2</TabsTrigger>
                <TabsTrigger value="3">Nível 3</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(new Set(filtered.map((r) => r.id)))}
                title="Expandir tudo"
              >
                <ChevronsUpDown className="mr-1 h-4 w-4" /> Expandir
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(new Set())}
                title="Recolher tudo"
              >
                <ChevronsDownUp className="mr-1 h-4 w-4" /> Recolher
              </Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Mostrar inativas
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          {q.isLoading && (
            <div className="p-6 text-sm text-muted-foreground">Carregando plano de contas...</div>
          )}
          {!q.isLoading && tree.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma categoria encontrada.</div>
          )}
          <div className="space-y-0.5">
            {tree.map((n) => (
              <TreeRow
                key={n.id}
                node={n}
                depth={0}
                expanded={expanded}
                onToggle={onToggle}
                onAddChild={openCreateChild}
                onEdit={openEdit}
                onToggleActive={(x) => toggleActive.mutate(x)}
                onDelete={(x) => setPendingDelete(x)}
                canManage={canManage}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        siblings={siblingsForForm}
        onSaved={invalidate}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se esta categoria tiver lançamentos vinculados ou subcategorias, ela será apenas
              inativada para preservar o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && doDelete.mutate(pendingDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSeed} onOpenChange={setConfirmSeed}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar categorias padrão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso adicionará categorias padrão que ainda não existem. Suas categorias atuais não
              serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => runSeed.mutate()}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
