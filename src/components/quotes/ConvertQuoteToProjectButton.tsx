import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { convertQuoteToProject } from "@/lib/projects.functions";
import { listTeam } from "@/lib/team.functions";
import { usePermissions } from "@/lib/permissions";

type Props = {
  quoteId: string;
  status: string;
  paymentStatus: string;
  financialStatus?: string | null;
};

const NONE = "__none__";

export function ConvertQuoteToProjectButton({ quoteId, status, paymentStatus, financialStatus }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const convert = useServerFn(convertQuoteToProject);
  const fetchTeam = useServerFn(listTeam);
  const [open, setOpen] = useState(false);
  const [responsibleId, setResponsibleId] = useState<string>(NONE);

  const canConvert = has("projects.convert_from_quote");
  const alreadyConverted = status === "CONVERTED";
  const notApproved = status !== "APPROVED" && !alreadyConverted;
  const financiallyOk =
    financialStatus === "PARTIALLY_PAID" ||
    financialStatus === "PAID" ||
    paymentStatus === "PAYMENT_APPROVED";
  const waitingPayment = status === "APPROVED" && !financiallyOk;
  const enabled = canConvert && status === "APPROVED" && financiallyOk;

  const { data: team } = useQuery({
    queryKey: ["team-members-lite"],
    queryFn: () => fetchTeam(),
    enabled: open,
  });
  const members = team?.members ?? [];

  const tooltip = !canConvert
    ? "Você não tem permissão para converter."
    : alreadyConverted
      ? "Orçamento já convertido."
      : notApproved
        ? "Orçamento ainda não aprovado."
        : waitingPayment
          ? "Aguardando pagamento da entrada."
          : "Converter este orçamento em projeto.";

  const mut = useMutation({
    mutationFn: () => convert({
      data: {
        quote_id: quoteId,
        responsible_user_id: responsibleId === NONE ? null : responsibleId,
      },
    }),
    onSuccess: (res) => {
      toast.success("Projeto criado com sucesso.");
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
      setOpen(false);
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao converter."),
  });

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                onClick={() => setOpen(true)}
                disabled={!enabled || mut.isPending}
                className="w-full"
              >
                <Rocket className="mr-1 h-4 w-4" />
                Converter em Projeto
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
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
              onClick={(e) => { e.preventDefault(); mut.mutate(); }}
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
