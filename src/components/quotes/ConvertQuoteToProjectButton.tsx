import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { convertQuoteToProject } from "@/lib/projects.functions";
import { usePermissions } from "@/lib/permissions";

type Props = {
  quoteId: string;
  status: string;
  paymentStatus: string;
};

export function ConvertQuoteToProjectButton({ quoteId, status, paymentStatus }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const convert = useServerFn(convertQuoteToProject);
  const [open, setOpen] = useState(false);

  const canConvert = has("projects.convert_from_quote");
  const alreadyConverted = status === "CONVERTED";
  const notApproved = status !== "APPROVED" && !alreadyConverted;
  const waitingPayment = status === "APPROVED" && paymentStatus !== "PAYMENT_APPROVED";
  const enabled =
    canConvert && status === "APPROVED" && paymentStatus === "PAYMENT_APPROVED";

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
    mutationFn: () => convert({ data: { quote_id: quoteId } }),
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
