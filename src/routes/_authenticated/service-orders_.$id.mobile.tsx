import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Briefcase, FileText, User, Users } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PermissionRoute } from "@/components/app/PermissionRoute";
import { FeatureGate } from "@/components/app/FeatureGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/lib/permissions";
import { getMobileServiceOrderDetails } from "@/lib/technician-service-orders.functions";
import {
  ServiceOrderStatusBadge,
  ServiceOrderPriorityBadge,
} from "@/components/service-orders/StatusBadges";
import { ServiceOrderQuickActions } from "@/components/service-orders/ServiceOrderQuickActions";
import { ExecutionActions } from "@/components/service-orders/ExecutionActions";
import { ExecutionTimeline } from "@/components/service-orders/ExecutionTimeline";
import { ServiceOrderChecklist } from "@/components/service-orders/ServiceOrderChecklist";
import { ServiceOrderPhotos } from "@/components/service-orders/ServiceOrderPhotos";
import { ServiceOrderMaterials } from "@/components/service-orders/ServiceOrderMaterials";
import { ServiceOrderSignature } from "@/components/service-orders/ServiceOrderSignature";
import { ServiceOrderStockDeduction } from "@/components/service-orders/ServiceOrderStockDeduction";
import { ServiceOrderFinalReport } from "@/components/service-orders/ServiceOrderFinalReport";

