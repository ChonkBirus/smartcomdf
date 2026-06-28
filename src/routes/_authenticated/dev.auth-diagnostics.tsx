import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Trash2, ShieldAlert } from "lucide-react";
import {
  clearAuthDevLog,
  isAuthDevEnabled,
  readAuthDevLog,
  type AuthDevEntry,
} from "@/lib/auth-dev-log";
import { APP_BASE_URL, appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/_authenticated/dev/auth-diagnostics")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de Auth (DEV) — SmartCom Pro" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DevAuthDiagnosticsPage,
});

const FLOW_LABEL: Record<AuthDevEntry["flow"], string> = {
  signup: "Cadastro",
  reset_password: "Recuperar senha",
  invite: "Convite",
  invite_resend: "Reenviar convite",
};

const STATUS_VARIANT: Record<AuthDevEntry["status"], "default" | "secondary" | "destructive"> = {
  attempt: "secondary",
  success: "default",
  error: "destructive",
};

function DevAuthDiagnosticsPage() {
  const enabled = isAuthDevEnabled();
  const [entries, setEntries] = useState<AuthDevEntry[]>([]);
  const [origin, setOrigin] = useState<string>("");

  const refresh = () => setEntries(readAuthDevLog());

  useEffect(() => {
    refresh();
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  if (!enabled) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Disponível apenas em desenvolvimento
            </CardTitle>
            <CardDescription>
              Esta página de diagnóstico é desativada em produção para não expor dados de fluxos de autenticação.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const counts = entries.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Diagnóstico de Auth (DEV)</h1>
        <p className="text-sm text-muted-foreground">
          Eventos locais de signUp, reset de senha e convites. E-mails são mascarados; nenhum token,
          senha ou cabeçalho é registrado. Buffer local de até 50 entradas (apenas neste navegador).
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ambiente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">APP_BASE_URL:</span> <code>{APP_BASE_URL}</code></div>
          <div><span className="text-muted-foreground">window.origin:</span> <code>{origin || "—"}</code></div>
          <div><span className="text-muted-foreground">appUrl("/dashboard"):</span> <code>{appUrl("/dashboard")}</code></div>
          <div><span className="text-muted-foreground">appUrl("/reset-password"):</span> <code>{appUrl("/reset-password")}</code></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Eventos recentes</CardTitle>
            <CardDescription>
              {entries.length} registro(s) · sucesso: {counts.success ?? 0} · erro: {counts.error ?? 0} ·
              tentativa: {counts.attempt ?? 0}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAuthDevLog();
                refresh();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento registrado ainda. Use o cadastro, recuperar senha ou convites para gerar entradas.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e, i) => (
                <li key={`${e.ts}-${i}`} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[e.status]}>{e.status}</Badge>
                    <span className="font-medium">{FLOW_LABEL[e.flow] ?? e.flow}</span>
                    <span className="text-xs text-muted-foreground">{new Date(e.ts).toLocaleString()}</span>
                  </div>
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {e.emailMasked && <span>email: <code>{e.emailMasked}</code></span>}
                    {e.redirectUrl && <span>redirect: <code className="break-all">{e.redirectUrl}</code></span>}
                  </div>
                  {e.message && (
                    <p className="text-xs text-destructive break-words">erro: {e.message}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
