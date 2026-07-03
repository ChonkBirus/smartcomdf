import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, ShieldCheck, MessageSquare, Square, Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useFeatures } from "@/lib/features";
import { FeatureGate } from "@/components/app/FeatureGate";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation,
  getConversationMessages,
} from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "SmartCom IA — Copiloto" }] }),
  component: AssistantPage,
});

const QUICK_PROMPTS = [
  "Criar orçamento para instalação de câmeras",
  "Criar checklist para manutenção de CFTV",
  "Criar mensagem de follow-up para cliente",
  "Melhorar descrição de serviço",
  "Criar relatório técnico profissional",
  "Organizar produtos e serviços no estoque",
];

function AssistantPage() {
  return (
    <FeatureGate feature={"ai_assistant" as never}>
      <AssistantInner />
    </FeatureGate>
  );
}

function AssistantInner() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="SmartCom IA"
        description="Copiloto administrativo e operacional do SmartPro."
      />
      <div className="grid h-[calc(100vh-200px)] gap-4 lg:grid-cols-[260px_1fr]">
        <ConversationSidebar />
        <ChatPanel />
      </div>
    </div>
  );
}

// --- Shared store of active conversation id (URL-less; keeps things simple) ---
const useActiveConv = () => {
  const [id, setId] = useState<string | null>(null);
  return { id, setId };
};

// Keep a single source of truth via React Query
const ACTIVE_KEY = ["assistant", "active-conv"];

function useActiveConversation() {
  const qc = useQueryClient();
  const id = qc.getQueryData<string | null>(ACTIVE_KEY) ?? null;
  const set = (next: string | null) => qc.setQueryData(ACTIVE_KEY, next);
  // Subscribe to changes
  const { data } = useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => qc.getQueryData<string | null>(ACTIVE_KEY) ?? null,
    initialData: id,
    staleTime: Infinity,
  });
  return { activeId: data ?? null, setActiveId: set };
}

function ConversationSidebar() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const deleteFn = useServerFn(deleteConversation);
  const renameFn = useServerFn(renameConversation);
  const { activeId, setActiveId } = useActiveConversation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: convs = [], isLoading } = useQuery({
    queryKey: ["assistant", "conversations"],
    queryFn: () => fetchList(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!activeId && convs.length > 0) setActiveId(convs[0].id);
  }, [activeId, convs, setActiveId]);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
      if (row?.id) setActiveId(row.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (conversationId: string) => deleteFn({ data: { conversationId } }),
    onSuccess: (_d, conversationId) => {
      qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
      if (activeId === conversationId) setActiveId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMut = useMutation({
    mutationFn: (vars: { conversationId: string; title: string }) =>
      renameFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
      setRenamingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <aside className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3">
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="w-full"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova conversa
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading && <p className="px-2 py-4 text-xs text-muted-foreground">Carregando...</p>}
          {!isLoading && convs.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
          )}
          {convs.map((c) => {
            const active = c.id === activeId;
            const isRenaming = renamingId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                {isRenaming ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      const t = renameValue.trim();
                      if (t && t !== c.title) renameMut.mutate({ conversationId: c.id, title: t });
                      else setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-7 text-xs"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className="flex flex-1 items-center gap-2 truncate text-left"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{c.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(c.id);
                        setRenameValue(c.title);
                      }}
                      className="opacity-0 transition group-hover:opacity-100"
                      title="Renomear"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Excluir esta conversa?")) deleteMut.mutate(c.id);
                      }}
                      className="opacity-0 transition group-hover:opacity-100"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ChatPanel() {
  const qc = useQueryClient();
  const { activeId, setActiveId } = useActiveConversation();
  const createFn = useServerFn(createConversation);
  const fetchMessages = useServerFn(getConversationMessages);

  const { data: initialMessages, isLoading: loadingMsgs } = useQuery({
    queryKey: ["assistant", "messages", activeId],
    queryFn: () => (activeId ? fetchMessages({ data: { conversationId: activeId } }) : Promise.resolve([])),
    enabled: !!activeId,
    staleTime: 0,
  });

  if (!activeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
        <div className="brand-gradient mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <ShieldCheck className="h-7 w-7 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-semibold">SmartCom IA</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Crie uma nova conversa para começar a conversar com seu copiloto.
        </p>
        <Button
          className="mt-4"
          onClick={async () => {
            try {
              const row = await createFn({ data: {} });
              if (row?.id) {
                setActiveId(row.id);
                qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
              }
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova conversa
        </Button>
      </div>
    );
  }

  if (loadingMsgs) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card">
        <Shimmer>Carregando conversa...</Shimmer>
      </div>
    );
  }

  return (
    <ChatWindow key={activeId} conversationId={activeId} initialMessages={initialMessages ?? []} />
  );
}

type DbMessage = { id: string; role: string; content: string; created_at: string };

function ChatWindow({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: DbMessage[];
}) {
  const qc = useQueryClient();
  const initial: UIMessage[] = useMemo(
    () =>
      initialMessages.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
        parts: [{ type: "text", text: m.content }],
      })) as UIMessage[],
    [initialMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant/chat",
        fetch: async (input, init) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          return fetch(input, { ...init, headers });
        },
        body: () => ({ conversationId }),
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: initial,
    transport,
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["assistant", "conversations"] });
    },
    onError: (e) => {
      toast.error(e.message || "Erro ao enviar mensagem.");
    },
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId, status]);

  const isBusy = status === "submitted" || status === "streaming";

  const submit = async (value: string) => {
    const t = value.trim();
    if (!t || isBusy) return;
    setText("");
    await sendMessage({ text: t });
  };

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={
                <div className="brand-gradient flex h-12 w-12 items-center justify-center rounded-2xl">
                  <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                </div>
              }
              title="Como posso ajudar você hoje?"
              description="Escolha uma sugestão abaixo ou descreva o que precisa."
            >
              <div className="mt-4 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:bg-accent"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const textContent = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const isStreamingLast =
              status === "streaming" && !isUser && m.id === lastAssistantId;
            return (
              <Message key={m.id} from={isUser ? "user" : "assistant"}>
                {isUser ? (
                  <MessageContent>{textContent}</MessageContent>
                ) : (
                  <div className="flex w-full gap-3">
                    <div className="brand-gradient mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <MessageResponse>{textContent}</MessageResponse>
                      {isStreamingLast && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-middle" />
                      )}
                    </div>
                  </div>
                )}
              </Message>
            );
          })}

          {status === "submitted" && (
            <Message from="assistant">
              <div className="flex w-full gap-3">
                <div className="brand-gradient mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Shimmer>Pensando...</Shimmer>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            </Message>
          )}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput
          onSubmit={(msg) => {
            void submit(msg.text ?? text);
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pergunte algo ao SmartCom IA..."
            disabled={isBusy}
          />
          <PromptInputFooter className="justify-end gap-2">
            {isBusy && (
              <Button type="button" size="sm" variant="outline" onClick={() => stop()}>
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Parar
              </Button>
            )}
            <PromptInputSubmit status={status} disabled={isBusy || text.trim().length === 0} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
