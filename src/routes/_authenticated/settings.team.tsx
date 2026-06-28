import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listTeam, inviteMember, revokeInvitation, resendInvitation, updateMemberRole, removeMember,
} from "@/lib/team.functions";
import { appUrl } from "@/lib/app-url";
import { logAuthDev, maskEmail } from "@/lib/auth-dev-log";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamPage,
});

const ROLE_OPTIONS = [
  { value: "manager", label: "Gerente" },
  { value: "financial", label: "Financeiro" },
  { value: "commercial", label: "Comercial" },
  { value: "stock", label: "Estoquista" },
  { value: "technician", label: "Técnico" },
];

function TeamPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listTeam);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvitation);
  const resend = useServerFn(resendInvitation);
  const updateRole = useServerFn(updateMemberRole);
  const remove = useServerFn(removeMember);

  const { data } = useQuery({ queryKey: ["team"], queryFn: () => fetch() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("commercial");

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email, role: role as any } }),
    onSuccess: (inv: any) => {
      const link = appUrl(`/invite/${inv.token}`);
      if (import.meta.env.DEV) {
        console.info("[AUTH INVITE] email", inv.email);
        console.info("[AUTH INVITE] redirectUrl", link);
      }
      navigator.clipboard?.writeText(link).catch(() => {});
      toast.success("E-mail de convite enviado com sucesso.", { description: link });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: any) => {
      if (import.meta.env.DEV) console.warn("[AUTH INVITE] error", e?.message);
      toast.error(e?.message ?? "Falha ao convidar.");
    },
  });

  const resendMut = useMutation({
    mutationFn: (id: string) => resend({ data: { id } }),
    onSuccess: (inv: any) => {
      const link = appUrl(`/invite/${inv.token}`);
      navigator.clipboard?.writeText(link).catch(() => {});
      toast.success("Convite reenviado.", { description: link });
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reenviar convite."),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Convite revogado."); qc.invalidateQueries({ queryKey: ["team"] }); },
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: string }) => updateRole({ data: v as any }),
    onSuccess: () => { toast.success("Papel atualizado."); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const removeMut = useMutation({
    mutationFn: (user_id: string) => remove({ data: { user_id } }),
    onSuccess: () => { toast.success("Membro removido."); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  return (
    <div className="space-y-6">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" /> Convidar usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); inviteMut.mutate(); }}
            className="grid gap-3 md:grid-cols-[1fr_220px_auto]"
          >
            <div className="space-y-1">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="pessoa@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={inviteMut.isPending} className="w-full md:w-auto">
                Enviar convite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.members ?? []).map((m: any) => {
                const isOwner = m.roles.includes("owner");
                const primaryRole = m.roles.find((r: string) => r !== "owner") ?? m.roles[0];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {(m.full_name ?? m.email ?? "U").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.full_name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Badge className="bg-primary text-primary-foreground">Proprietário</Badge>
                      ) : (
                        <Select
                          value={primaryRole ?? "commercial"}
                          onValueChange={(v) => roleMut.mutate({ user_id: m.id, role: v })}
                        >
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Remover este membro da empresa?")) removeMut.mutate(m.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!data?.members?.length && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Nenhum membro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Convites pendentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.invitations ?? []).map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell><Badge variant="secondary">{inv.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "pending" ? "default" : "secondary"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {inv.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Copiar link"
                          onClick={() => {
                            const link = appUrl(`/invite/${inv.token}`);
                            navigator.clipboard?.writeText(link);
                            toast.success("Link copiado.");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Reenviar convite"
                          onClick={() => resendMut.mutate(inv.id)}
                          disabled={resendMut.isPending}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Revogar" onClick={() => revokeMut.mutate(inv.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!data?.invitations?.length && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhum convite.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
