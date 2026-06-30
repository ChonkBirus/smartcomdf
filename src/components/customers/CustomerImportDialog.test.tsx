import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- mocks ---
vi.mock("@tanstack/react-start", () => ({
  // useServerFn returns the underlying fn as-is for tests
  useServerFn: (fn: any) => fn,
}));

const createFn = vi.fn();
const validateFn = vi.fn();
const listRowsFn = vi.fn();
const confirmFn = vi.fn();

vi.mock("@/lib/customer-import.functions", () => ({
  TARGET_FIELDS: ["__ignore__", "cpf_cnpj", "name", "email"],
  createCustomerImportJob: (...a: any[]) => createFn(...a),
  validateCustomerImport: (...a: any[]) => validateFn(...a),
  listCustomerImportRows: (...a: any[]) => listRowsFn(...a),
  confirmCustomerImport: (...a: any[]) => confirmFn(...a),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CustomerImportDialog } from "./CustomerImportDialog";
import { toast } from "sonner";

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CustomerImportDialog open onOpenChange={() => {}} companyId="company-1" />
    </QueryClientProvider>,
  );
}

function makeCsvFile() {
  const csv =
    "tipo_cliente,nome_razao_social,nome_fantasia,cpf_cnpj,telefone,email,cep,endereco,numero,complemento,bairro,cidade,uf,contato_nome,contato_telefone,contato_email,observacoes\n" +
    "PF,Cliente Importado PF,,12345678900,61999999999,,70000000,Quadra Teste,10,,Asa Sul,Brasília,DF,João,61999999999,,Teste importação\n" +
    "PJ,Cliente Importado PJ,Empresa PJ,11222333000181,6133333333,,70000000,Quadra Comercial,20,Sala 1,Asa Norte,Brasília,DF,Maria,61988888888,,Teste importação PJ\n";
  return new File([csv], "clientes.csv", { type: "text/csv" });
}

function getFileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  if (!input) throw new Error("file input not found");
  return input;
}

beforeEach(() => {
  createFn.mockReset();
  validateFn.mockReset();
  listRowsFn.mockReset();
  confirmFn.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("CustomerImportDialog — loading/disabled states", () => {
  it("desabilita input de arquivo e Cancelar enquanto cria o job; reabilita após sucesso", async () => {
    let resolveCreate: (v: any) => void = () => {};
    createFn.mockImplementation(
      () =>
        new Promise((r) => {
          resolveCreate = r;
        }),
    );

    renderDialog();

    const input = getFileInput();
    expect(input.disabled).toBe(false);

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeCsvFile()] } });
    });

    // parsing/creating → controles bloqueados
    await waitFor(() => expect(getFileInput().disabled).toBe(true));
    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    expect(cancelBtn).toBeDisabled();
    expect(screen.getAllByText(/processando arquivo|validando|importando/i).length).toBeGreaterThan(0);

    // espera o parseFile + chamada de createFn antes de resolver
    await waitFor(() => expect(createFn).toHaveBeenCalled());

    // resolve a criação do job → vai para "mapping"
    resolveCreate({ job_id: "job-1", headers: ["cpf_cnpj", "name", "email"], mapping: {} });

    await waitFor(() => expect(document.querySelector('input[type="file"]')).toBeNull());
    expect(
      screen.queryAllByText(/processando arquivo|validando linhas|importando clientes/i).length,
    ).toBe(0);
  });

  it("mostra loading durante validação automática e reabilita após erro", async () => {
    createFn.mockResolvedValue({
      job_id: "job-1",
      headers: ["cpf_cnpj", "name", "email"],
      mapping: { cpf_cnpj: "cpf_cnpj", name: "name", email: "email" },
    });

    let rejectValidate: (e: any) => void = () => {};
    validateFn.mockImplementation(
      () =>
        new Promise((_res, rej) => {
          rejectValidate = rej;
        }),
    );

    renderDialog();
    await act(async () => {
      fireEvent.change(getFileInput(), { target: { files: [makeCsvFile()] } });
    });

    // validação automática pendente: input e cancelar seguem bloqueados
    expect(await screen.findByText(/validando linhas/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByRole("button", { name: /validar/i })).toBeDisabled();

    // erro → controles reabilitam e erro real aparece via toast
    await act(async () => {
      rejectValidate(new Error("falha de rede"));
    });

    await waitFor(() => expect(screen.getByRole("button", { name: /validar/i })).not.toBeDisabled());
    expect(screen.queryByText(/validando linhas/i)).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("falha de rede");
  });

  it("não fecha o diálogo enquanto está ocupado", async () => {
    const onOpenChange = vi.fn();
    createFn.mockImplementation(() => new Promise(() => {}));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <CustomerImportDialog open onOpenChange={onOpenChange} companyId="company-1" />
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.change(getFileInput(), { target: { files: [makeCsvFile()] } });
    });
    await waitFor(() => expect(getFileInput().disabled).toBe(true));

    // tentar fechar via botão Cancelar — está disabled, então não chama onOpenChange
    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("lê o CSV mínimo, mostra preview com 2 válidos e confirma importação", async () => {
    createFn.mockResolvedValue({
      job_id: "job-1",
      headers: ["tipo_cliente", "nome_razao_social", "cpf_cnpj", "telefone", "email", "cidade", "uf"],
      mapping: {
        tipo_cliente: "customer_type",
        nome_razao_social: "name",
        cpf_cnpj: "cpf_cnpj",
        telefone: "phone",
        email: "email",
        cidade: "addr_city",
        uf: "addr_state",
      },
    });
    validateFn.mockResolvedValue({
      job_id: "job-1",
      valid: 2,
      invalid: 0,
      duplicates: 0,
      total: 2,
      addresses_to_create: 2,
      contacts_to_create: 2,
      new_tags: [],
    });
    listRowsFn.mockResolvedValue([
      {
        id: "row-1",
        row_number: 1,
        action: "CREATE",
        status: "VALID",
        validation_errors: null,
        mapped_data: { customer_type: "INDIVIDUAL", name: "Cliente Importado PF", cpf_cnpj: "12345678900", phone: "61999999999", addr_city: "Brasília", addr_state: "DF" },
      },
      {
        id: "row-2",
        row_number: 2,
        action: "CREATE",
        status: "VALID",
        validation_errors: null,
        mapped_data: { customer_type: "COMPANY", name: "Cliente Importado PJ", cpf_cnpj: "11222333000181", phone: "6133333333", addr_city: "Brasília", addr_state: "DF" },
      },
    ]);
    confirmFn.mockResolvedValue({ created: 2, updated: 0, skipped: 0, addresses: 2, contacts: 2 });

    renderDialog();
    await act(async () => {
      fireEvent.change(getFileInput(), { target: { files: [makeCsvFile()] } });
    });

    expect(await screen.findByText("Cliente Importado PF")).toBeInTheDocument();
    expect(screen.getByText("Cliente Importado PJ")).toBeInTheDocument();
    expect(screen.getAllByText("2", { selector: ".text-2xl" }).length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /importar clientes válidos/i }));
    });

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(await screen.findByText(/importação concluída/i)).toBeInTheDocument();
  });
});
