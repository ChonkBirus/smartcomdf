import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Search, Users, Power, PowerOff } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { ForbiddenPage } from "@/components/app/PermissionRoute";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { usePermissions } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeActive,
  type Employee,
} from "@/lib/employees.functions";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Funcionários — SmartPro" }] }),
  component: EmployeesGate,
});

function EmployeesGate() {
  const { isOwner, isSuperAdmin, has } = usePermissions();
  const canAccess = isOwner || isSuperAdmin || has("employees.manage");
  if (!canAccess) {
    return (
      <ForbiddenPage message="Somente proprietários, gestores ou usuários com permissão de gerenciar funcionários podem acessar esta tela." />
    );
  }
  return <EmployeesPage />;
}

type FilterActive = "ALL" | "ACTIVE" | "INACTIVE";

function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterActive>("ACTIVE");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const fetchList = useServerFn(listEmployees);
  const toggleFn = useServerFn(toggleEmployeeActive);

  const activeParam = activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE";

  const { data, isLoading } = useQuery({
    queryKey: ["employees", { search, roleFilter, activeParam }],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          role: roleFilter || undefined,
          active: activeParam,
        },
      }),
  });

  const rows = data ?? [];

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar."),
  });

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (e: Employee) => {
    setEditing(e);
    setSheetOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Funcionários / Equipe de Campo"
        description="Cadastro de ajudantes e funcionários operacionais para vincular a projetos e OS."
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo funcionário
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, telefone…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-full sm:w-56">
            <Label className="text-xs">Função</Label>
            <Input
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              placeholder="Ex.: Ajudante"
            />
          </div>
          <div className="w-full sm:w-44">
            <Label className="text-xs">Status</Label>
            <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterActive)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativos</SelectItem>
                <SelectItem value="INACTIVE">Inativos</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum funcionário cadastrado"
          description="Cadastre ajudantes e funcionários operacionais para vincular a projetos e ordens de serviço."
          action={
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Cadastrar funcionário
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Diária</TableHead>
                    <TableHead className="text-right">Transporte</TableHead>
                    <TableHead className="text-right">Almoço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.name}</div>
                        {e.notes && (
                          <div className="max-w-[280px] truncate text-xs text-muted-foreground">
                            {e.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{e.role ?? "—"}</TableCell>
                      <TableCell className="text-sm">{e.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(e.daily_rate))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(e.transport_cost))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(e.meal_cost))}
                      </TableCell>
                      <TableCell>
                        {e.active ? (
                          <Badge variant="secondary">Ativo</Badge>
                        ) : (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={e.active ? "Inativar" : "Ativar"}
                            onClick={() => toggleMut.mutate({ id: e.id, active: !e.active })}
                          >
                            {e.active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {rows.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.role ?? "Sem função"} · {e.phone ?? "sem telefone"}
                      </p>
                    </div>
                    {e.active ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Diária</p>
                      <p className="font-medium">{formatCurrency(Number(e.daily_rate))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Transporte</p>
                      <p className="font-medium">{formatCurrency(Number(e.transport_cost))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Almoço</p>
                      <p className="font-medium">{formatCurrency(Number(e.meal_cost))}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(e)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMut.mutate({ id: e.id, active: !e.active })}
                    >
                      {e.active ? "Inativar" : "Ativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <EmployeeSheet open={sheetOpen} onOpenChange={setSheetOpen} employee={editing} />
    </div>
  );
}

type FormState = {
  name: string;
  phone: string;
  document: string;
  role: string;
  daily_rate: string;
  transport_cost: string;
  meal_cost: string;
  notes: string;
  active: boolean;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  document: "",
  role: "",
  daily_rate: "0",
  transport_cost: "0",
  meal_cost: "0",
  notes: "",
  active: true,
};

function toForm(e: Employee | null): FormState {
  if (!e) return EMPTY;
  return {
    name: e.name,
    phone: e.phone ?? "",
    document: e.document ?? "",
    role: e.role ?? "",
    daily_rate: String(e.daily_rate ?? 0),
    transport_cost: String(e.transport_cost ?? 0),
    meal_cost: String(e.meal_cost ?? 0),
    notes: e.notes ?? "",
    active: e.active,
  };
}

function parseMoney(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function EmployeeSheet({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createEmployee);
  const updateFn = useServerFn(updateEmployee);
  const [form, setForm] = useState<FormState>(EMPTY);

  useMemo(() => {
    if (open) setForm(toForm(employee));
  }, [open, employee]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        document: form.document.trim(),
        role: form.role.trim(),
        daily_rate: parseMoney(form.daily_rate),
        transport_cost: parseMoney(form.transport_cost),
        meal_cost: parseMoney(form.meal_cost),
        notes: form.notes.trim(),
        active: form.active,
      };
      if (employee) {
        return updateFn({ data: { ...payload, id: employee.id } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(employee ? "Funcionário atualizado." : "Funcionário cadastrado.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const canSave = form.name.trim().length >= 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{employee ? "Editar funcionário" : "Novo funcionário"}</SheetTitle>
          <SheetDescription>
            Cadastre funcionários operacionais sem exigir e-mail ou login.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Nome do funcionário"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Função</Label>
              <Input
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="Ex.: Ajudante"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div>
            <Label>CPF / Documento</Label>
            <Input
              value={form.document}
              onChange={(e) => set("document", e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Diária (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.daily_rate}
                onChange={(e) => set("daily_rate", e.target.value)}
              />
            </div>
            <div>
              <Label>Transporte (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.transport_cost}
                onChange={(e) => set("transport_cost", e.target.value)}
              />
            </div>
            <div>
              <Label>Almoço (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.meal_cost}
                onChange={(e) => set("meal_cost", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas internas (opcional)"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Ativo</Label>
              <p className="text-xs text-muted-foreground">
                Funcionários inativos não aparecem no seletor padrão em novos vínculos.
              </p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSave || mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
