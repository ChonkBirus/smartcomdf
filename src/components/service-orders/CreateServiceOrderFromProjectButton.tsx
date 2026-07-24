import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { createServiceOrderFromProject } from "@/lib/service-orders.functions";
import { getProject } from "@/lib/projects.functions";
import { listTeam } from "@/lib/team.functions";
import { Can } from "@/components/app/PermissionRoute";

export function CreateServiceOrderFromProjectButton({
  projectId, planningReady,
}: { projectId: string; planningReady: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createServiceOrderFromProject);
  const getProjectFn = useServerFn(getProject);
  const fetchTeam = useServerFn(listTeam);
  const [open, setOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState<string>("");

  const { data: projectData } = useQuery({
    queryKey: ["project-brief", projectId],
    queryFn: () => getProjectFn({ data: { id: projectId } }),
    enabled: open,
  });

  const { data: team } = useQuery({
    queryKey: ["team-members-lite"],
    queryFn: () => fetchTeam(),
    enabled: open,
  });
  const members = team?.members ?? [];

  const projectResponsible = projectData?.project?.responsible_user_id ?? null;
  useEffect(() => {
    if (open) setTechnicianId(projectResponsible ?? "");
  }, [open, projectResponsible]);

  // D2 — Guarda síncrona: bloqueia reentrância antes do próximo render
  // (createMut.isPending só vira true depois do re-render, permitindo
  // duplo-clique/Enter repetido escaparem entre o clique e o setState).
  const submittingRef = useRef(false);
  // Client request id preparado por intenção — só é regenerado após sucesso
  // ou nova intenção explícita. Em erro ambíguo (rede) preservamos o mesmo id
  // para permitir retry idempotente quando D3 estiver aplicada no servidor.
  const clientRequestIdRef = useRef<string | null>(null);
  const navigatedRef = useRef(false);

  function ensureClientRequestId(): string {
    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return clientRequestIdRef.current;
  }

  const createMut = useMutation({
    mutationFn: () => {
      // client_request_id ainda NÃO é enviado ao servidor: a assinatura RPC
      // atual não aceita o parâmetro. Será propagado quando D3 for aplicada.
      ensureClientRequestId();
      return createFn({
        data: {
          project_id: projectId,
          assigned_technician_id: technicianId || null,
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar OS."),
  });

  // Ao reabrir o diálogo (nova intenção explícita do usuário), zera o id.
  useEffect(() => {
    if (open) {
      clientRequestIdRef.current = null;
      navigatedRef.current = false;
    }
  }, [open]);

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = await createMut.mutateAsync();
      toast.success("Ordem de Serviço criada.");
      // limpa o id só após sucesso confirmado
      clientRequestIdRef.current = null;
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["project-service-orders", projectId] });
      if (!navigatedRef.current && result?.service_order_id) {
        navigatedRef.current = true;
        navigate({
          to: "/service-orders/$id",
          params: { id: result.service_order_id },
        } as any);
      }
    } catch {
      // erro ambíguo: mantém clientRequestIdRef preservado para retry idempotente
    } finally {
      submittingRef.current = false;
    }
  }

  const btn = (
    <Button size="sm" disabled={!planningReady}>
      <Wrench className="mr-1 h-4 w-4" />Gerar Ordem de Serviço
    </Button>
  );

  if (!planningReady) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
          <TooltipContent>Finalize o planejamento antes de gerar a Ordem de Serviço.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Can module="service_orders" action="create">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>{btn}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Ordem de Serviço para este projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              A OS será criada com os dados do projeto, cliente, endereço, instruções e itens
              previstos. Escolha o técnico responsável pela execução desta OS.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="technician">Técnico responsável pela OS</Label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger id="technician">
                <SelectValue placeholder="Selecione um técnico" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                    {m.id === projectResponsible ? "  (responsável do projeto)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sugestão inicial: responsável do projeto. Alterar aqui não altera o responsável do projeto.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              onKeyDown={(e) => {
                if (e.key === "Enter" && submittingRef.current) e.preventDefault();
              }}
              disabled={createMut.isPending || (!technicianId && !projectResponsible)}
            >
              {createMut.isPending ? "Gerando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Can>
  );
}