export const Route = createFileRoute("/_authenticated/service-orders_/$id/mobile")({
  head: () => ({ meta: [{ title: "OS — SecureERP" }] }),
  component: () => (
    <FeatureGate feature="service_orders">
      <PermissionRoute module="service_orders">
        <MobileSODetailPage />
      </PermissionRoute>
    </FeatureGate>
  ),
});

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function MobileSODetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchFn = useServerFn(getMobileServiceOrderDetails);
  const { can } = usePermissions();
  // Internal data (notas internas, origem projeto/orçamento) é restrito a gestores,
  // identificados pela permissão de atribuir técnico — técnicos não possuem.
  const canSeeInternal = can("service_orders", "assign_technician");
  const canManageChecklist = can("service_orders", "manage_checklist") || canSeeInternal;
  const canUploadPhotos = can("service_orders", "upload_photos") || canSeeInternal;
  const canDeletePhotos = can("service_orders", "delete_photos") || canSeeInternal;
  const canManageMaterials = can("service_orders", "manage_material_usage") || canSeeInternal;
  const canCollectSignature = can("service_orders", "collect_signature") || canSeeInternal;
  const canDeductStock = can("service_orders", "deduct_stock") || canSeeInternal;

  const { data, isLoading } = useQuery({
    queryKey: ["so-mobile", id],
    queryFn: () => fetchFn({ data: { id } }),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3 text-center">
        <p className="text-sm text-muted-foreground">Ordem de Serviço não encontrada ou sem acesso.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/service-orders/my" })}>Voltar</Button>
      </div>
    );
  }

  const { so, customer, address, contact, project, quote, company, items } = data;
  const phone = contact?.phone || customer?.phone;
  const whatsapp = contact?.whatsapp || customer?.whatsapp;
  const email = contact?.email || customer?.email;

  const date = so.scheduled_date
    ? new Date(so.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  const time = so.scheduled_start_time
    ? so.scheduled_start_time.slice(0, 5) +
      (so.scheduled_end_time ? ` — ${so.scheduled_end_time.slice(0, 5)}` : "")
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/service-orders/my" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>

      <PageHeader
        title={`OS #${so.service_order_number}`}
        description={so.title}
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ServiceOrderStatusBadge status={so.status} />
          <ServiceOrderPriorityBadge priority={so.priority} />
        </div>
        <div className="text-sm text-muted-foreground">
          {date ? <span className="font-medium text-foreground">{date}</span> : "Sem data agendada"}
          {time && <span> · {time}</span>}
        </div>
      </Card>

      <Section title="Execução">
        <ExecutionActions
          serviceOrderId={so.id}
          status={so.status as any}
          assignedTechnicianId={so.assigned_technician_id}
        />
        {so.status === "PAUSED" && so.pending_reason && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            Pausa: {so.pending_reason}
          </p>
        )}
      </Section>

      <Section title="Cliente">

        <div className="space-y-1">
          <div className="font-semibold">{so.customer_name}</div>
          {customer?.cpf_cnpj && (
            <div className="text-sm text-muted-foreground">{customer.cpf_cnpj}</div>
          )}
          {email && <div className="text-sm">{email}</div>}
          {(phone || whatsapp) && (
            <div className="text-sm text-muted-foreground">
              {phone && <>Tel: {phone}</>}
              {phone && whatsapp && <> · </>}
              {whatsapp && <>WA: {whatsapp}</>}
            </div>
          )}
        </div>
      </Section>

      <Section title="Endereço de instalação">
        {address ? (
          <div className="space-y-1 text-sm">
            <div>
              {[address.street, address.number].filter(Boolean).join(", ") || "—"}
              {address.complement ? ` — ${address.complement}` : ""}
            </div>
            <div className="text-muted-foreground">
              {[address.neighborhood, address.city && `${address.city}/${address.state ?? ""}`]
                .filter(Boolean).join(" · ")}
            </div>
            {address.zip_code && <div className="text-muted-foreground">CEP {address.zip_code}</div>}
            {address.reference && (
              <div className="text-muted-foreground italic">Ref.: {address.reference}</div>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300">Endereço não informado.</p>
        )}
      </Section>

      <Section title="Ações rápidas">
        <ServiceOrderQuickActions
          address={address}
          phone={phone}
          whatsapp={whatsapp}
          customerName={so.customer_name}
          serviceOrderNumber={so.service_order_number}
          companyName={company?.name ?? null}
        />
      </Section>

      {(so.customer_instructions || so.access_instructions || so.parking_instructions || so.technical_notes
        || (canSeeInternal && so.internal_notes)) && (
        <Section title="Instruções">
          <div className="space-y-3 text-sm">
            {so.customer_instructions && (
              <div>
                <div className="font-semibold">Cliente</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{so.customer_instructions}</p>
              </div>
            )}
            {so.access_instructions && (
              <div>
                <div className="font-semibold">Acesso</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{so.access_instructions}</p>
              </div>
            )}
            {so.parking_instructions && (
              <div>
                <div className="font-semibold">Estacionamento</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{so.parking_instructions}</p>
              </div>
            )}
            {so.technical_notes && (
              <div>
                <div className="font-semibold">Observações técnicas</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{so.technical_notes}</p>
              </div>
            )}
            {canSeeInternal && so.internal_notes && (
              <div>
                <div className="font-semibold">Internas</div>
                <p className="whitespace-pre-wrap text-muted-foreground">{so.internal_notes}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title={`Itens previstos (${items.length})`}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem itens previstos.</p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3 py-2">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name}
                    className="h-12 w-12 rounded object-cover bg-muted shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{it.name}</div>
                  {it.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{it.description}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {it.item_type === "SERVICE" ? "Serviço" : "Produto"} · {it.planned_quantity} {it.unit}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Checklist de Execução">
        <ServiceOrderChecklist
          serviceOrderId={so.id}
          status={so.status as any}
          canManage={canManageChecklist}
        />
      </Section>

      <Section title="Fotos da Execução">
        <ServiceOrderPhotos
          serviceOrderId={so.id}
          companyId={so.company_id}
          status={so.status as any}
          canUpload={canUploadPhotos}
          canDelete={canDeletePhotos}
        />
      </Section>

      <Section title="Materiais Utilizados">
        <ServiceOrderMaterials
          serviceOrderId={so.id}
          status={so.status as any}
          canManage={canManageMaterials}
        />
      </Section>

      <Section title="Assinatura do Cliente">
        <ServiceOrderSignature
          serviceOrderId={so.id}
          companyId={so.company_id}
          status={so.status as any}
          canCollect={canCollectSignature}
          defaultSignerName={so.customer_name}
        />
      </Section>

      <Section title="Baixa de Estoque">
        <ServiceOrderStockDeduction
          serviceOrderId={so.id}
          status={so.status}
          stockDeductionStatus={(so.stock_deduction_status as any) ?? "PENDING"}
          canDeduct={canDeductStock}
        />
      </Section>

      <Section title="Técnico responsável">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          {so.technician_name ?? <span className="text-amber-700 dark:text-amber-300">Técnico não definido</span>}
        </div>
      </Section>

      {canSeeInternal && (project || quote) && (
        <Section title="Origem">
          <div className="flex flex-wrap gap-2">
            {project && (
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/$id" params={{ id: project.id }}>
                  <Briefcase className="h-4 w-4 mr-1" /> Projeto {project.project_number ?? ""}
                </Link>
              </Button>
            )}
            {quote && (
              <Button asChild variant="outline" size="sm">
                <Link to="/quotes">
                  <FileText className="h-4 w-4 mr-1" /> Orçamento {quote.quote_number ?? ""}
                </Link>
              </Button>
            )}
          </div>
        </Section>
      )}

      <Section title="Histórico da Execução">
        <ExecutionTimeline serviceOrderId={so.id} />
      </Section>



      <Separator />
      <div className="flex justify-center">
        <Button asChild variant="ghost" size="sm">
          <Link to="/service-orders/$id" params={{ id: so.id }}>
            <Users className="h-4 w-4 mr-1" /> Ver versão completa
          </Link>
        </Button>
      </div>
    </div>
  );
}
