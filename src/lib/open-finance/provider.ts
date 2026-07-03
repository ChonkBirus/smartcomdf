/**
 * Open Finance provider abstraction.
 *
 * The SmartPro Open Finance module is provider-agnostic. Real integrations
 * with Pluggy / Belvo / etc. plug in here. When no provider credentials are
 * configured, `NullProvider` is used: the UI shows a "pending configuration"
 * state and refuses to fabricate fake bank data.
 *
 * Server-only — never import this from client code: it reads `process.env`.
 */

export type ProviderName = "PLUGGY" | "BELVO" | "MANUAL" | "OTHER";

export type ProviderStatus = {
  configured: boolean;
  provider: ProviderName | null;
  reason?: string;
};

export type ProviderConnectInit = {
  /** Opaque token / link the frontend uses to launch the provider widget. */
  connectToken: string | null;
  /** Provider-side connection ID (filled later when authorize completes). */
  providerConnectionId: string | null;
};

export interface OpenFinanceProvider {
  readonly name: ProviderName;
  status(): ProviderStatus;
  initConnection(companyId: string): Promise<ProviderConnectInit>;
  syncAccounts(providerConnectionId: string): Promise<unknown[]>;
  syncTransactions(
    providerConnectionId: string,
    filters?: { from?: string; to?: string }
  ): Promise<unknown[]>;
  revoke(providerConnectionId: string): Promise<void>;
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
}

/** No-op provider used when secrets are missing. */
class NullProvider implements OpenFinanceProvider {
  readonly name: ProviderName = "OTHER";
  constructor(private readonly reason: string) {}
  status(): ProviderStatus {
    return { configured: false, provider: null, reason: this.reason };
  }
  async initConnection(): Promise<ProviderConnectInit> {
    throw new Error("Provedor Open Finance não configurado.");
  }
  async syncAccounts(): Promise<unknown[]> {
    throw new Error("Provedor Open Finance não configurado.");
  }
  async syncTransactions(): Promise<unknown[]> {
    throw new Error("Provedor Open Finance não configurado.");
  }
  async revoke(): Promise<void> {
    // no-op
  }
  verifyWebhookSignature(): boolean {
    return false;
  }
}

/**
 * Pluggy placeholder. Real implementation will use Pluggy connect-token API
 * (POST /connect_token) and webhook HMAC verification. Until credentials are
 * provided we fail closed.
 */
class PluggyProvider implements OpenFinanceProvider {
  readonly name: ProviderName = "PLUGGY";
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly webhookSecret: string | null
  ) {}
  status(): ProviderStatus {
    return { configured: true, provider: "PLUGGY" };
  }
  async initConnection(): Promise<ProviderConnectInit> {
    // TODO: real Pluggy /connect_token call once integration is enabled.
    throw new Error(
      "Integração Pluggy reconhecida, mas a chamada de criação de connect-token ainda não foi habilitada."
    );
  }
  async syncAccounts(): Promise<unknown[]> {
    throw new Error("Sincronização Pluggy ainda não habilitada.");
  }
  async syncTransactions(): Promise<unknown[]> {
    throw new Error("Sincronização Pluggy ainda não habilitada.");
  }
  async revoke(): Promise<void> {
    // TODO: call Pluggy DELETE /items/:id
  }
  verifyWebhookSignature(_rawBody: string, headers: Headers): boolean {
    if (!this.webhookSecret) return false;
    const provided = headers.get("x-pluggy-signature") ?? "";
    // Minimal constant-time check (HMAC verification will be added with the
    // real integration). For now we require the shared secret as the header
    // value to avoid silently accepting unsigned events.
    if (provided.length !== this.webhookSecret.length) return false;
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) {
      mismatch |= provided.charCodeAt(i) ^ this.webhookSecret.charCodeAt(i);
    }
    return mismatch === 0;
  }
}

/** Belvo placeholder — same shape, different credentials. */
class BelvoProvider implements OpenFinanceProvider {
  readonly name: ProviderName = "BELVO";
  constructor(
    private readonly secretId: string,
    private readonly secretPassword: string,
    private readonly webhookSecret: string | null
  ) {}
  status(): ProviderStatus {
    return { configured: true, provider: "BELVO" };
  }
  async initConnection(): Promise<ProviderConnectInit> {
    throw new Error("Integração Belvo reconhecida, mas ainda não habilitada.");
  }
  async syncAccounts(): Promise<unknown[]> {
    throw new Error("Sincronização Belvo ainda não habilitada.");
  }
  async syncTransactions(): Promise<unknown[]> {
    throw new Error("Sincronização Belvo ainda não habilitada.");
  }
  async revoke(): Promise<void> {}
  verifyWebhookSignature(_rawBody: string, headers: Headers): boolean {
    if (!this.webhookSecret) return false;
    const provided = headers.get("x-belvo-signature") ?? "";
    if (provided.length !== this.webhookSecret.length) return false;
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) {
      mismatch |= provided.charCodeAt(i) ^ this.webhookSecret.charCodeAt(i);
    }
    return mismatch === 0;
  }
}

let cached: OpenFinanceProvider | null = null;

/** Returns the configured provider, or a NullProvider with a reason. */
export function getOpenFinanceProvider(): OpenFinanceProvider {
  if (cached) return cached;
  const choice = (process.env.OPEN_FINANCE_PROVIDER ?? "").trim().toUpperCase();

  if (choice === "PLUGGY") {
    const cid = process.env.PLUGGY_CLIENT_ID;
    const sec = process.env.PLUGGY_CLIENT_SECRET;
    if (!cid || !sec) {
      cached = new NullProvider(
        "Pluggy selecionado mas PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não estão configurados."
      );
      return cached;
    }
    cached = new PluggyProvider(cid, sec, process.env.PLUGGY_WEBHOOK_SECRET ?? null);
    return cached;
  }
  if (choice === "BELVO") {
    const id = process.env.BELVO_SECRET_ID;
    const pw = process.env.BELVO_SECRET_PASSWORD;
    if (!id || !pw) {
      cached = new NullProvider(
        "Belvo selecionado mas BELVO_SECRET_ID/BELVO_SECRET_PASSWORD não estão configurados."
      );
      return cached;
    }
    cached = new BelvoProvider(id, pw, process.env.BELVO_WEBHOOK_SECRET ?? null);
    return cached;
  }

  cached = new NullProvider(
    "Defina OPEN_FINANCE_PROVIDER=pluggy ou belvo e configure as credenciais do provedor."
  );
  return cached;
}

/** Test seam — clears the cached provider so env changes take effect. */
export function __resetOpenFinanceProvider() {
  cached = null;
}
