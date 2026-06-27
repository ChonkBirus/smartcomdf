import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { acceptInvitation } from "@/lib/team.functions";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Convite — SecureERP" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const accept = useServerFn(acceptInvitation);
  const [status, setStatus] = useState<"checking" | "needs-auth" | "ready" | "accepting" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "ready" : "needs-auth");
    });
  }, []);

  const onAccept = async () => {
    setStatus("accepting");
    try {
      await accept({ data: { token } });
      toast.success("Convite aceito! Bem-vindo à equipe.");
      qc.invalidateQueries();
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e.message ?? "Falha ao aceitar convite.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="card-elevated w-full max-w-md">
        <CardHeader className="text-center">
          <div className="brand-gradient mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Convite para o SecureERP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "checking" && <p className="text-sm text-muted-foreground">Verificando convite...</p>}

          {status === "needs-auth" && (
            <>
              <p className="text-sm text-muted-foreground">
                Você precisa entrar (ou criar uma conta com o e-mail convidado) antes de aceitar.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth" search={{ redirect: `/invite/${token}` } as any}>Entrar / Cadastrar</Link>
              </Button>
            </>
          )}

          {status === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">
                Clique abaixo para aceitar este convite e vincular sua conta à empresa.
              </p>
              <Button onClick={onAccept} className="w-full">Aceitar convite</Button>
            </>
          )}

          {status === "accepting" && <p className="text-sm text-muted-foreground">Aceitando...</p>}

          {status === "error" && (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="secondary" onClick={() => navigate({ to: "/dashboard" })}>Ir para o painel</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
