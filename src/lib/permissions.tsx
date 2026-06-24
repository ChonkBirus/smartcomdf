import { createContext, useContext, useMemo, type ReactNode } from "react";

export type PermissionAction =
  | "view" | "create" | "edit" | "delete"
  | "approve" | "cancel" | "receive" | "manage" | "adjust" | "transfer"
  | "upload" | "process" | "confirm" | "disable" | "send_pix"
  | "convert_from_quote"
  | "import" | "import.confirm" | "import.view_history"
  | "plan" | "assign_responsible" | "manage_team" | "check_materials" | "mark_ready_for_os"
  | "assign_technician"
  | "view_assigned_only" | "execute" | "start" | "pause" | "finish_execution"
  | "manage_checklist" | "upload_photos" | "delete_photos"
  | "manage_material_usage" | "override_required_checklist"
  | "collect_signature" | "generate_final_report" | "send_final_report"
  | "download_final_report" | "deduct_stock" | "view_public_report_link";
export type ModuleSlug =
  | "dashboard"
  | "products"
  | "clients"
  | "stock"
  | "quotes"
  | "quote_payments"
  | "financial"
  | "crm"
  | "orders"
  | "reports"
  | "settings"
  | "suppliers"
  | "purchases"
  | "smart_receiving"
  | "projects"
  | "service_orders";

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
