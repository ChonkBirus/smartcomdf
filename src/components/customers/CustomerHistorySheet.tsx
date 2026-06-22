import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Phone, Mail, Calendar, Users, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listCustomerHistory, addCustomerHistory, type CustomerHistoryType } from "@/lib/customers.functions";

const TYPE_META: Record<CustomerHistoryType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  NOTE: { label: "Nota", icon: Calendar },
  CALL: { label: "Ligação", icon: Phone },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  EMAIL: { label: "E-mail", icon: Mail },
  MEETING: { label: "Reunião", icon: Users },
  SYSTEM: { label: "Sistema", icon: Calendar },
};

export function CustomerHistorySheet({
  open, onOpenChange, customerId, customerName,
}: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string; customerName: string }) {
  const qc = useQueryClient();
  const fetchHistory = useServerFn(listCustomerHistory);
  const add = useServerFn(addCustomerHistory);
  const [type, setType] = useState<CustomerHistoryType>("NOTE");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const { data } = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: () => fetchHistory({ data: { customer_id: customerId } }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => add({ data: { customer_id: customerId, history_type: type, title, description: desc } }),
    onSuccess: () => {
      toast.success("Interação registrada.");
      setTitle(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["customer-history", customerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Histórico — {customerName}</SheetTitle>
          <SheetDescription>Registre interações, ligações, reuniões e anotações.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as CustomerHistoryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_META).filter(([k]) => k !== "SYSTEM").map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligação de follow-up" />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={!title.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
              <Plus className="mr-1 h-4 w-4" />Registrar
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {(data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
          )}
          {(data ?? []).map((h) => {
            const meta = TYPE_META[h.history_type];
            const Icon = meta.icon;
            return (
              <div key={h.id} className="flex gap-3 border-l-2 border-primary/30 pl-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.title}</span>
                    <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                  </div>
                  {h.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{h.description}</p>}
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
