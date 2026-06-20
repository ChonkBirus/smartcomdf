import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getRoleMatrix, toggleRolePermission } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/settings/roles")({
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(getRoleMatrix);
  const toggle = useServerFn(toggleRolePermission);

  const { data } = useQuery({ queryKey: ["role-matrix"], queryFn: () => fetch() });

  const mut = useMutation({
    mutationFn: (v: { role_id: string; permission_id: string; enabled: boolean }) =>
      toggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-matrix"] }),
    onError: (e: any) => toast.error(e.message ?? "Erro."),
  });

  const isOn = (roleId: string, permId: string) =>
    !!data?.mapping.find((m: any) => m.role_id === roleId && m.permission_id === permId);

  const roles = (data?.roles ?? []).filter((r: any) => r.slug !== "super_admin");

  // Group permissions by module
  const grouped: Record<string, any[]> = {};
  (data?.permissions ?? []).forEach((p: any) => {
    grouped[p.module] = [...(grouped[p.module] ?? []), p];
  });

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-base">Matriz de permissões</CardTitle>
        <p className="text-xs text-muted-foreground">
          Marque para liberar uma permissão para o papel. O proprietário tem acesso total e não pode ser alterado.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left font-medium">Permissão</th>
              {roles.map((r: any) => (
                <th key={r.id} className="px-3 py-2 text-center font-medium capitalize">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([mod, perms]) => (
              <>
                <tr key={`m-${mod}`} className="bg-muted/20">
                  <td colSpan={roles.length + 1} className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    {mod}
                  </td>
                </tr>
                {perms.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="sticky left-0 z-10 bg-background px-4 py-2">
                      <div className="font-medium">{p.description ?? p.slug}</div>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>
                    </td>
                    {roles.map((r: any) => {
                      const locked = r.slug === "owner";
                      const checked = locked || isOn(r.id, p.id);
                      return (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <Checkbox
                            checked={checked}
                            disabled={locked || mut.isPending}
                            onCheckedChange={(v) =>
                              mut.mutate({ role_id: r.id, permission_id: p.id, enabled: !!v })
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
