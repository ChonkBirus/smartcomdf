import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Pause, RefreshCw, CheckCircle2, History, FileText } from "lucide-react";
import { listServiceOrderExecutionLogs } from "@/lib/service-order-execution.functions";

const ACTION_META: Record<string, { icon: any; label: string; color: string }> = {
  STARTED: { icon: Play, label: "Atendimento iniciado", color: "text-success" },
  PAUSED: { icon: Pause, label: "Atendimento pausado", color: "text-warning" },
  RESUMED: { icon: RefreshCw, label: "Atendimento retomado", color: "text-primary" },
  FINISHED_EXECUTION: { icon: CheckCircle2, label: "Execução técnica finalizada", color: "text-success" },
  STATUS_CHANGED: { icon: History, label: "Status alterado", color: "text-muted-foreground" },
  NOTE_ADDED: { icon: FileText, label: "Observação adicionada", color: "text-muted-foreground" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ExecutionTimeline({ serviceOrderId }: { serviceOrderId: string }) {
  const fetchFn = useServerFn(listServiceOrderExecutionLogs);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["so-exec-logs", serviceOrderId],
    queryFn: () => fetchFn({ data: { id: serviceOrderId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">Sem eventos registrados ainda.</p>;

  return (
    <ol className="relative border-l pl-4 space-y-4">
      {logs.map((log) => {
        const meta = ACTION_META[log.action] ?? { icon: History, label: log.action, color: "text-muted-foreground" };
        const Icon = meta.icon;
        const md = log.metadata ?? {};
        return (
          <li key={log.id} className="relative">
            <span className={`absolute -left-[26px] top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background border ${meta.color}`}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm font-medium">{meta.label}</div>
            <div className="text-xs text-muted-foreground">
              Por: {log.user_name ?? "—"} · {fmt(log.created_at)}
              {log.previous_status && log.new_status && (
                <> · {log.previous_status} → {log.new_status}</>
              )}
            </div>
            {md.reason && (
              <p className="text-xs mt-1"><span className="font-semibold">Motivo:</span> {md.reason}</p>
            )}
            {md.technician_report && (
              <p className="text-xs mt-1"><span className="font-semibold">Relatório:</span> {md.technician_report}</p>
            )}
            {md.issue_found && (
              <p className="text-xs mt-1"><span className="font-semibold">Problema:</span> {md.issue_found}</p>
            )}
            {md.solution_applied && (
              <p className="text-xs mt-1"><span className="font-semibold">Solução:</span> {md.solution_applied}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
