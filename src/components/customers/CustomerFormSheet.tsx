import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Star } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelWithHelp } from "@/components/ui/FieldHelp";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getCustomer, saveCustomer, listCustomerTags, createCustomerTag,
  type CustomerAddress, type CustomerContact, type CustomerType, type CustomerStatus, type CustomerAddressType,
} from "@/lib/customers.functions";
import { COUNTRIES, statesFor, isValidEmail } from "@/lib/locations";
import { CustomerCnpjLookupButton } from "@/components/customers/CustomerCnpjLookupDialog";
import type { CnpjLookupResultDTO } from "@/lib/cnpj-lookup.functions";
import { useCompanyId } from "@/hooks/use-company-id";
import { CepInput } from "@/components/shared/CepInput";
import type { CepResult } from "@/lib/address-lookup";

type AddrRow = Omit<CustomerAddress, "id" | "company_id" | "customer_id" | "created_at" | "updated_at"> & { id?: string };
type ContactRow = Omit<CustomerContact, "id" | "company_id" | "customer_id" | "created_at" | "updated_at"> & { id?: string };

type FormState = {
  id?: string;
  customer_type: CustomerType;
  name: string;
  corporate_name: string;
  trade_name: string;
  cpf_cnpj: string;
  state_registration: string;
  municipal_registration: string;
  email: string;
  phone: string;
  whatsapp: string;
  customer_status: CustomerStatus;
  customer_origin: string;
  notes: string;
  active: boolean;
  addresses: AddrRow[];
  contacts: ContactRow[];
  tag_ids: string[];
};

const EMPTY: FormState = {
  customer_type: "INDIVIDUAL",
  name: "", corporate_name: "", trade_name: "", cpf_cnpj: "",
  state_registration: "", municipal_registration: "",
  email: "", phone: "", whatsapp: "",
  customer_status: "ACTIVE", customer_origin: "",
  notes: "", active: true,
  addresses: [],
  contacts: [],
  tag_ids: [],
};

const EMPTY_ADDR: AddrRow = {
  address_type: "BILLING", country: "BR", zipcode: null, street: null, number: null,
  complement: null, district: null, city: null, state: null, reference: null,
  is_primary: false,
};
const EMPTY_CONTACT: ContactRow = {
  name: "", role: null, email: null, phone: null, whatsapp: null,
  is_primary: false, active: true,
};

function maskCpfCnpj(v: string, type: CustomerType) {
  const d = v.replace(/\D/g, "").slice(0, type === "INDIVIDUAL" ? 11 : 14);
  if (type === "INDIVIDUAL") return d.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, d2) => [a, b, c].filter(Boolean).join(".") + (d2 ? "-" + d2 : ""));
  return d.replace(/(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/, (_, a, b, c, d2, e) => {
    let s = a;
    if (b) s += "." + b;
    if (c) s += "." + c;
    if (d2) s += "/" + d2;
    if (e) s += "-" + e;
    return s;
  });
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a && `(${a})`, b, c && `-${c}`].filter(Boolean).join(" ").trim());
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

function maskZip(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));
}

function isValidCPF(v: string) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = 11 - (s % 11); if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = 11 - (s % 11); if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

