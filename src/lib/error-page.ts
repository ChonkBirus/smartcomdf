type ErrorPageInput = {
  error?: unknown;
  route?: string;
};

const BUILD_CHECK = "SSR_ERROR_PAGE_SAFE_2026-07-13_01";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : "UnknownError";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "Sem mensagem";
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Sem mensagem");
  }
  return "Sem mensagem";
}

function stackSummary(error: unknown): string {
  if (!(error instanceof Error) || !error.stack) return "Stack indisponível";
  return error.stack.split("\n").slice(0, 8).join("\n");
}

function classify(error: unknown): string {
  const text = `${errorName(error)} ${errorMessage(error)} ${stackSummary(error)}`.toLowerCase();
  if (text.includes("hydration") || text.includes("hydrating")) return "hydration";
  if (text.includes("unauthorized") || text.includes("jwt") || text.includes("auth")) return "auth";
  if (text.includes("router") || text.includes("route")) return "router";
  if (text.includes("query") || text.includes("tanstack")) return "query";
  if (text.includes("chunk") || text.includes("failed to fetch dynamically imported module")) return "chunk";
  return "runtime";
}

export function renderErrorPage(input: ErrorPageInput = {}): string {
  const name = errorName(input.error);
  const message = errorMessage(input.error);
  const stack = stackSummary(input.error);
  const category = classify(input.error);
  const route = input.route ?? "desconhecida";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 42rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      details { margin-top: 1.25rem; text-align: left; border: 1px solid #d1d5db; border-radius: 0.5rem; background: #fff; padding: 0.875rem; }
      summary { cursor: pointer; font-weight: 650; }
      dl { display: grid; grid-template-columns: 8rem 1fr; gap: 0.35rem 0.75rem; margin: 0.75rem 0 0; font-size: 0.8rem; }
      dt { color: #6b7280; }
      dd { margin: 0; word-break: break-word; }
      pre { max-height: 11rem; overflow: auto; white-space: pre-wrap; word-break: break-word; color: #4b5563; background: #f3f4f6; border-radius: 0.375rem; padding: 0.75rem; font-size: 0.75rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <button class="secondary" onclick="clearLocalAuthAndGoLogin()">Limpar sessão local</button>
        <a class="secondary" href="/">Go home</a>
      </div>
      <details open>
        <summary>Diagnóstico seguro</summary>
        <dl>
          <dt>Tipo</dt><dd>${escapeHtml(category)}</dd>
          <dt>Erro</dt><dd>${escapeHtml(name)}</dd>
          <dt>Mensagem</dt><dd>${escapeHtml(message)}</dd>
          <dt>Rota SSR</dt><dd>${escapeHtml(route)}</dd>
          <dt>Rota atual</dt><dd id="diag-route">carregando...</dd>
          <dt>Sessão local</dt><dd id="diag-session">carregando...</dd>
          <dt>Storage auth</dt><dd id="diag-storage">carregando...</dd>
          <dt>Build check</dt><dd>${escapeHtml(BUILD_CHECK)}</dd>
        </dl>
        <pre>${escapeHtml(stack)}</pre>
      </details>
    </div>
    <script>
      (function () {
        function isAuthKey(key) {
          return /^sb-[a-z0-9]+-auth-token$/i.test(key || '') || /supabase\.auth\.token/i.test(key || '');
        }
        function authKeys(storage) {
          var keys = [];
          try {
            for (var i = 0; i < storage.length; i++) {
              var key = storage.key(i);
              if (isAuthKey(key)) keys.push(key);
            }
          } catch (_) {}
          return keys;
        }
        function hasSession(keys, storage) {
          for (var i = 0; i < keys.length; i++) {
            try {
              var raw = storage.getItem(keys[i]);
              var parsed = raw ? JSON.parse(raw) : null;
              if (parsed && (parsed.access_token || parsed.currentSession || parsed.session)) return true;
            } catch (_) {
              return 'corrompida';
            }
          }
          return false;
        }
        var local = authKeys(window.localStorage);
        var session = authKeys(window.sessionStorage);
        document.getElementById('diag-route').textContent = window.location.pathname + window.location.search;
        document.getElementById('diag-storage').textContent = 'local=' + local.length + ', session=' + session.length;
        document.getElementById('diag-session').textContent = String(hasSession(local, window.localStorage) || hasSession(session, window.sessionStorage));
        window.clearLocalAuthAndGoLogin = function () {
          local.concat(session).forEach(function (key) {
            try { window.localStorage.removeItem(key); } catch (_) {}
            try { window.sessionStorage.removeItem(key); } catch (_) {}
          });
          window.location.href = '/auth';
        };
      })();
    </script>
  </body>
</html>`;
}
