import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `Você é o SmartCom IA, copiloto administrativo e operacional do SmartPro, um ERP para empresas de segurança eletrônica. Ajude o usuário a criar orçamentos, descrições de serviços, mensagens para clientes, checklists de OS, relatórios técnicos e sugestões de organização operacional. Seja claro, profissional e prático. Use formatação Markdown quando útil. Não invente dados do sistema. Não diga que alterou cadastros, estoque, pagamentos ou ordens de serviço. Quando uma ação depender do sistema, oriente o usuário ou sugira o próximo passo. Domínios relevantes: CFTV, alarme, controle de acesso, redes, interfonia, energia solar e carregadores veiculares.`;

export const Route = createFileRoute("/api/assistant/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const [{ convertToModelMessages, streamText }, { createLovableAiGatewayProvider }] = await Promise.all([
          import("ai"),
          import("@/lib/ai-gateway.server"),
        ]);

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claimsData.claims.sub;

        const body = (await request.json()) as { messages?: UIMessage[]; conversationId?: string };
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const conversationId = body.conversationId;
        if (!conversationId || typeof conversationId !== "string") {
          return new Response("conversationId required", { status: 400 });
        }

        // Validate ownership + plan/feature
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();
        if (!profile?.company_id) return new Response("No company", { status: 403 });
        const companyId: string = profile.company_id;

        const { data: conv } = await supabase
          .from("ai_conversations")
          .select("id, company_id, user_id")
          .eq("id", conversationId)
          .is("deleted_at", null)
          .maybeSingle();
        if (!conv || conv.user_id !== userId || conv.company_id !== profile.company_id) {
          return new Response("Forbidden", { status: 403 });
        }

        const { data: feats } = await supabase.rpc("get_my_features");
        const features: string[] = Array.isArray(feats) ? (feats as string[]) : [];
        if (!features.includes("ai_assistant")) {
          // super_admin bypass via RPC return
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
          if (!isSuper) return new Response("Feature not available on your plan", { status: 402 });
        }

        // Persist the latest user message
        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          const text = last.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("")
            .trim();
          if (text) {
            await supabase.from("ai_messages").insert({
              conversation_id: conversationId,
              company_id: profile.company_id,
              user_id: userId,
              role: "user",
              content: text,
            });
            // Auto-title first user msg
            const { count } = await supabase
              .from("ai_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", conversationId)
              .eq("role", "user");
            if (count === 1) {
              await supabase
                .from("ai_conversations")
                .update({ title: text.slice(0, 60) })
                .eq("id", conversationId);
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            try {
              const text = (responseMessage.parts ?? [])
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              if (text) {
                await supabase.from("ai_messages").insert({
                  conversation_id: conversationId,
                  company_id: companyId,
                  user_id: userId,
                  role: "assistant",
                  content: text,
                });
                await supabase
                  .from("ai_conversations")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", conversationId);
              }
            } catch (err) {
              console.error("[assistant.chat] persist assistant message failed", err);
            }
          },
          onError: (err) => {
            console.error("[assistant.chat] stream error", err);
            return err instanceof Error ? err.message : "Erro ao gerar resposta";
          },
        });
      },
    },
  },
});
