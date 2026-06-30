import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Send, Sparkles, Loader2, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Como está minha saúde financeira hoje?",
  "Quais são meus maiores riscos no próximo mês?",
  "Quem está inadimplente e o que devo fazer?",
  "Minha margem está adequada?",
];

export function FinanceAgentChat() {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/finance-agent/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: "finance-agent",
    messages: [] as UIMessage[],
    transport,
    onError: (e) => toast.error(e.message || "Erro ao gerar resposta."),
  });

  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => { inputRef.current?.focus(); }, [status]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const submit = async (value: string) => {
    const t = value.trim();
    if (!t || isBusy) return;
    setText("");
    await sendMessage({ text: t });
  };

  return (
    <Card className="flex flex-col h-[640px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-4 w-4 text-primary" />
        <div>
          <h3 className="font-semibold text-sm">SmartCom Finance IA</h3>
          <p className="text-xs text-muted-foreground">
            Analisa apenas dados reais da sua empresa. Não inventa números.
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pergunte algo sobre o financeiro da sua empresa:
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="text-left text-sm rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <MarkdownRenderer content={text || "…"} />


                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando seus dados…
            </div>
          )}
          {error && (
            <p className="text-xs text-destructive">Erro: {error.message}</p>
          )}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(text); }}
        className="border-t p-3 flex gap-2 items-end"
      >
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); }
          }}
          placeholder="Pergunte sobre saúde financeira, fluxo, inadimplência, margem…"
          rows={2}
          className="resize-none"
          disabled={isBusy}
        />
        {isBusy ? (
          <Button type="button" variant="outline" onClick={() => stop()} size="icon">
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </Card>
  );
}
