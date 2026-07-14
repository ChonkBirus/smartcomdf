import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { classifyError, getFriendlyErrorMessage } from "@/lib/error-messages";
import { emitSessionExpired } from "@/lib/session-expired";

function handleGlobalError(error: unknown, opts: { showToast: boolean }) {
  const kind = classifyError(error);
  if (kind === "session_expired") {
    // Modal global cuida da UX; não exibe toast técnico.
    emitSessionExpired();
    return;
  }
  if (!opts.showToast) return;
  // Silenciar erros de rede e RLS em queries background evita ruído;
  // mutações sempre veem toast (via MutationCache).
  toast.error(getFriendlyErrorMessage(error));
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
          emitSessionExpired();
          return;
        }
        if (mutation.options.onError) return;
        toast.error(getFriendlyErrorMessage(error));
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
