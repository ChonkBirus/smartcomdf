import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Rocket, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { toast } from "sonner";
import { convertQuoteToProject, getProjectByQuote } from "@/lib/projects.functions";
import { listTeam } from "@/lib/team.functions";
import { usePermissions } from "@/lib/permissions";

type Props = {
  quoteId: string;
  status: string;
  financialStatus?: string | null;
  projectId?: string | null;
};

const NONE = "__none__";

export function ConvertQuoteToProjectButton({
  quoteId,
  status,
  financialStatus,
  projectId,
}: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const convert = useServerFn(convertQuoteToProject);
  const fetchByQuote = useServerFn(getProjectByQuote);
  const fetchTeam = useServerFn(listTeam);
  const [open, setOpen] = useState(false);
  const [responsibleId, setResponsibleId] = useState<string>(NONE);

  const { data: existingProject } = useQuery({
    queryKey: ["project-by-quote", quoteId],
    queryFn: () => fetchByQuote({ data: { quote_id: quoteId } }),
    enabled: !projectId,
  });

  const project = existingProject ?? (projectId ? { id: projectId, project_number: "" } : null);

  const canConvert = has("projects.convert_from_quote") || has("projects.create");
  const financiallyOk = financialStatus === "PARTIALLY_PAID" || financialStatus === "PAID";
  const isApproved = status === "APPROVED" || status === "CONVERTED";
  const enabled = canConvert && isApproved && financiallyOk && !project;

  const { data: team } = useQuery({
    queryKey: ["team-members-lite"],
    queryFn: () => fetchTeam(),
    enabled: open,
  });
  const members = team?.members ?? [];

  const mut = useMutation({
    mutationFn: () =>
      convert({
        data: {
          quote_id: quoteId,
          responsible_user_id: responsibleId === NONE ? null : responsibleId,
        },
      }),
    onSuccess: (res) => {
      toast.success("Projeto criado com sucesso.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project-by-quote", quoteId] });
      setOpen(false);
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao converter."),
  });

  if (project) {
    const label = (project as any).project_number
      ? `Abrir projeto ${(project as any).project_number}`
      : "Abrir projeto";
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => navigate({ to: "/projects/$id", params: { id: project.id } })}
      >
        <ExternalLink className="mr-1 h-4 w-4" />
        {label}
      </Button>
    );
  }

  if (!enabled) {
    // Estado informativo discreto — não bloqueia a UI
    const hint = !canConvert
      ? "Sem permissão para converter em projeto."
      : !isApproved
        ? "Disponível após aprovação do orçamento."
        : "Aguardando pagamento (parcial ou total) para criar o projeto.";
    return <p className="text-xs text-muted-foreground text-center">{hint}</p>;
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block w-full">
              <Button onClick={() => setOpen(true)} disabled={mut.isPending} className="w-full">
                <Rocket className="mr-1 h-4 w-4" />
                Criar projeto
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Converter este orçamento em projeto.</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter este orçamento em projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              O projeto será criado com os dados aprovados pelo cliente e ficará pronto para
              agendamento da execução.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="responsible">Responsável pelo projeto (opcional)</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger id="responsible">
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {members.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Recomendado. Você poderá definir/alterar depois na tela do projeto.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                mut.mutate();
              }}
              disabled={mut.isPending}
            >
              {mut.isPending ? "Criando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
