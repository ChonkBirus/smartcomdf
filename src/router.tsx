import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { classifyError, getFriendlyErrorMessage } from "@/lib/error-messages";

function emitSessionExpiredSafely() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("smartpro:session-expired"));
}

function toastErrorSafely(message: string) {
  if (typeof window === "undefined") return;
  void import("sonner").then(({ toast }) => toast.error(message));
}

function handleGlobalError(error: unknown, opts: { showToast: boolean }) {
  const kind = classifyError(error);
  if (kind === "session_expired") {
    // Modal global cuida da UX; não exibe toast técnico.
    emitSessionExpiredSafely();
    return;
  }
  if (!opts.showToast) return;
  // Silenciar erros de rede e RLS em queries background evita ruído;
  // mutações sempre veem toast (via MutationCache).
  toastErrorSafely(getFriendlyErrorMessage(error));
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => handleGlobalError(error, { showToast: false }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        // Se a mutação tem onError próprio, respeitamos e não duplicamos toast;
        // ainda assim disparamos o modal de sessão expirada quando aplicável.
        const kind = classifyError(error);
        if (kind === "session_expired") {
          emitSessionExpiredSafely();
          return;
        }
        if (mutation.options.onError) return;
        toastErrorSafely(getFriendlyErrorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
