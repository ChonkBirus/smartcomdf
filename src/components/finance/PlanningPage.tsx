import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Copy, Pencil, Target, Trash2, Wand2 } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/lib/permissions";
import {
  getYearlyPlan,
  upsertMonthlyPlan,
  deleteMonthlyPlan,
  copyPreviousMonth,
  applyPlanToWholeYear,
  type MonthlyPlan,
  type YearlyPlanRow,
} from "@/lib/finance-planning.functions";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pctColor(pct: number, kind: "revenue" | "expense" | "profit"): string {
  if (kind === "expense") {
    if (pct > 100) return "bg-red-500";
    if (pct >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  }
  // revenue / profit
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-red-500";
}

function num(v: string): number | null {
  const s = (v ?? "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function PlanningPage() {
  const { can } = usePermissions();
  const canManage = can("finance", "planning.manage");
  const canSeeMargin = can("finance", "view_costs");

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [editing, setEditing] = useState<{ month: number; plan: MonthlyPlan | null } | null>(null);
  const [applySrc, setApplySrc] = useState<number | null>(null);

  const qc = useQueryClient();
  const getPlan = useServerFn(getYearlyPlan);
  const upsert = useServerFn(upsertMonthlyPlan);
  const del = useServerFn(deleteMonthlyPlan);
  const copyPrev = useServerFn(copyPreviousMonth);
  const applyAll = useServerFn(applyPlanToWholeYear);

  const q = useQuery({
    queryKey: ["finance-planning", year],
    queryFn: () => getPlan({ data: { year } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["finance-planning", year] });

  const mUpsert = useMutation({
    mutationFn: upsert,
    onSuccess: () => { toast.success("Meta salva."); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mDelete = useMutation({
    mutationFn: del,
    onSuccess: () => { toast.success("Meta removida."); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });
  const mCopy = useMutation({
    mutationFn: copyPrev,
    onSuccess: (r: any) => {
      if (r?.ok === false && r.reason === "no_previous") {
        toast.info("Não há meta cadastrada no mês anterior.");
      } else {
        toast.success("Meta copiada do mês anterior.");
        invalidate();
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao copiar."),
  });
  const mApplyAll = useMutation({
    mutationFn: applyAll,
    onSuccess: (r: any) => { toast.success(`Meta aplicada a ${r.applied} meses.`); invalidate(); setApplySrc(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aplicar."),
  });

  const rows = q.data?.rows ?? [];
  const hasAnything = useMemo(
    () => rows.some((r) => r.plan || r.actual.income > 0 || r.actual.expense > 0),
    [rows],
  );

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, [now]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Planejamento financeiro"
        description="Defina metas mensais e acompanhe planejado × realizado. Realizado usa somente transações pagas (paid_at)."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="min-w-[160px]">
            <Label className="mb-1 block text-xs">Ano</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {q.isLoading && <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>}
      {q.isError && <div className="py-8 text-center text-sm text-destructive">Erro ao carregar.</div>}

      {q.data && !hasAnything && (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Sem metas nem movimentações neste ano"
          description={canManage
            ? "Clique em Editar metas em qualquer mês para começar seu planejamento."
            : "Nenhuma meta cadastrada e nenhuma movimentação paga registrada neste ano."}
        />
      )}

      {q.data && hasAnything && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => (
            <MonthCard
              key={r.month}
              row={r}
              canManage={canManage}
              canSeeMargin={canSeeMargin}
              onEdit={() => setEditing({ month: r.month, plan: r.plan })}
              onCopyPrev={() => mCopy.mutate({ data: { year, month: r.month } })}
              onApplyAll={() => setApplySrc(r.month)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metas — {editing && MONTH_NAMES[editing.month - 1]} {year}</DialogTitle>
            <DialogDescription>Deixe em branco para não definir a meta.</DialogDescription>
          </DialogHeader>
          {editing && (
            <EditForm
              plan={editing.plan}
              onSubmit={(fields) => mUpsert.mutate({ data: { year, month: editing.month, ...fields } })}
              submitting={mUpsert.isPending}
              canDelete={!!editing.plan && canManage}
              onDelete={() => mDelete.mutate({ data: { year, month: editing.month } })}
              disabled={!canManage}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Apply-to-year confirm */}
      <AlertDialog open={applySrc !== null} onOpenChange={(o) => !o && setApplySrc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar meta para o ano todo?</AlertDialogTitle>
            <AlertDialogDescription>
              As metas dos outros 11 meses de {year} serão sobrescritas pelos valores de{" "}
              {applySrc !== null ? MONTH_NAMES[applySrc - 1] : ""}. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applySrc !== null && mApplyAll.mutate({ data: { year, sourceMonth: applySrc } })}
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MonthCard({
  row, canManage, canSeeMargin, onEdit, onCopyPrev, onApplyAll,
}: {
  row: YearlyPlanRow;
  canManage: boolean;
  canSeeMargin: boolean;
  onEdit: () => void;
  onCopyPrev: () => void;
  onApplyAll: () => void;
}) {
  const p = row.plan;
  const a = row.actual;
  const revenuePct = p?.revenue_goal && p.revenue_goal > 0 ? (a.income / p.revenue_goal) * 100 : null;
  const expensePct = p?.expense_cap && p.expense_cap > 0 ? (a.expense / p.expense_cap) * 100 : null;
  const profitPct = canSeeMargin && p?.profit_goal && p.profit_goal > 0 ? (a.balance / p.profit_goal) * 100 : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {MONTH_NAMES[row.month - 1]}
        </CardTitle>
        {canManage && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onCopyPrev} title="Copiar mês anterior">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onApplyAll} disabled={!p} title="Aplicar para o ano todo">
              <Wand2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Editar metas">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <MetricRow
          label="Receita"
          goal={p?.revenue_goal ?? null}
          actual={a.income}
          pct={revenuePct}
          kind="revenue"
        />
        <MetricRow
          label="Despesa"
          goal={p?.expense_cap ?? null}
          actual={a.expense}
          pct={expensePct}
          kind="expense"
        />
        {canSeeMargin && (
          <>
            <MetricRow
              label="Lucro"
              goal={p?.profit_goal ?? null}
              actual={a.balance}
              pct={profitPct}
              kind="profit"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Margem</span>
              <span>
                {a.margin === null ? "—" : `${a.margin.toFixed(1)}%`}
                {p?.margin_goal_pct != null && (
                  <span className="ml-2 text-muted-foreground">/ meta {Number(p.margin_goal_pct).toFixed(1)}%</span>
                )}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricRow({
  label, goal, actual, pct, kind,
}: {
  label: string;
  goal: number | null;
  actual: number;
  pct: number | null;
  kind: "revenue" | "expense" | "profit";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {formatCurrency(actual)}
          {goal != null && <span className="ml-1 text-muted-foreground">/ {formatCurrency(goal)}</span>}
        </span>
      </div>
      {goal != null && pct !== null ? (
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className={`h-full ${pctColor(pct, kind)}`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">Sem meta</div>
      )}
      {goal != null && pct !== null && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{pct.toFixed(0)}%</div>
      )}
    </div>
  );
}

function EditForm({
  plan, onSubmit, submitting, canDelete, onDelete, disabled,
}: {
  plan: MonthlyPlan | null;
  onSubmit: (fields: {
    revenue_goal: number | null;
    expense_cap: number | null;
    profit_goal: number | null;
    margin_goal_pct: number | null;
    cash_min: number | null;
    notes: string | null;
  }) => void;
  submitting: boolean;
  canDelete: boolean;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [rev, setRev] = useState(plan?.revenue_goal?.toString() ?? "");
  const [exp, setExp] = useState(plan?.expense_cap?.toString() ?? "");
  const [prof, setProf] = useState(plan?.profit_goal?.toString() ?? "");
  const [margin, setMargin] = useState(plan?.margin_goal_pct?.toString() ?? "");
  const [cash, setCash] = useState(plan?.cash_min?.toString() ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meta de receita (R$)" value={rev} onChange={setRev} disabled={disabled} />
        <Field label="Teto de despesa (R$)" value={exp} onChange={setExp} disabled={disabled} />
        <Field label="Lucro mínimo (R$)" value={prof} onChange={setProf} disabled={disabled} />
        <Field label="Margem mínima (%)" value={margin} onChange={setMargin} disabled={disabled} />
        <Field label="Caixa mínimo (R$)" value={cash} onChange={setCash} disabled={disabled} />
      </div>
      <div>
        <Label className="text-xs">Observações</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} />
      </div>
      <DialogFooter className="gap-2">
        {canDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={submitting}>
            <Trash2 className="mr-2 h-4 w-4" />Remover meta
          </Button>
        )}
        <Button
          disabled={submitting || disabled}
          onClick={() => onSubmit({
            revenue_goal: num(rev),
            expense_cap: num(exp),
            profit_goal: num(prof),
            margin_goal_pct: num(margin),
            cash_min: num(cash),
            notes: notes.trim() || null,
          })}
        >
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}
