import { createContext, useContext, useMemo, type ReactNode } from "react";

export type PermissionAction = "view" | "create" | "edit" | "delete";
export type ModuleSlug =
  | "dashboard"
  | "products"
  | "clients"
  | "stock"
  | "quotes"
  | "financial"
  | "crm"
  | "orders"
  | "reports"
  | "settings";

type Ctx = {
  permissions: Set<string>;
  isSuperAdmin: boolean;
  isOwner: boolean;
};

const PermissionsContext = createContext<Ctx>({
  permissions: new Set(),
  isSuperAdmin: false,
  isOwner: false,
});

export function PermissionsProvider({
  children,
  permissions,
  isSuperAdmin,
  isOwner,
}: {
  children: ReactNode;
  permissions: string[];
  isSuperAdmin: boolean;
  isOwner: boolean;
}) {
  const value = useMemo<Ctx>(
    () => ({ permissions: new Set(permissions), isSuperAdmin, isOwner }),
    [permissions, isSuperAdmin, isOwner],
  );
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const { permissions, isSuperAdmin, isOwner } = useContext(PermissionsContext);
  const allAccess = isSuperAdmin || isOwner;

  const has = (slug: string) => allAccess || permissions.has(slug);
  const can = (module: ModuleSlug, action: PermissionAction) => has(`${module}.${action}`);

  return {
    permissions,
    isSuperAdmin,
    isOwner,
    has,
    can,
    canView: (m: ModuleSlug) => can(m, "view"),
    canCreate: (m: ModuleSlug) => can(m, "create"),
    canEdit: (m: ModuleSlug) => can(m, "edit"),
    canDelete: (m: ModuleSlug) => can(m, "delete"),
  };
}

export function useRole() {
  const { isSuperAdmin, isOwner } = useContext(PermissionsContext);
  return { isSuperAdmin, isOwner };
}