function isValidCNPJ(v: string) {
  const c = v.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(c[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

export function CustomerFormSheet({
  open, onOpenChange, customerId, onCreated,
}: { open: boolean; onOpenChange: (o: boolean) => void; customerId: string | null; onCreated?: (id: string) => void }) {

  const qc = useQueryClient();
  const fetchOne = useServerFn(getCustomer);
  const save = useServerFn(saveCustomer);
  const fetchTags = useServerFn(listCustomerTags);
  const newTag = useServerFn(createCustomerTag);
  const companyId = useCompanyId();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [newTagName, setNewTagName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ["customer", companyId, customerId],
    queryFn: () => fetchOne({ data: { id: customerId! } }),
    enabled: !!customerId && open && !!companyId,
  });

  const { data: tags } = useQuery({
    queryKey: ["customer-tags", companyId],
    queryFn: () => fetchTags(),
    enabled: open && !!companyId,
  });

  useEffect(() => {
    if (!open) return;
    if (customerId && existing) {
      setForm({
        id: existing.id,
        customer_type: existing.customer_type,
        name: existing.name,
        corporate_name: existing.corporate_name ?? "",
        trade_name: existing.trade_name ?? "",
        cpf_cnpj: existing.cpf_cnpj,
        state_registration: existing.state_registration ?? "",
        municipal_registration: existing.municipal_registration ?? "",
        email: existing.email ?? "",
        phone: existing.phone ?? "",
        whatsapp: existing.whatsapp ?? "",
        customer_status: existing.customer_status,
        customer_origin: existing.customer_origin ?? "",
        notes: existing.notes ?? "",
        active: existing.active,
        addresses: existing.addresses.map((a) => ({ ...a })),
        contacts: existing.contacts.map((c) => ({ ...c })),
        tag_ids: existing.tags.map((t) => t.id),
      });
    } else if (!customerId) {
      setForm(EMPTY);
    }
  }, [open, customerId, existing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const mutation = useMutation({
    mutationFn: (payload: FormState) => save({ data: payload as any }),
    onSuccess: (result: any) => {
      toast.success(form.id ? "Cliente atualizado." : "Cliente cadastrado.");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-metrics"] });
      const newId = result?.id ?? form.id;
      if (!form.id && newId && onCreated) onCreated(newId);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });


  const tagMut = useMutation({
    mutationFn: (name: string) => newTag({ data: { name, color: "#3B82F6" } }),
    onSuccess: (t) => {
      toast.success("Tag criada.");
      qc.invalidateQueries({ queryKey: ["customer-tags"] });
      set("tag_ids", [...form.tag_ids, t.id]);
      setNewTagName("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha."),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Nome é obrigatório.";
    if (form.cpf_cnpj.trim() && !docValid) {
      errs.cpf_cnpj = isCompany ? "CNPJ inválido." : "CPF inválido.";
    }
    if (!form.email.trim()) errs.email = "E-mail é obrigatório.";
    else if (!isValidEmail(form.email)) errs.email = "Informe um e-mail válido.";
    if (!form.phone.trim() && !form.whatsapp.trim()) errs.whatsapp = "Informe WhatsApp ou Telefone.";
    // Filter out fully empty contacts before validating/sending.
    const cleanedContacts = form.contacts
      .map((c) => ({
        ...c,
        name: (c.name ?? "").trim(),
        role: (c.role ?? "").trim() || null,
        email: (c.email ?? "").trim() || null,
        phone: (c.phone ?? "").trim() || null,
        whatsapp: (c.whatsapp ?? "").trim() || null,
      }))
      .filter((c) => c.name || c.role || c.email || c.phone || c.whatsapp);
    cleanedContacts.forEach((c, i) => {
      if (!c.name) errs[`contact_${i}_name`] = "Nome é obrigatório.";
      if (c.email && !isValidEmail(c.email)) errs[`contact_${i}_email`] = "Informe um e-mail válido.";
    });
    form.addresses.forEach((a, i) => {
      if (!a.country) errs[`addr_${i}_country`] = "País é obrigatório.";
      if (!a.zipcode?.trim()) errs[`addr_${i}_zipcode`] = "CEP é obrigatório.";
      if (!a.street?.trim()) errs[`addr_${i}_street`] = "Rua é obrigatória.";
      if (!a.number?.trim()) errs[`addr_${i}_number`] = "Número é obrigatório.";
      if (!a.district?.trim()) errs[`addr_${i}_district`] = "Bairro é obrigatório.";
      if (!a.city?.trim()) errs[`addr_${i}_city`] = "Cidade é obrigatória.";
      if (!a.state?.trim()) errs[`addr_${i}_state`] = "UF é obrigatório.";
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    mutation.mutate({ ...form, contacts: cleanedContacts as any });
  }


  const isCompany = form.customer_type === "COMPANY";
  const docDigits = form.cpf_cnpj.replace(/\D/g, "");
  const docExpectedLen = isCompany ? 14 : 11;
  const docValid = isCompany ? isValidCNPJ(form.cpf_cnpj) : isValidCPF(form.cpf_cnpj);
  const docTouched = docDigits.length > 0;
  const docComplete = docDigits.length === docExpectedLen;

  function applyCnpjData(d: CnpjLookupResultDTO, replace: boolean) {
    setForm((s) => {
      const take = (cur: string, next: string | null | undefined) =>
        next ? (replace || !cur?.trim() ? next : cur) : cur;
      const nextAddrs = [...s.addresses];
      const hasAddr = nextAddrs.length > 0;
      const addrPatch = {
        address_type: "INSTALLATION" as CustomerAddressType,
        country: "BR",
        zipcode: d.zipcode ?? null,
        street: d.address ?? null,
        number: d.number ?? null,
        complement: d.complement ?? null,
        district: d.district ?? null,
        city: d.city ?? null,
        state: d.state ?? null,
        reference: null,
        is_primary: true,
      };
      if (!hasAddr) {
        nextAddrs.push(addrPatch as AddrRow);
      } else if (replace) {
        nextAddrs[0] = { ...nextAddrs[0], ...addrPatch };
      }
      return {
        ...s,
        corporate_name: take(s.corporate_name, d.corporate_name),
        trade_name: take(s.trade_name, d.trade_name),
        name: take(s.name, d.trade_name || d.corporate_name),
        email: take(s.email, d.email),
        phone: take(s.phone, d.phone),
        whatsapp: take(s.whatsapp, d.phone),
        state_registration: take(s.state_registration, d.state_registration),
        municipal_registration: take(s.municipal_registration, d.municipal_registration),
        notes: d.main_activity && !s.notes ? `CNAE: ${d.main_cnae ?? ""} - ${d.main_activity}` : s.notes,
        addresses: nextAddrs,
      };
    });
  }

  const hasExistingPjData = !!(form.corporate_name || form.trade_name || form.email || form.addresses.length > 0);


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{form.id ? "Editar cliente" : "Novo cliente"}</SheetTitle>
          <SheetDescription>Cadastro completo: dados, endereços, contatos e tags.</SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Tabs defaultValue="main">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="main">Dados</TabsTrigger>
              <TabsTrigger value="addresses">Endereços</TabsTrigger>
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="extra">Tags/Notas</TabsTrigger>
            </TabsList>

            {/* MAIN */}
            <TabsContent value="main" className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <LabelWithHelp
                    label="Tipo *"
                    help="Pessoa Física (CPF, uma pessoa) ou Pessoa Jurídica (CNPJ, empresa)."
                  />
                  <Select
                    value={form.customer_type}
                    onValueChange={(v) => set("customer_type", v as CustomerType)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
                      <SelectItem value="COMPANY">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelWithHelp
                    label="Status"
                    help="Situação do cliente: Lead (ainda não comprou), Ativo, Inativo ou Bloqueado (não vender)."
                  />
                  <Select
                    value={form.customer_status}
                    onValueChange={(v) => set("customer_status", v as CustomerStatus)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="INACTIVE">Inativo</SelectItem>
                      <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <LabelWithHelp
                    label={isCompany ? "Nome (referência) *" : "Nome completo *"}
                    help={isCompany
                      ? "Como esta empresa vai aparecer nas listas. Pode ser o nome fantasia ou um apelido."
                      : "Nome completo do cliente, como consta no documento."}
                  />
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name}
                    className={errors.name ? "border-destructive" : ""} />
                  {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                </div>
                {isCompany && (
                  <>
                    <div>
                      <LabelWithHelp label="Razão social" help="Nome oficial registrado da empresa (aparece na nota fiscal)." />
                      <Input value={form.corporate_name} onChange={(e) => set("corporate_name", e.target.value)} />
                    </div>
                    <div>
                      <LabelWithHelp label="Nome fantasia" help="Nome comercial pelo qual a empresa é conhecida no mercado." />
                      <Input value={form.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <LabelWithHelp
                    label={isCompany ? "CNPJ" : "CPF"}
                    help={isCompany
                      ? "Documento da empresa (14 dígitos). Digite e clique em buscar para preencher automaticamente."
                      : "Documento do cliente (11 dígitos). Usado em orçamentos e notas."}
                  />
                  <Input
                    value={maskCpfCnpj(form.cpf_cnpj, form.customer_type)}
                    onChange={(e) => set("cpf_cnpj", e.target.value)}
                    aria-invalid={!!errors.cpf_cnpj || (docTouched && docComplete && !docValid)}
                    className={(errors.cpf_cnpj || (docTouched && docComplete && !docValid)) ? "border-destructive focus-visible:ring-destructive" : docTouched && docValid ? "border-emerald-500" : ""}
                  />
                  {errors.cpf_cnpj ? (
                    <p className="mt-1 text-xs text-destructive">{errors.cpf_cnpj}</p>
                  ) : docTouched && (
                    docValid ? (
                      <p className="mt-1 text-xs text-emerald-600">{isCompany ? "CNPJ válido" : "CPF válido"}</p>
                    ) : docComplete ? (
                      <p className="mt-1 text-xs text-destructive">{isCompany ? "CNPJ inválido" : "CPF inválido"}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">{docDigits.length}/{docExpectedLen} dígitos</p>
                    )
                  )}
                  {isCompany && (
                    <div className="mt-2">
                      <CustomerCnpjLookupButton
                        cnpj={form.cpf_cnpj}
                        disabled={!docComplete || !docValid}
                        hasExistingData={hasExistingPjData}
                        onApply={applyCnpjData}
                      />
                    </div>
                  )}
                </div>

                {isCompany && (
                  <>
                    <div>
                      <LabelWithHelp label="Inscrição estadual" help="Registro da empresa na receita estadual. Deixe vazio se isento." />
                      <Input value={form.state_registration} onChange={(e) => set("state_registration", e.target.value)} />
                    </div>
                    <div>
                      <LabelWithHelp label="Inscrição municipal" help="Registro da empresa na prefeitura, usado para nota de serviço." />
                      <Input value={form.municipal_registration} onChange={(e) => set("municipal_registration", e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <LabelWithHelp label="E-mail *" help="Usado para enviar orçamentos, cobranças e comunicados." />
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                    aria-invalid={!!errors.email}
                    className={errors.email ? "border-destructive" : ""} />
                  {errors.email
                    ? <p className="mt-1 text-xs text-destructive">{errors.email}</p>
                    : <p className="mt-1 text-xs text-muted-foreground">Este campo é obrigatório.</p>}
                </div>
                <div>
                  <LabelWithHelp label="Telefone" help="Telefone fixo ou celular para ligações." />
                  <Input value={maskPhone(form.phone)} onChange={(e) => set("phone", e.target.value)}
                    aria-invalid={!!errors.whatsapp}
                    className={errors.whatsapp ? "border-destructive" : ""} />
                </div>
                <div>
                  <LabelWithHelp label="WhatsApp *" help="Número usado para enviar orçamentos e mensagens pelo WhatsApp. Informe WhatsApp ou telefone." />
                  <Input value={maskPhone(form.whatsapp)} onChange={(e) => set("whatsapp", e.target.value)}
                    aria-invalid={!!errors.whatsapp}
                    className={errors.whatsapp ? "border-destructive" : ""} />
                  {errors.whatsapp && <p className="mt-1 text-xs text-destructive">{errors.whatsapp}</p>}
                </div>
                <div>
                  <LabelWithHelp label="Origem" help="Como este cliente chegou até você. Ajuda a saber quais canais funcionam." />
                  <Input value={form.customer_origin} onChange={(e) => set("customer_origin", e.target.value)} placeholder="Indicação, site, Instagram..." />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="font-medium">Ativo</Label>
                  <p className="text-xs text-muted-foreground">Clientes inativos não aparecem em novos orçamentos.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              </div>
            </TabsContent>

            {/* ADDRESSES */}
            <TabsContent value="addresses" className="space-y-3 pt-4">
              {form.addresses.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
              )}
              {form.addresses.map((a, i) => (
                <div key={i} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Select
                      value={a.address_type}
                      onValueChange={(v) => {
                        const next = [...form.addresses];
                        next[i] = { ...a, address_type: v as CustomerAddressType };
                        set("addresses", next);
                      }}
                    >
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BILLING">Cobrança</SelectItem>
                        <SelectItem value="INSTALLATION">Instalação</SelectItem>
                        <SelectItem value="DELIVERY">Entrega</SelectItem>
                        <SelectItem value="OTHER">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button" size="sm" variant={a.is_primary ? "default" : "outline"}
                        onClick={() => {
                          const next = form.addresses.map((x, idx) => ({ ...x, is_primary: idx === i }));
                          set("addresses", next);
                        }}
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />Principal
                      </Button>
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => set("addresses", form.addresses.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <LabelWithHelp label="País *" help="País do endereço. Muda a lista de estados/UF disponível." />
                      <Select
                        value={a.country || "BR"}
                        onValueChange={(v) => {
                          const next = [...form.addresses];
                          next[i] = { ...a, country: v, state: null };
                          set("addresses", next);
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <LabelWithHelp label="CEP *" help="Digite o CEP para preencher rua, bairro, cidade e UF automaticamente." />
                      {a.country === "BR" ? (
                        <CepInput
                          value={a.zipcode ?? ""}
                          aria-invalid={!!errors[`addr_${i}_zipcode`]}
                          className={errors[`addr_${i}_zipcode`] ? "border-destructive" : ""}
                          onChange={(v: string) => {
                            const next = [...form.addresses]; next[i] = { ...a, zipcode: v }; set("addresses", next);
                          }}
                          onResolve={(r: CepResult) => {
                            const next = [...form.addresses];
                            next[i] = {
                              ...a,
                              zipcode: r.cep,
                              street: a.street?.trim() ? a.street : r.street,
                              district: a.district?.trim() ? a.district : r.district,
                              city: a.city?.trim() ? a.city : r.city,
                              state: a.state?.trim() ? a.state : r.state,
                              complement: a.complement?.trim() ? a.complement : (r.complement ?? a.complement ?? null),
                            };
                            set("addresses", next);
                          }}
                        />
                      ) : (
                        <Input value={a.zipcode ?? ""}
                          aria-invalid={!!errors[`addr_${i}_zipcode`]}
                          className={errors[`addr_${i}_zipcode`] ? "border-destructive" : ""}
                          onChange={(e) => {
                            const next = [...form.addresses]; next[i] = { ...a, zipcode: e.target.value }; set("addresses", next);
                          }} />
                      )}
                      {errors[`addr_${i}_zipcode`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_zipcode`]}</p>}
                    </div>

                    <div>
                      <LabelWithHelp label="UF *" help="Estado do endereço." />
                      <Select
                        value={a.state ?? ""}
                        onValueChange={(v) => {
                          const next = [...form.addresses]; next[i] = { ...a, state: v }; set("addresses", next);
                        }}
                      >
                        <SelectTrigger aria-invalid={!!errors[`addr_${i}_state`]}
                          className={errors[`addr_${i}_state`] ? "border-destructive" : ""}>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {statesFor(a.country || "BR").map((s) => (
                            <SelectItem key={s.code} value={s.code}>{s.code} — {s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`addr_${i}_state`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_state`]}</p>}
                    </div>
                    <div className="sm:col-span-2">
                      <LabelWithHelp label="Rua *" help="Nome da rua, avenida ou logradouro." />
                      <Input value={a.street ?? ""}
                        aria-invalid={!!errors[`addr_${i}_street`]}
                        className={errors[`addr_${i}_street`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.addresses]; next[i] = { ...a, street: e.target.value }; set("addresses", next);
                        }} />
                      {errors[`addr_${i}_street`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_street`]}</p>}
                    </div>
                    <div>
                      <LabelWithHelp label="Número *" help="Número do imóvel. Use S/N se não houver." />
                      <Input value={a.number ?? ""}
                        aria-invalid={!!errors[`addr_${i}_number`]}
                        className={errors[`addr_${i}_number`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.addresses]; next[i] = { ...a, number: e.target.value }; set("addresses", next);
                        }} />
                      {errors[`addr_${i}_number`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_number`]}</p>}
                    </div>
                    <div>
                      <LabelWithHelp label="Complemento" help="Apto, sala, bloco, andar. Opcional." />
                      <Input value={a.complement ?? ""} onChange={(e) => {
                        const next = [...form.addresses]; next[i] = { ...a, complement: e.target.value }; set("addresses", next);
                      }} />
                    </div>
                    <div>
                      <LabelWithHelp label="Bairro *" help="Bairro do endereço." />
                      <Input value={a.district ?? ""}
                        aria-invalid={!!errors[`addr_${i}_district`]}
                        className={errors[`addr_${i}_district`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.addresses]; next[i] = { ...a, district: e.target.value }; set("addresses", next);
                        }} />
                      {errors[`addr_${i}_district`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_district`]}</p>}
                    </div>
                    <div>
                      <LabelWithHelp label="Cidade *" help="Cidade do endereço." />
                      <Input value={a.city ?? ""}
                        aria-invalid={!!errors[`addr_${i}_city`]}
                        className={errors[`addr_${i}_city`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.addresses]; next[i] = { ...a, city: e.target.value }; set("addresses", next);
                        }} />
                      {errors[`addr_${i}_city`] && <p className="mt-1 text-xs text-destructive">{errors[`addr_${i}_city`]}</p>}
                    </div>
                    <div className="sm:col-span-3">
                      <LabelWithHelp label="Referência" help="Ponto de referência para o técnico chegar mais fácil. Ex.: em frente à padaria." />
                      <Input value={a.reference ?? ""} onChange={(e) => {
                        const next = [...form.addresses]; next[i] = { ...a, reference: e.target.value }; set("addresses", next);
                      }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => set("addresses", [...form.addresses, { ...EMPTY_ADDR, is_primary: form.addresses.length === 0 }])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar endereço
              </Button>
            </TabsContent>

            {/* CONTACTS */}
            <TabsContent value="contacts" className="space-y-3 pt-4">
              {form.contacts.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum contato adicional.</p>
              )}
              {form.contacts.map((c, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <LabelWithHelp label="Nome *" help="Nome da pessoa de contato desta empresa/cliente." />
                      <Input value={c.name}
                        aria-invalid={!!errors[`contact_${i}_name`]}
                        className={errors[`contact_${i}_name`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.contacts]; next[i] = { ...c, name: e.target.value }; set("contacts", next);
                        }} />
                      {errors[`contact_${i}_name`] && <p className="mt-1 text-xs text-destructive">{errors[`contact_${i}_name`]}</p>}
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      <Button
                        type="button" size="sm" variant={c.is_primary ? "default" : "outline"}
                        onClick={() => {
                          const next = form.contacts.map((x, idx) => ({ ...x, is_primary: idx === i }));
                          set("contacts", next);
                        }}
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />Principal
                      </Button>
                      <Button type="button" size="icon" variant="ghost"
                        onClick={() => set("contacts", form.contacts.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <LabelWithHelp label="Cargo/Função" help="Cargo do contato. Ex.: síndico, gerente, comprador." />
                      <Input value={c.role ?? ""} onChange={(e) => {
                        const next = [...form.contacts]; next[i] = { ...c, role: e.target.value }; set("contacts", next);
                      }} />
                    </div>
                    <div>
                      <LabelWithHelp label="E-mail" help="E-mail deste contato específico." />
                      <Input value={c.email ?? ""}
                        aria-invalid={!!errors[`contact_${i}_email`]}
                        className={errors[`contact_${i}_email`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.contacts]; next[i] = { ...c, email: e.target.value }; set("contacts", next);
                        }} />
                      {errors[`contact_${i}_email`] && <p className="mt-1 text-xs text-destructive">{errors[`contact_${i}_email`]}</p>}
                    </div>
                    <div>
                      <LabelWithHelp label="Telefone *" help="Telefone deste contato para ligações." />
                      <Input value={maskPhone(c.phone ?? "")}
                        aria-invalid={!!errors[`contact_${i}_phone`]}
                        className={errors[`contact_${i}_phone`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.contacts]; next[i] = { ...c, phone: e.target.value }; set("contacts", next);
                        }} />
                      {errors[`contact_${i}_phone`] && <p className="mt-1 text-xs text-destructive">{errors[`contact_${i}_phone`]}</p>}
                    </div>
                    <div>
                      <LabelWithHelp label="WhatsApp *" help="WhatsApp deste contato para envio de orçamentos e mensagens." />
                      <Input value={maskPhone(c.whatsapp ?? "")}
                        aria-invalid={!!errors[`contact_${i}_phone`]}
                        className={errors[`contact_${i}_phone`] ? "border-destructive" : ""}
                        onChange={(e) => {
                          const next = [...form.contacts]; next[i] = { ...c, whatsapp: e.target.value }; set("contacts", next);
                        }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => set("contacts", [...form.contacts, { ...EMPTY_CONTACT, is_primary: form.contacts.length === 0 }])}>
                <Plus className="mr-1 h-4 w-4" />Adicionar contato
              </Button>
            </TabsContent>

            {/* TAGS */}
            <TabsContent value="extra" className="space-y-4 pt-4">
              <div>
                <LabelWithHelp label="Tags" help="Etiquetas para agrupar clientes (ex.: VIP, Contrato, Manutenção). Clique para marcar ou desmarcar." />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(tags ?? []).map((t) => {
                    const selected = form.tag_ids.includes(t.id);
                    return (
                      <Badge key={t.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer"
                        style={selected ? { backgroundColor: t.color, color: "white", borderColor: t.color } : { borderColor: t.color, color: t.color }}
                        onClick={() => {
                          set("tag_ids", selected ? form.tag_ids.filter((id) => id !== t.id) : [...form.tag_ids, t.id]);
                        }}
                      >
                        {t.name}
                      </Badge>
                    );
                  })}
                  {(tags ?? []).length === 0 && (
                    <span className="text-xs text-muted-foreground">Nenhuma tag criada ainda.</span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input placeholder="Nova tag..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                  <Button type="button" variant="outline" disabled={!newTagName.trim() || tagMut.isPending}
                    onClick={() => tagMut.mutate(newTagName.trim())}>
                    Criar tag
                  </Button>
                </div>
              </div>
              <Separator />
              <div>
                <LabelWithHelp label="Observações internas" help="Notas que só a sua equipe vê. Não aparece para o cliente." />
                <Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar cliente"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
