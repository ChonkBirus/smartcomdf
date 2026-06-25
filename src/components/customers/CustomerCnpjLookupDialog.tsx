import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { lookupCnpj, type CnpjLookupResultDTO } from "@/lib/cnpj-lookup.functions";

type Props = {
  cnpj: string;
  disabled?: boolean;
  hasExistingData?: boolean;
  onApply: (data: CnpjLookupResultDTO, replaceExisting: boolean) => void;
};

export function CustomerCnpjLookupButton({ cnpj, disabled, hasExistingData, onApply }: Props) {
  const lookup = useServerFn(lookupCnpj);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CnpjLookupResultDTO | null>(null);

  const mut = useMutation({
    mutationFn: () => lookup({ data: { cnpj } }),
    onSuccess: (d) => {
      setResult(d);
      setOpen(true);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao consultar CNPJ."),
  });

  const onClick = () => {
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    mut.mutate();
  };

  const apply = (replace: boolean) => {
    if (result) onApply(result, replace);
    setOpen(false);
    setResult(null);
    toast.success("Dados aplicados ao formulário.");
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={disabled || mut.isPending}
      >
        {mut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
        Buscar dados
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados encontrados para este CNPJ</DialogTitle>
            <DialogDescription>
              {hasExistingData
                ? "Alguns campos já possuem informações. Deseja substituir pelos dados encontrados?"
                : "Confirme a aplicação dos dados ao formulário."}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <p><span className="text-muted-foreground">Razão social:</span> {result.corporate_name || "—"}</p>
              <p><span className="text-muted-foreground">Nome fantasia:</span> {result.trade_name || "—"}</p>
              <p>
                <span className="text-muted-foreground">Endereço:</span>{" "}
                {[result.address, result.number, result.district, result.city, result.state, result.zipcode]
                  .filter(Boolean).join(", ") || "—"}
              </p>
              <p><span className="text-muted-foreground">Situação:</span> {result.registration_status || "—"}</p>
              <p><span className="text-muted-foreground">Telefone:</span> {result.phone || "—"}</p>
              <p><span className="text-muted-foreground">E-mail:</span> {result.email || "—"}</p>
              <p><span className="text-muted-foreground">CNAE:</span> {result.main_activity || "—"}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => apply(true)}>
              {hasExistingData ? "Substituir e aplicar" : "Aplicar dados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
