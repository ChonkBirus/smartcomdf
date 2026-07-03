// Server-only Asaas adapter. Never import from client code.
// API: https://docs.asaas.com/reference

export type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export type AsaasCustomerInput = {
  name: string;
  cpfCnpj?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
  externalReference?: string;
};

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
};

export type AsaasPaymentInput = {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
};

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  billingType: AsaasBillingType;
  dueDate: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCodeId?: string | null;
  externalReference: string | null;
};

export type AsaasPixQrCode = {
  encodedImage: string; // base64 PNG (no data: prefix)
  payload: string; // copia-e-cola
  expirationDate: string;
};

function getEnv() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY not configured");
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const baseUrl =
    env === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";
  if (env === "production" && apiKey.includes("sandbox")) {
    console.warn("[ASAAS] WARNING: production env but sandbox-looking key");
  }
  return { apiKey, baseUrl, env };
}

async function asaasFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { apiKey, baseUrl } = getEnv();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      "User-Agent": "SmartPro/1.0",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && (body.errors?.[0]?.description || body.message)) ||
      `Asaas ${res.status} ${res.statusText}`;
    console.error("[asaas] error", path, res.status, body);
    throw new Error(msg);
  }
  return body as T;
}

export async function asaasFindCustomerByExternalRef(
  externalReference: string,
): Promise<AsaasCustomer | null> {
  const res = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  );
  return res.data?.[0] ?? null;
}

export async function asaasCreateCustomer(
  input: AsaasCustomerInput,
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function asaasGetCustomer(id: string): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers/${id}`);
}

export async function asaasCreatePayment(
  input: AsaasPaymentInput,
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function asaasGetPayment(id: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${id}`);
}

export async function asaasGetPixQrCode(
  paymentId: string,
): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export function asaasEnv(): "sandbox" | "production" {
  return (getEnv().env as any) === "production" ? "production" : "sandbox";
}
