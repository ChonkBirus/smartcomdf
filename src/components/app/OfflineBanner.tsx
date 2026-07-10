import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

/**
 * Banner discreto de status de conexão.
 * - Offline: banner fixo no topo com instrução de rascunho.
 * - Online (após offline): toast "Conexão restabelecida".
 * Não implementa fila offline; apenas informa.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    // Inicializa com estado real; evita mismatch em SSR pois _authenticated é ssr:false.
    setOffline(!navigator.onLine);

    let wasOffline = !navigator.onLine;
    const goOffline = () => {
      wasOffline = true;
      setOffline(true);
    };
    const goOnline = () => {
      setOffline(false);
      if (wasOffline) {
        wasOffline = false;
        toast.success("Conexão restabelecida.");
      }
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 sm:text-sm"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span className="text-center">
        Você está sem conexão. Algumas ações podem ser salvas como rascunho até a internet voltar.
      </span>
    </div>
  );
}
