import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getSupplier, saveSupplier } from "@/lib/suppliers.functions";
import { CepInput } from "@/components/shared/CepInput";
import type { CepResult } from "@/lib/address-lookup";
import { CustomerCnpjLookupButton } from "@/components/customers/CustomerCnpjLookupDialog";
import type { CnpjLookupResultDTO } from "@/lib/cnpj-lookup.functions";

type FormState = {
  id?: string;
  corporate_name: string;
  trade_name: string;
  cpf_cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  zipcode: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  active: boolean;
};

const EMPTY: FormState = {
  corporate_name: "", trade_name: "", cpf_cnpj: "", email: "", phone: "",
  whatsapp: "", website: "", zipcode: "", address: "", number: "", complement: "",
  district: "", city: "", state: "", notes: "", active: true,
};

export function SupplierFormSheet({
  open, onOpenChange, supplierId,
}: { open: boolean; onOpenChange: (o: boolean) => void; supplierId: string | null }) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getSupplier);
  const save = useServerFn(saveSupplier);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: existing } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: () => fetchOne({ data: { id: supplierId! } }),
    enabled: !!supplierId && open,
  });

  useEffect(() => {
    if (!open) return;
    if (supplierId && existing) {
      setForm({
        id: existing.id,
        corporate_name: existing.corporate_name,
        trade_name: existing.trade_name ?? "",
        cpf_cnpj: existing.cpf_cnpj,
        email: existing.email ?? "",
        phone: existing.phone ?? "",
        whatsapp: existing.whatsapp ?? "",
        website: existing.website ?? "",
        zipcode: existing.zipcode ?? "",
        address: existing.address ?? "",
        number: existing.number ?? "",
        complement: existing.complement ?? "",
        district: existing.district ?? "",
        city: existing.city ?? "",
        state: existing.state ?? "",
        notes: existing.notes ?? "",
        active: existing.active,
      });
    } else if (!supplierId) {
      setForm(EMPTY);
    }
  }, [open, supplierId, existing]);

  const mutation = useMutation({
    mutationFn: (payload: FormState) => save({ data: payload as any }),
    onSuccess: () => {
      toast.success(form.id ? "Fornecedor atualizado." : "Fornecedor criado.");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.corporate_name.trim()) return toast.error("Razão social obrigatória.");
    if (!form.cpf_cnpj.trim()) return toast.error("CPF/CNPJ obrigatório.");
    mutation.mutate(form);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</SheetTitle>
          <SheetDescription>Dados cadastrais e contato.</SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Identificação</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Razão social *</Label>
                <Input value={form.corporate_name} onChange={(e) => set("corporate_name", e.target.value)} required />
              </div>
              <div>
                <Label>Nome fantasia</Label>
                <Input value={form.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
              </div>
              <div>
                <Label>CPF/CNPJ *</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} required />
              </div>
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Contato</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><Label>Site</Label><Input value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Endereço</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>CEP</Label><Input value={form.zipcode} onChange={(e) => set("zipcode", e.target.value)} /></div>
              <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
              <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div><Label>Número</Label><Input value={form.number} onChange={(e) => set("number", e.target.value)} /></div>
              <div><Label>Complemento</Label><Input value={form.complement} onChange={(e) => set("complement", e.target.value)} /></div>
              <div><Label>Bairro</Label><Input value={form.district} onChange={(e) => set("district", e.target.value)} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></div>
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="font-medium">Ativo</Label>
                <p className="text-xs text-muted-foreground">Fornecedores inativos não aparecem em novos pedidos.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>
          </section>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
