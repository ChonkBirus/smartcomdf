import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { deleteOpportunity, getOpportunity, listCrmTeam, updateOpportunity } from "@/lib/crm.functions";

type Props = {
  opportunityId: string | null;
  onOpenChange: (v: boolean) => void;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OpportunityDrawer({ opportunityId, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fetchOne = useServerFn(getOpportunity);
  const fetchTeam = useServerFn(listCrmTeam);
  const update = useServerFn(updateOpportunity);
  const remove = useServerFn(deleteOpportunity);

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "opportunity", opportunityId],
    queryFn: () => fetchOne({ data: { id: opportunityId! } }),
    enabled: !!opportunityId,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["crm", "team"],
    queryFn: () => fetchTeam(),
    enabled: !!opportunityId,
    staleTime: 60_000,
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data?.opportunity) {
      setForm({
        ...data.opportunity,
        estimated_value: String(data.opportunity.estimated_value ?? 0),
        next_follow_up_at: data.opportunity.next_follow_up_at
          ? new Date(data.opportunity.next_follow_up_at).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [data?.opportunity]);

  const save = useMutation({
    mutationFn: async () => {
      return await update({
        data: {
          id: opportunityId!,
          lead_name: form.lead_name,
          lead_type: form.lead_type,
          company_name: form.company_name || null,
          phone: form.phone || null,
          email: form.email || null,
          service_interest: form.service_interest || null,
          description: form.description || null,
          estimated_value: Number(form.estimated_value || 0),
          temperature: form.temperature,
          source: form.source || null,
          customer_type: form.customer_type || null,
          assigned_to: form.assigned_to || null,
          next_action: form.next_action || null,
          next_follow_up_at: form.next_follow_up_at || null,
        } as any,
      });
    },
    onSuccess: () => {
      toast.success("Lead atualizado.");
      qc.invalidateQueries({ queryKey: ["crm"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
  });

  const del = useMutation({
    mutationFn: async () => await remove({ data: { id: opportunityId! } }),
    onSuccess: () => {
      toast.success("Lead removido.");
      qc.invalidateQueries({ queryKey: ["crm"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  return (
    <Sheet open={!!opportunityId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{form?.lead_name ?? "Lead"}</SheetTitle>
        </SheetHeader>

        {isLoading || !form ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{form.lead_type === "pj" ? "PJ" : "PF"}</Badge>
              <Badge variant="outline">{form.temperature}</Badge>
              <span className="text-muted-foreground">
                Valor: <span className="font-medium text-foreground">{brl(Number(form.estimated_value || 0))}</span>
              </span>
            </div>

            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.lead_name} onChange={(e) => setForm({ ...form, lead_name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Interesse</Label>
              <Input
                value={form.service_interest ?? ""}
                onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor estimado</Label>
                <Input
                  inputMode="decimal"
                  value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value.replace(/[^0-9.,]/g, "") })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Temperatura</Label>
                <Select value={form.temperature} onValueChange={(v) => setForm({ ...form, temperature: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Frio</SelectItem>
                    <SelectItem value="warm">Morno</SelectItem>
                    <SelectItem value="hot">Quente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Responsável</Label>
                <Select value={form.assigned_to ?? ""} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>
                    {team.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Origem</Label>
                <Select value={form.source ?? ""} onValueChange={(v) => setForm({ ...form, source: v })}>
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
                <Label>Próxima ação</Label>
                <Input
                  value={form.next_action ?? ""}
                  onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Follow-up em</Label>
                <Input
                  type="datetime-local"
                  value={form.next_follow_up_at ?? ""}
                  onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Descrição / Notas</Label>
              <Textarea
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm("Remover este lead?")) del.mutate();
                }}
                disabled={del.isPending}
              >
                Excluir
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>

            <Separator className="my-2" />

            <div>
              <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
              <ul className="space-y-2 text-sm">
                {(data?.timeline ?? []).map((t: any) => (
                  <li key={t.id} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </li>
                ))}
                {(data?.timeline ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">Sem eventos ainda.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
