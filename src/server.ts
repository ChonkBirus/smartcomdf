import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type SsrFetchDiagnostic = {
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  errorName?: string;
  errorMessage?: string;
  at: number;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let lastFetchDiagnostic: SsrFetchDiagnostic | undefined;

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      status: (error as Error & { status?: unknown; statusCode?: unknown }).status
        ?? (error as Error & { statusCode?: unknown }).statusCode,
      stack: error.stack,
    };
  }
  return { name: typeof error, message: String(error), status: undefined, stack: undefined };
}

function installSsrFetchDiagnostics() {
  const globalWithFlag = globalThis as typeof globalThis & {
    __smartproSsrFetchDiagnosticsInstalled?: boolean;
  };
  if (globalWithFlag.__smartproSsrFetchDiagnosticsInstalled) return;
  globalWithFlag.__smartproSsrFetchDiagnosticsInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const method = init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method);
    lastFetchDiagnostic = { url, method, at: Date.now() };
    try {
      const response = await originalFetch(input, init);
      lastFetchDiagnostic = { url, method, status: response.status, statusText: response.statusText, at: Date.now() };
      return response;
    } catch (error) {
      const details = describeError(error);
      lastFetchDiagnostic = {
        url,
        method,
        errorName: details.name,
        errorMessage: details.message,
        at: Date.now(),
      };
      throw error;
    }
  }) as typeof fetch;
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response, request: Request): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const requestUrl = new URL(request.url);
  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error("[SSR_HTTPERROR_SWALLOWED]", {
    route: requestUrl.pathname,
    status: response.status,
    body,
    contentType,
  });
  console.error(captured);
  return new Response(renderErrorPage({ error: captured, route: requestUrl.pathname }), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    installSsrFetchDiagnostics();
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, request);
    } catch (error) {
      console.error("[SSR_THROWN_ERROR]", {
        requestUrl: request.url,
        route: new URL(request.url).pathname,
        error: describeError(error),
        lastFetch: lastFetchDiagnostic,
      });
      console.error(error);
      return new Response(renderErrorPage({ error, route: new URL(request.url).pathname }), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
