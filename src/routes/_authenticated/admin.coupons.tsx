import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Edit2, Power, Ticket } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminToggleCoupon,
} from "@/lib/billing-coupons.functions";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: AdminCouponsPage,
});

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  duration: "once" | "repeating" | "forever";
  duration_months: number | null;
  max_redemptions: number | null;
  max_redemptions_per_company: number | null;
  redemption_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

function AdminCouponsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListCoupons);
  const toggleFn = useServerFn(adminToggleCoupon);
  const [editing, setEditing] = useState<CouponRow | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => listFn(),
  });

  const toggle = useMutation({
    mutationFn: (row: CouponRow) =>
      toggleFn({ data: { id: row.id, is_active: !row.is_active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
      toast.success("Status atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Gerencie cupons de desconto da plataforma."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo cupom
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4" /> Cupons cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum cupom cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">
                      {c.code}
                    </TableCell>
                    <TableCell>
                      {c.discount_type === "percent"
                        ? `${Number(c.discount_value)}%`
                        : `R$ ${Number(c.discount_value).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="capitalize">
                      {c.duration === "once"
                        ? "Uma vez"
                        : c.duration === "repeating"
                          ? `${c.duration_months ?? "?"} meses`
                          : "Sempre"}
                    </TableCell>
                    <TableCell>
                      {c.redemption_count}
                      {c.max_redemptions != null
                        ? ` / ${c.max_redemptions}`
                        : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.valid_until
                        ? `até ${new Date(c.valid_until).toLocaleDateString("pt-BR")}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggle.mutate(c)}
                          disabled={toggle.isPending}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CouponFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() =>
          qc.invalidateQueries({ queryKey: ["admin", "coupons"] })
        }
      />
    </div>
  );
}

function CouponFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: CouponRow | null;
  onSaved: () => void;
}) {
  const createFn = useServerFn(adminCreateCoupon);
  const updateFn = useServerFn(adminUpdateCoupon);

  const initial = useMemo(
    () => ({
      code: editing?.code ?? "",
      description: editing?.description ?? "",
      discount_type: (editing?.discount_type ?? "percent") as
        | "percent"
        | "fixed",
      discount_value: editing?.discount_value ?? 10,
      duration: (editing?.duration ?? "once") as
        | "once"
        | "repeating"
        | "forever",
      duration_months: editing?.duration_months ?? null,
      max_redemptions: editing?.max_redemptions ?? null,
      max_redemptions_per_company: editing?.max_redemptions_per_company ?? 1,
      valid_until: editing?.valid_until?.slice(0, 10) ?? "",
      is_active: editing?.is_active ?? true,
    }),
    [editing],
  );

  const [form, setForm] = useState(initial);
  // reset when opening with different editing
  useMemo(() => setForm(initial), [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        duration: form.duration,
        duration_months:
          form.duration === "repeating" && form.duration_months
            ? Number(form.duration_months)
            : null,
        max_redemptions: form.max_redemptions
          ? Number(form.max_redemptions)
          : null,
        max_redemptions_per_company: form.max_redemptions_per_company
          ? Number(form.max_redemptions_per_company)
          : null,
        valid_until: form.valid_until
          ? new Date(form.valid_until + "T23:59:59").toISOString()
          : null,
        is_active: form.is_active,
      };
      if (editing) {
        return updateFn({ data: { id: editing.id, ...payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Cupom atualizado." : "Cupom criado.");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar cupom" : "Novo cupom"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
              placeholder="PROMO10"
              disabled={!!editing}
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="desc">Descrição</Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Tipo de desconto</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v: any) =>
                  setForm({ ...form, discount_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>
                Valor {form.discount_type === "percent" ? "(%)" : "(R$)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.discount_value ?? 0}
                onChange={(e) =>
                  setForm({ ...form, discount_value: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Duração</Label>
              <Select
                value={form.duration}
                onValueChange={(v: any) => setForm({ ...form, duration: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Uma vez</SelectItem>
                  <SelectItem value="repeating">Por X meses</SelectItem>
                  <SelectItem value="forever">Para sempre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.duration === "repeating" && (
              <div className="grid gap-1">
                <Label>Meses</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.duration_months ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_months: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Máx. de usos (total)</Label>
              <Input
                type="number"
                min="1"
                value={form.max_redemptions ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    max_redemptions: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="Ilimitado"
              />
            </div>
            <div className="grid gap-1">
              <Label>Máx. por empresa</Label>
              <Input
                type="number"
                min="1"
                value={form.max_redemptions_per_company ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    max_redemptions_per_company: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="Ilimitado"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label>Validade (até)</Label>
            <Input
              type="date"
              value={form.valid_until}
              onChange={(e) =>
                setForm({ ...form, valid_until: e.target.value })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Cupons inativos não podem ser aplicados no checkout.
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
