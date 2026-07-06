# Security Audit Report — SmartPro

Date: 2026-07-06
Scanner: Vibe Security Check (15 modules, OWASP Top 10)

## Executive Summary

Overall posture: **STRONG**. No Critical or High findings. The app is built
on TanStack Start + Lovable Cloud (Supabase) with server-side auth
middleware, RLS on all public tables, HMAC/token-verified webhooks, and
DOMPurify-sanitized markdown rendering.

- Critical: 0
- High: 0
- Medium: 2 (informational hardening)
- Low: 2

Auto-fixes applied: 0 (no code changes needed).
Dependency scan: 0 high/critical CVEs.

---

## Phase 0 — Reconnaissance

Signals detected:
- Auth: Supabase (email/password, Google, invite flow, reset-password)
- Server RPC: `createServerFn` + `requireSupabaseAuth` middleware
- Admin routes: `_authenticated/admin.*` gated by `is_super_admin` / role checks
- Webhooks: `api/public/billing-webhook.ts` (Asaas token), `api/public/open-finance-webhook.ts` (HMAC)
- File uploads: product images, service-order photos/signatures (Supabase Storage, signed URLs)
- Raw SQL: none in app code (uses PostgREST + RPC SECURITY DEFINER)
- `dangerouslySetInnerHTML`: 2 sites — shadcn chart CSS vars, DOMPurify-sanitized markdown
- CORS: none custom (framework default; no wildcard on authed endpoints)
- Deps: bun / package.json (no known high/critical CVEs)
- Secrets in repo: only publishable/anon keys in `.env` (safe by design)

Modules running: SEC-01..SEC-13. All applicable.

---

## Phase 1 — Module Results

### SEC-01 Secrets & API Key Exposure — PASS
Only `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (publishable) are in `.env`.
Service role and third-party secrets (`ASAAS_WEBHOOK_SECRET`, AI keys) are
read from `process.env` in server code only. No hardcoded tokens, no
private keys, no DB connection strings in source.

### SEC-02 Secure Authentication — PASS
Passwords handled by Supabase Auth (bcrypt). Session persisted through
Supabase client; server functions revalidate JWT via `getClaims` on every
call. No custom password storage. Recommend enabling **HIBP leaked
password check** in Cloud → Users → Auth Settings (Medium — hardening).

### SEC-03 JWT Security — PASS
Tokens issued and validated by Supabase (RS256 via JWKS). Server
middleware rejects missing/invalid `Bearer` tokens. No `alg: none`, no
manual HS256 signing anywhere.

### SEC-04 Password Reset Flow — PASS
Uses Supabase `resetPasswordForEmail` + `updateUser({ password })`.
Tokens are single-use and time-bound by Supabase. Generic UI messages
prevent account enumeration.

### SEC-05 IDOR & Ownership Checks — PASS
All data access goes through RLS policies scoped by
`company_id = get_current_company_id()` and `auth.uid()`. Server
functions run under the caller's JWT (not service role), so cross-tenant
access is prevented at the DB layer even if a client-supplied ID is
forged.

### SEC-06 Admin Route Protection — PASS
Admin server functions check `is_super_admin(auth.uid())` via RPC before
returning data. Client-side route gating exists only for UX; the
authoritative check is server-side.

### SEC-07 Input Validation — PASS
Server functions consistently use `zod` inside
`.inputValidator(...).handler(...)`. Client forms use `zodResolver` +
`react-hook-form`.

### SEC-08 XSS Protection — PASS
- `MarkdownRenderer`: DOMPurify with `FORBID_TAGS` (script, iframe, style,
  svg, math, form, object, embed) + URI scheme filter (blocks
  `javascript:`, `data:`, `vbscript:`) + `rel="noopener noreferrer"`.
- `chart.tsx`: injects computed CSS variables only, no user input.
- No `eval`, no `document.write`, no other `innerHTML` writes.

### SEC-09 Secure File Uploads — PASS (Low finding)
Product/photo/signature uploads go to Supabase Storage. Access is via
short-lived signed URLs. Buckets are private. **Low:** consider adding an
explicit MIME allowlist + max-size check in the upload server functions
(browser-side check exists, server should mirror it).

### SEC-10 CORS Configuration — PASS
No custom CORS in TanStack routes. `/api/public/*` handlers respond only
to the same-origin app or verified webhook callers. No wildcard on
authenticated endpoints.

### SEC-11 Webhook Verification — PASS
- `billing-webhook.ts`: constant-time comparison of `asaas-access-token`
  against `ASAAS_WEBHOOK_SECRET` via `timingSafeEqual` **before** any DB
  write.
- `open-finance-webhook.ts`: HMAC signature verification with
  provider-issued secret; rejects on mismatch.
- Both use idempotency tables keyed by `(provider, event_id)`.

### SEC-12 Error Message Leakage — PASS (Low finding)
Server functions throw generic `Error("Unauthorized")` / user-friendly
messages. Stack traces are not returned to the client. **Low:** a few
places `console.error` the raw error object — safe in Worker logs, but
avoid echoing Postgres error text back to the UI (`toast(error.message)`
is used in a few forms; consider mapping to friendly copy).

### SEC-13 Rate Limiting — MEDIUM
Supabase Auth applies default rate limits to sign-in/sign-up/reset.
Custom server functions (AI chat, PDF, imports) have **no explicit
rate limiter**. For an SMB app this is acceptable, but consider adding a
per-user throttle on expensive endpoints (`assistant.chat`,
`finance-agent.chat`, imports) to prevent AI-cost abuse.

---

## Phase 2 — Dependency Scan

`npm audit` / dependency scanner: **0 high, 0 critical** vulnerabilities.
No upgrades required.

---

## Phase 3 — Manual Attention (Recommended, not blocking)

1. **Enable HIBP leaked-password check** in Cloud → Users → Auth Settings.
2. **Add server-side MIME/size validation** in upload handlers (mirror
   client checks).
3. **Rate-limit expensive endpoints** (`assistant.chat`,
   `finance-agent.chat`, bulk imports) — e.g., a small `rate_limits`
   table keyed by `(user_id, endpoint, minute)`.
4. Map Postgres error messages to user-friendly copy before surfacing in
   toasts.

No auto-fixes were required because no Critical/High issues were found.
