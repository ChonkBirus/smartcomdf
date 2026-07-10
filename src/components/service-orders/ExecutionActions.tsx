import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Pause, RefreshCw, CheckCircle2, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth-context";
import { useCompanyId } from "@/hooks/use-company-id";
import { buildDraftKey, saveDraft, loadDraft, clearDraft, getDraftSavedAt } from "@/lib/draft-storage";
import { executeServiceOrderTransition } from "@/lib/service-order-execution.functions";
import { listPendingRequiredChecklist } from "@/lib/service-order-checklist.functions";


type Status = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

const PAUSE_REASONS = [
  "Cliente ausente",
  "Falta de material",
  "Aguardando autorização",
  "Problema técnico",
  "Retorno necessário",
  "Outro",
];

export function ExecutionActions({
  serviceOrderId,
  status,
  assignedTechnicianId,
}: {
  serviceOrderId: string;
  status: Status;
  assignedTechnicianId: string | null;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(executeServiceOrderTransition);
  const { can, isOwner, isSuperAdmin } = usePermissions();
  const isManager = isOwner || isSuperAdmin || can("service_orders", "edit") || can("service_orders", "assign_technician");

  const canOverride = isOwner || isSuperAdmin || can("service_orders", "override_required_checklist");

  const [open, setOpen] = useState<null | "start" | "pause" | "resume" | "finish">(null);
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [report, setReport] = useState("");
  const [issue, setIssue] = useState("");
  const [solution, setSolution] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");

  // ---- UX2C: rascunho local (Pausa e Finalização) ----
  const { user } = useAuth();
  const companyId = useCompanyId();
  const pauseDraftKey = useMemo(
    () => buildDraftKey("so-exec-pause", companyId, user?.id, serviceOrderId),
    [companyId, user?.id, serviceOrderId],
  );
  const finishDraftKey = useMemo(
    () => buildDraftKey("so-exec-finish", companyId, user?.id, serviceOrderId),
    [companyId, user?.id, serviceOrderId],
  );
  const [pauseRestoredAt, setPauseRestoredAt] = useState<number | null>(null);
  const [finishRestoredAt, setFinishRestoredAt] = useState<number | null>(null);
  const hydratedRef = useRef({ pause: false, finish: false });

  // Restaura ao abrir cada diálogo (uma vez por abertura).
  useEffect(() => {
    if (open === "pause" && !hydratedRef.current.pause) {
      const d = loadDraft<{ reason: string; reasonOther: string }>(pauseDraftKey);
      if (d) {
        if (d.reason) setReason(d.reason);
        if (d.reasonOther) setReasonOther(d.reasonOther);
        setPauseRestoredAt(getDraftSavedAt(pauseDraftKey));
      }
      hydratedRef.current.pause = true;
    }
    if (open === "finish" && !hydratedRef.current.finish) {
      const d = loadDraft<{
        report: string; issue: string; solution: string; overrideJustification: string;
      }>(finishDraftKey);
      if (d) {
        if (d.report) setReport(d.report);
        if (d.issue) setIssue(d.issue);
        if (d.solution) setSolution(d.solution);
        if (d.overrideJustification) setOverrideJustification(d.overrideJustification);
        setFinishRestoredAt(getDraftSavedAt(finishDraftKey));
      }
      hydratedRef.current.finish = true;
    }
    if (open === null) {
      hydratedRef.current.pause = false;
      hydratedRef.current.finish = false;
      setPauseRestoredAt(null);
      setFinishRestoredAt(null);
    }
  }, [open, pauseDraftKey, finishDraftKey]);

  // Auto-save debounced dos rascunhos (só quando o diálogo correspondente está aberto).
  useEffect(() => {
    if (open !== "pause") return;
    const hasContent = reason.trim() || reasonOther.trim();
    if (!hasContent) return;
    const t = setTimeout(() => saveDraft(pauseDraftKey, { reason, reasonOther }), 600);
    return () => clearTimeout(t);
  }, [open, reason, reasonOther, pauseDraftKey]);

  useEffect(() => {
    if (open !== "finish") return;
    const hasContent = report.trim() || issue.trim() || solution.trim() || overrideJustification.trim();
    if (!hasContent) return;
    const t = setTimeout(
      () => saveDraft(finishDraftKey, { report, issue, solution, overrideJustification }),
      600,
    );
    return () => clearTimeout(t);
  }, [open, report, issue, solution, overrideJustification, finishDraftKey]);

  const discardPauseDraft = () => {
    clearDraft(pauseDraftKey);
    setReason(""); setReasonOther(""); setPauseRestoredAt(null);
  };
  const discardFinishDraft = () => {
    clearDraft(finishDraftKey);
    setReport(""); setIssue(""); setSolution(""); setOverrideJustification("");
    setFinishRestoredAt(null);
  };

  const pendingFn = useServerFn(listPendingRequiredChecklist);
  const { data: pendingRequired = [] } = useQuery({
    queryKey: ["so-required-pending", serviceOrderId],
    queryFn: () => pendingFn({ data: { id: serviceOrderId } }),
    enabled: open === "finish",
  });


  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["so-mobile", serviceOrderId] });
      qc.invalidateQueries({ queryKey: ["so-exec-logs", serviceOrderId] });
      qc.invalidateQueries({ queryKey: ["so-list-mine"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      const action = (vars as any)?.data?.action;
      if (action === "PAUSED") clearDraft(pauseDraftKey);
      if (action === "FINISHED_EXECUTION") clearDraft(finishDraftKey);
      setOpen(null);
      setReason(""); setReasonOther(""); setReport(""); setIssue(""); setSolution("");
      setOverrideJustification("");
      setPauseRestoredAt(null); setFinishRestoredAt(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao executar ação"),
  });

  const submit = (action: "STARTED" | "PAUSED" | "RESUMED" | "FINISHED_EXECUTION") => {
    if (action === "PAUSED") {
      const r = reason === "Outro" ? reasonOther.trim() : reason;
      if (!r) { toast.error("Informe o motivo da pausa."); return; }
      mutation.mutate({ data: { id: serviceOrderId, action, reason: r } });
      return;
    }
    if (action === "FINISHED_EXECUTION") {
      if (!report.trim()) { toast.error("Informe o relatório técnico antes de finalizar."); return; }
      if (pendingRequired.length > 0) {
        if (!canOverride) {
          toast.error("Existem itens obrigatórios do checklist não concluídos.");
          return;
        }
        if (!overrideJustification.trim()) {
          toast.error("Informe a justificativa para finalizar com itens obrigatórios pendentes.");
          return;
        }
      }
      mutation.mutate({
        data: {
          id: serviceOrderId, action,
          technicianReport: report.trim(),
          issueFound: issue.trim() || undefined,
          solutionApplied: solution.trim() || undefined,
          ...(pendingRequired.length > 0
            ? { reason: `Override checklist obrigatório: ${overrideJustification.trim()}` }
            : {}),
        },
      });
      return;
    }

    mutation.mutate({ data: { id: serviceOrderId, action } });
  };

  if (status === "COMPLETED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> Execução técnica concluída.
      </div>
    );
  }
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <Ban className="h-4 w-4" /> Ordem de Serviço cancelada.
      </div>
    );
  }

  const noTech = !assignedTechnicianId;
  const blockStart = status === "SCHEDULED" && noTech && !isManager;

  return (
    <div className="space-y-2">
      {blockStart && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="h-4 w-4" /> OS sem técnico atribuído. Solicite a um gestor.
        </div>
      )}

      {status === "SCHEDULED" && (
        <Button size="lg" className="w-full h-12" disabled={blockStart} onClick={() => setOpen("start")}>
          <Play className="h-5 w-5 mr-2" /> Iniciar Atendimento
        </Button>
      )}

      {status === "IN_PROGRESS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button size="lg" variant="outline" className="h-12" onClick={() => setOpen("pause")}>
            <Pause className="h-5 w-5 mr-2" /> Pausar Atendimento
          </Button>
          <Button size="lg" className="h-12" onClick={() => setOpen("finish")}>
            <CheckCircle2 className="h-5 w-5 mr-2" /> Finalizar Execução Técnica
          </Button>
        </div>
      )}

      {status === "PAUSED" && (
        <Button size="lg" className="w-full h-12" onClick={() => setOpen("resume")}>
          <RefreshCw className="h-5 w-5 mr-2" /> Retomar Atendimento
        </Button>
      )}

      {/* Start */}
      <Dialog open={open === "start"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar atendimento?</DialogTitle>
            <DialogDescription>A Ordem de Serviço será marcada como em andamento.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={() => submit("STARTED")} disabled={mutation.isPending}>Iniciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause */}
      <Dialog open={open === "pause"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar atendimento?</DialogTitle>
            <DialogDescription>Informe o motivo para registrar no histórico da OS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo da pausa *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
                <SelectContent>
                  {PAUSE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {reason === "Outro" && (
              <div>
                <Label>Descreva o motivo *</Label>
                <Textarea value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={() => submit("PAUSED")} disabled={mutation.isPending}>Pausar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume */}
      <Dialog open={open === "resume"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retomar atendimento?</DialogTitle>
            <DialogDescription>A Ordem de Serviço voltará para o status Em andamento.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={() => submit("RESUMED")} disabled={mutation.isPending}>Retomar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish */}
      <Dialog open={open === "finish"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalizar execução técnica?</DialogTitle>
            <DialogDescription>
              A OS será marcada como concluída tecnicamente. O relatório final, assinatura
              do cliente e envio serão tratados na próxima fase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingRequired.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning space-y-1">
                <div className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Itens obrigatórios não concluídos
                </div>
                <ul className="list-disc list-inside">
                  {pendingRequired.map((i: any) => <li key={i.id}>{i.title}</li>)}
                </ul>
                {canOverride ? (
                  <div className="pt-2">
                    <Label className="text-xs">Justificativa para finalizar mesmo assim *</Label>
                    <Textarea
                      value={overrideJustification}
                      onChange={(e) => setOverrideJustification(e.target.value)}
                      rows={2}
                    />
                  </div>
                ) : (
                  <p className="pt-1">Conclua os itens obrigatórios antes de finalizar.</p>
                )}
              </div>
            )}
            <div>
              <Label>Relatório técnico resumido *</Label>
              <Textarea value={report} onChange={(e) => setReport(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>Problema encontrado (opcional)</Label>
              <Textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Solução aplicada (opcional)</Label>
              <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={() => submit("FINISHED_EXECUTION")} disabled={mutation.isPending}>Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
