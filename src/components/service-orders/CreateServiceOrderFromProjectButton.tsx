import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Wrench, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  createServiceOrderFromProject, findServiceOrderByProject,
} from "@/lib/service-orders.functions";
import { Can } from "@/components/app/PermissionRoute";

export function CreateServiceOrderFromProjectButton({
  projectId, planningReady,
}: { projectId: string; planningReady: boolean }) {
  const navigate = useNavigate();
  const findFn = useServerFn(findServiceOrderByProject);
  const createFn = useServerFn(createServiceOrderFromProject);
  const [open, setOpen] = useState(false);

  const { data: existing, refetch } = useQuery({
    queryKey: ["service-order-by-project", projectId],
    queryFn: () => findFn({ data: { project_id: projectId } }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { project_id: projectId } }),
    onSuccess: ({ service_order_id }) => {
      toast.success("Ordem de Serviço criada.");
      setOpen(false);
      navigate({ to: "/service-orders/$id", params: { id: service_order_id } } as any);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar OS."),
  });

  if (existing) {
    return (
      <Button
        variant="outline" size="sm"
        onClick={() => navigate({ to: "/service-orders/$id", params: { id: existing.id } } as any)}
      >
        <ExternalLink className="mr-1 h-4 w-4" />Ver OS {existing.service_order_number}
      </Button>
    );
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
      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (v) refetch(); }}>
        <AlertDialogTrigger asChild>{btn}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Ordem de Serviço para este projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              A OS será criada com os dados do projeto, cliente, endereço, técnico,
              instruções e itens previstos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); createMut.mutate(); }}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Gerando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Can>
  );
}
