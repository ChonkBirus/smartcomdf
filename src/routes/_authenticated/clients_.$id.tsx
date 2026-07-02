import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Pencil, MessageCircle, Mail, MapPin, User as UserIcon,
  Building2, History, FileText, Phone,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute, Can } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CustomerFormSheet } from "@/components/customers/CustomerFormSheet";
import { CustomerHistorySheet } from "@/components/customers/CustomerHistorySheet";
import { CustomerFinancialSummary } from "@/components/finance/CustomerFinancialSummary";
import { CustomerCommercialHistory } from "@/components/crm/CustomerCommercialHistory";
import { getCustomer } from "@/lib/customers.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients_/$id")({
  head: () => ({ meta: [{ title: "Detalhes do Cliente — SecureERP" }] }),
  component: () => (
    <PermissionRoute module="clients">
      <FeatureGate feature="customers">
        <CustomerDetailsPage />
      </FeatureGate>
    </PermissionRoute>
  ),
});

function formatDoc(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

const ADDR_LABEL: Record<string, string> = {
  BILLING: "Cobrança", INSTALLATION: "Instalação", DELIVERY: "Entrega", OTHER: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  LEAD: "Lead", ACTIVE: "Ativo", INACTIVE: "Inativo", BLOCKED: "Bloqueado",
};

function CustomerDetailsPage() {
  const { id } = Route.useParams();
  const fetchOne = useServerFn(getCustomer);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: c, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchOne({ data: { id } }),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  if (!c) return <p className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</p>;

  const waNumber = c.whatsapp?.replace(/\D/g, "") || c.phone?.replace(/\D/g, "") || "";
  const displayName = c.trade_name || c.name;

  return (
    <div className="mx-auto max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
      </Button>

      <PageHeader
        title={displayName}
        description={c.customer_type === "COMPANY" ? "Pessoa Jurídica" : "Pessoa Física"}
        actions={
          <div className="flex flex-wrap gap-2">
            {waNumber && (
              <Button asChild variant="outline" size="sm">
                <a target="_blank" rel="noreferrer" href={`https://wa.me/55${waNumber}`}>
                  <MessageCircle className="mr-1 h-4 w-4" />WhatsApp
                </a>
              </Button>
            )}
            {c.email && (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${c.email}`}><Mail className="mr-1 h-4 w-4" />E-mail</a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="mr-1 h-4 w-4" />Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Módulo de orçamentos em breve.")}>
              <FileText className="mr-1 h-4 w-4" />Novo orçamento
            </Button>
            <Can module="clients" action="edit">
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-4 w-4" />Editar
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Main info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {c.customer_type === "COMPANY" ? <Building2 className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
              Dados principais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div><span className="text-muted-foreground">Nome:</span> {c.name}</div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <Badge variant="outline">{STATUS_LABEL[c.customer_status]}</Badge>
            </div>
            {c.customer_type === "COMPANY" && (
              <>
                <div><span className="text-muted-foreground">Razão social:</span> {c.corporate_name || "—"}</div>
                <div><span className="text-muted-foreground">Nome fantasia:</span> {c.trade_name || "—"}</div>
                <div><span className="text-muted-foreground">IE:</span> {c.state_registration || "—"}</div>
                <div><span className="text-muted-foreground">IM:</span> {c.municipal_registration || "—"}</div>
              </>
            )}
            <div>
              <span className="text-muted-foreground">{c.customer_type === "COMPANY" ? "CNPJ" : "CPF"}:</span>{" "}
              <span className="font-mono">{formatDoc(c.cpf_cnpj)}</span>
            </div>
            <div><span className="text-muted-foreground">Origem:</span> {c.customer_origin || "—"}</div>
            <div><span className="text-muted-foreground">E-mail:</span> {c.email || "—"}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {c.phone || "—"}</div>
            <div><span className="text-muted-foreground">WhatsApp:</span> {c.whatsapp || "—"}</div>
            <div>
              <span className="text-muted-foreground">Ativo:</span>{" "}
              <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Sim" : "Não"}</Badge>
            </div>
            {c.notes && (
              <div className="sm:col-span-2">
                <Separator className="my-2" />
                <p className="text-xs uppercase text-muted-foreground">Observações</p>
                <p className="whitespace-pre-wrap text-sm">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
          <CardContent>
            {c.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem tags.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <Badge key={t.id} variant="outline" style={{ borderColor: t.color, color: t.color }}>
                    {t.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Addresses */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />Endereços
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem endereços cadastrados.</p>
            ) : c.addresses.map((a) => (
              <div key={a.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{ADDR_LABEL[a.address_type]}</Badge>
                  {a.is_primary && <Badge>Principal</Badge>}
                </div>
                <p className="mt-2">
                  {[a.street, a.number].filter(Boolean).join(", ")}
                  {a.complement ? ` — ${a.complement}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {[a.district, a.city, a.state].filter(Boolean).join(" • ")} {a.zipcode ? ` — CEP ${a.zipcode}` : ""}
                </p>
                {a.reference && <p className="text-xs text-muted-foreground">Ref.: {a.reference}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />Contatos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contatos.</p>
            ) : c.contacts.map((ct) => (
              <div key={ct.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ct.name}</span>
                  {ct.is_primary && <Badge>Principal</Badge>}
                </div>
                {ct.role && <p className="text-xs text-muted-foreground">{ct.role}</p>}
                {ct.email && <p className="text-xs">{ct.email}</p>}
                {ct.phone && <p className="text-xs">{ct.phone}</p>}
                {ct.whatsapp && <p className="text-xs">WhatsApp: {ct.whatsapp}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <CustomerFinancialSummary customerId={c.id} />
      <CustomerCommercialHistory customerId={c.id} />

      <CustomerFormSheet open={editOpen} onOpenChange={setEditOpen} customerId={c.id} />
      <CustomerHistorySheet open={historyOpen} onOpenChange={setHistoryOpen}
        customerId={c.id} customerName={displayName} />
    </div>
  );
}
