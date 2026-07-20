import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Users, Boxes, FileText,
  HeartHandshake, Wrench, BarChart3, Settings, Shield, Lock,
  Building2, ShoppingCart, Sparkles, Briefcase, Bot, LifeBuoy, Wallet,
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Calculator, Percent,
  GitCompare, Target, Rocket, Settings2,
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { usePermissions, type ModuleSlug } from "@/lib/permissions";
import { useFeatures, type FeatureCode } from "@/lib/features";


type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; module: ModuleSlug; feature?: FeatureCode };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Geral",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard", feature: "dashboard" }],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Produtos", url: "/products", icon: Package, module: "products", feature: "products" },
      { title: "Clientes", url: "/clients", icon: Users, module: "clients", feature: "customers" },
      { title: "Funcionários", url: "/employees", icon: Users, module: "settings" },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Fornecedores", url: "/suppliers", icon: Building2, module: "suppliers", feature: "suppliers" },
      { title: "Pedidos de Compra", url: "/purchases", icon: ShoppingCart, module: "purchases", feature: "purchases" },
      { title: "Dashboard de Compras", url: "/purchases-analytics", icon: BarChart3, module: "purchases", feature: "purchases" },
      { title: "Recebimento IA", url: "/smart-receiving", icon: Sparkles, module: "smart_receiving", feature: "smart_receiving" },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Estoque", url: "/stock", icon: Boxes, module: "stock", feature: "inventory" },
      { title: "Orçamentos", url: "/quotes", icon: FileText, module: "quotes", feature: "quotes" },
      { title: "Projetos", url: "/projects", icon: Briefcase, module: "projects" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Painel financeiro", url: "/finance/dashboard", icon: Wallet, module: "finance" },
      { title: "Movimentações", url: "/finance/transactions", icon: ArrowLeftRight, module: "finance" },
      { title: "Contas a receber", url: "/finance/receivables", icon: ArrowDownCircle, module: "finance" },
      { title: "Contas a pagar", url: "/finance/payables", icon: ArrowUpCircle, module: "finance" },
      { title: "Custos da empresa", url: "/finance/costs", icon: Calculator, module: "finance" },
      { title: "Precificação", url: "/finance/pricing", icon: Percent, module: "finance" },
      { title: "Comparativo", url: "/finance/comparison", icon: GitCompare, module: "finance" },
      { title: "Planejamento", url: "/finance/planning", icon: Target, module: "finance" },
      { title: "Turbinador de lucros", url: "/finance/profit-booster", icon: Rocket, module: "finance" },
      { title: "Relatórios financeiros", url: "/finance/reports", icon: BarChart3, module: "finance" },
      { title: "Configurações", url: "/finance/settings", icon: Settings2, module: "finance" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "CRM", url: "/crm", icon: HeartHandshake, module: "crm", feature: "crm" },
      { title: "Ordens de Serviço", url: "/service-orders", icon: Wrench, module: "service_orders", feature: "service_orders" },
      { title: "Minhas OS", url: "/service-orders/my", icon: Wrench, module: "service_orders", feature: "service_orders" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Relatórios", url: "/reports", icon: BarChart3, module: "reports", feature: "reports" },
      { title: "Configurações", url: "/settings", icon: Settings, module: "settings", feature: "settings" },
    ],
  },
];

export function AppSidebar({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { canView } = usePermissions();
  const { hasFeature } = useFeatures();

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => canView(it.module)) }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <img src={collapsed ? "/brand/smart-pro-logo-icon.png" : "/brand/smart-pro-logo-horizontal.png"} alt="Logo SmartPro" className={collapsed ? "h-8 w-8 rounded-md object-contain" : "h-9 w-auto object-contain"} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = pathname === it.url || pathname.startsWith(it.url + "/");
                  const locked = it.feature ? !hasFeature(it.feature) : false;
                  if (locked) {
                    return (
                      <SidebarMenuItem key={it.url}>
                        <SidebarMenuButton asChild isActive={active} tooltip={`${it.title} — Plano Superior`}>
                          <Link to={it.url} className={cn("flex items-center gap-2 opacity-70")}>
                            <it.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 truncate">{it.title}</span>
                                <span className="flex items-center gap-1 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                  <Lock className="h-2.5 w-2.5" />
                                  Premium
                                </span>
                              </>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.title}>
                        <Link to={it.url} className={cn("flex items-center gap-2")}>
                          <it.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{it.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Inteligência</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {(() => {
                const active = pathname === "/assistant" || pathname.startsWith("/assistant/");
                const locked = !hasFeature("ai_assistant");
                return (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={active} tooltip={locked ? "SmartCom IA — Plano Superior" : "SmartCom IA"}>
                      <Link to="/assistant" className={cn("flex items-center gap-2", locked && "opacity-70")}>
                        <Bot className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">SmartCom IA</span>
                            {locked && (
                              <span className="flex items-center gap-1 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                                <Lock className="h-2.5 w-2.5" />
                                Premium
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Ajuda</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/help")} tooltip="Central de Ajuda">
                  <Link to="/help" className="flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Central de Ajuda</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isSuperAdmin && (

          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Plataforma</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")} tooltip="Super Admin">
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Super Admin</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
