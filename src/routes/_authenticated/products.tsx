import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Eye,
  Trash2,
  Settings2,
  ImageIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wrench,
  ChevronDown,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import {
  listBrands,
  listCategories,
  listItems,
  softDeleteItem,
  type ItemType,
} from "@/lib/products.functions";
import { getMyContext } from "@/lib/account.functions";
import { TaxonomyDialog } from "@/components/products/TaxonomyDialog";
import { ItemFormSheet } from "@/components/products/ItemFormSheet";
import { ItemBadge } from "@/components/products/ItemBadge";
import { ProductImportDialog } from "@/components/products/ProductImportDialog";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Catálogo — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="products">
      <FeatureGate feature="products">
        <ItemsPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

type SortKey = "name" | "created_at" | "sale_price";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "PRODUCT" | "SERVICE";

function ItemsPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getMyContext);
  const listFn = useServerFn(listItems);
  const catFn = useServerFn(listCategories);
  const brandFn = useServerFn(listBrands);
  const deleteFn = useServerFn(softDeleteItem);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => ctxFn() });
  const companyId = (me as any)?.company?.id ?? null;

  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("_all");
  const [brandId, setBrandId] = useState<string>("_all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newType, setNewType] = useState<ItemType>("PRODUCT");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      item_type: typeFilter,
      category_id: categoryId !== "_all" ? categoryId : undefined,
      brand_id: brandId !== "_all" ? brandId : undefined,
      status,
      page,
      page_size: pageSize,
      sort,
      direction,
    }),
    [search, typeFilter, categoryId, brandId, status, page, sort, direction],
  );

  const { data, isFetching } = useQuery({
    queryKey: ["items", filters],
    queryFn: () => listFn({ data: filters }),
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => catFn() });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: () => brandFn() });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item removido.");
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openNew = (t: ItemType) => {
    setNewType(t);
    setEditingId(null);
    setFormOpen(true);
  };

  const handleSort = (k: SortKey) => {
    if (sort === k) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSort(k);
      setDirection("asc");
    }
    setPage(1);
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort !== k ? (
      <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />
    ) : direction === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );

  const visibleCategories = (categories as any[]).filter((c) => {
    if (typeFilter === "PRODUCT") return c.category_type === "PRODUCT" || c.category_type === "BOTH";
    if (typeFilter === "SERVICE") return c.category_type === "SERVICE" || c.category_type === "BOTH";
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Catálogo"
        description="Cadastro unificado de produtos e serviços oferecidos pela sua empresa."
        actions={
          <>
            <Button variant="outline" onClick={() => setTaxonomyOpen(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              Cadastros auxiliares
            </Button>
            <Can module="products" action="create">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" />
                Importar
              </Button>
            </Can>
            <Can module="products" action="create">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Novo item
                    <ChevronDown className="ml-1 h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openNew("PRODUCT")}>
                    <Package className="mr-2 h-4 w-4" /> Produto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openNew("SERVICE")}>
                    <Wrench className="mr-2 h-4 w-4" /> Serviço
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Can>
          </>
        }
      />

      {/* Type tabs */}
      <Tabs
        value={typeFilter}
        onValueChange={(v) => {
          setTypeFilter(v as TypeFilter);
          setCategoryId("_all");
          setPage(1);
        }}
        className="mb-3"
      >
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="PRODUCT">
            <Package className="mr-1.5 h-3.5 w-3.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="SERVICE">
            <Wrench className="mr-1.5 h-3.5 w-3.5" /> Serviços
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="card-elevated mb-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex flex-1 min-w-[220px] items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchDraft.trim());
              setPage(1);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                className="pl-8"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Buscar
            </Button>
          </form>

          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas categorias</SelectItem>
              {visibleCategories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={brandId}
            onValueChange={(v) => {
              setBrandId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas marcas</SelectItem>
              {(brands as any[]).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as any);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-14 px-3 py-2"></th>
                <th
                  className="cursor-pointer px-3 py-2 text-left hover:text-foreground"
                  onClick={() => handleSort("name")}
                >
                  Nome <SortIcon k="name" />
                </th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th
                  className="cursor-pointer px-3 py-2 text-right hover:text-foreground"
                  onClick={() => handleSort("sale_price")}
                >
                  Preço <SortIcon k="sale_price" />
                </th>
                <th className="px-3 py-2 text-center">Estoque</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {!data && isFetching && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-0">
                    <EmptyState
                      icon={<Package className="h-6 w-6" />}
                      title="Nenhum item encontrado"
                      description="Ajuste os filtros ou cadastre um novo produto ou serviço."
                    />
                  </td>
                </tr>
              )}
              {data?.items.map((p: any) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : p.item_type === "SERVICE" ? (
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    {p.sku && <div className="font-mono text-micro text-muted-foreground">SKU: {p.sku}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <ItemBadge type={p.item_type as ItemType} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.category?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {Number(p.sale_price).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    {p.controls_stock ? (
                      <Badge variant="secondary">Controlado</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={p.active ? "ACTIVE" : "INACTIVE"} label={p.active ? "Ativo" : "Inativo"} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      <Can module="products" action="view" fallback={null}>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Visualizar"
                          onClick={() => {
                            setEditingId(p.id);
                            setFormOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can module="products" action="edit">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          onClick={() => {
                            setEditingId(p.id);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can module="products" action="delete">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          title="Remover"
                          onClick={() => setDeletingId(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>
            {total} {total === 1 ? "item" : "itens"} · Página {page} de {totalPages}
          </div>
          <Pagination className="m-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <TaxonomyDialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen} />
      <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ItemFormSheet
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
        itemId={editingId}
        companyId={companyId}
        defaultType={newType}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              O item será desativado e arquivado. Ele não aparecerá mais nas listagens, mas seu histórico será
              preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && remove.mutate(deletingId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
