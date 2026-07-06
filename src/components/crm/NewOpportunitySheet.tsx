import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelWithHelp } from "@/components/ui/FieldHelp";
import { createOpportunity, listCrmTeam } from "@/lib/crm.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId?: string;
  defaultStageId?: string;
  onCreated?: (id: string) => void;
};

const empty = {
  lead_name: "",
  lead_type: "pf" as "pf" | "pj",
  company_name: "",
  phone: "",
  email: "",
  service_interest: "",
  description: "",
  estimated_value: "0",
  temperature: "warm" as "cold" | "warm" | "hot",
  source: "" as string,
  customer_type: "" as string,
  assigned_to: "" as string,
  next_action: "",
  next_follow_up_at: "",
};

export function NewOpportunitySheet({ open, onOpenChange, pipelineId, defaultStageId, onCreated }: Props) {
  const [form, setForm] = useState(empty);
  const qc = useQueryClient();
  const fetchTeam = useServerFn(listCrmTeam);
  const create = useServerFn(createOpportunity);

  const { data: team = [] } = useQuery({
    queryKey: ["crm", "team"],
    queryFn: () => fetchTeam(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) setForm(empty);
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        pipeline_id: pipelineId,
        stage_id: defaultStageId,
        lead_name: form.lead_name.trim(),
        lead_type: form.lead_type,
        company_name: form.company_name || null,
        phone: form.phone || null,
        email: form.email || null,
        service_interest: form.service_interest || null,
        description: form.description || null,
        estimated_value: Number(form.estimated_value || 0),
        temperature: form.temperature,
        source: (form.source || null) as any,
        customer_type: (form.customer_type || null) as any,
        assigned_to: form.assigned_to || null,
        next_action: form.next_action || null,
        next_follow_up_at: form.next_follow_up_at || null,
      };
      return await create({ data: payload as any });
    },
    onSuccess: (res: any) => {
      toast.success("Lead criado com sucesso.");
      qc.invalidateQueries({ queryKey: ["crm"] });
      onOpenChange(false);
      onCreated?.(res.id);
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao criar lead."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Novo lead</SheetTitle>
          <SheetDescription>Cadastre uma nova oportunidade no funil.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <LabelWithHelp
              label="Nome do lead *"
              help="Nome da pessoa (ou responsável, se empresa) com quem você está negociando."
            />
            <Input
              value={form.lead_name}
              onChange={(e) => setForm({ ...form, lead_name: e.target.value })}
              placeholder="Nome do contato"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.lead_type} onValueChange={(v) => setForm({ ...form, lead_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Temperatura</Label>
              <Select value={form.temperature} onValueChange={(v) => setForm({ ...form, temperature: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">Frio</SelectItem>
                  <SelectItem value="warm">Morno</SelectItem>
                  <SelectItem value="hot">Quente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.lead_type === "pj" && (
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Telefone / WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Interesse / Serviço</Label>
            <Input
              value={form.service_interest}
              onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
              placeholder="Ex: instalação de câmeras"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Valor estimado (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.estimated_value}
                onChange={(e) => setForm({ ...form, estimated_value: e.target.value.replace(/[^0-9.,]/g, "") })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {["site","indicacao","whatsapp","instagram","facebook","google","ligacao","visita","evento","outro"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Segmento</Label>
              <Select value={form.customer_type} onValueChange={(v) => setForm({ ...form, customer_type: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {["residencial","comercial","industrial","condominio","outro"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {team.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Próxima ação</Label>
              <Input value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Follow-up em</Label>
              <Input
                type="datetime-local"
                value={form.next_follow_up_at}
                onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || form.lead_name.trim().length < 2}
            >
              {mutation.isPending ? "Salvando…" : "Criar lead"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
