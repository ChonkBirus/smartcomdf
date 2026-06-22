import { useRef, useState } from "react";
import { Camera, Upload, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseNotaDocument, uploadNotaFile } from "@/lib/smart-receiving.functions";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_SIZE = 15 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function NotaUploader({ onCreated }: { onCreated: (id: string) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const upload = useServerFn(uploadNotaFile);
  const parse = useServerFn(parseNotaDocument);

  async function handleFile(file: File) {
    if (file.size > MAX_SIZE) { toast.error("Arquivo acima de 15 MB."); return; }
    // Garante que o token mais recente está disponível antes do RPC.
    // Em refresh de token o contexto local pode estar momentaneamente vazio,
    // mas o Supabase client tem persistência própria.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    setBusy(true);
    try {
      setStage("Lendo arquivo...");
      const file_base64 = await fileToBase64(file);

      setStage("Enviando para o servidor...");
      const { id } = await upload({
        data: {
          original_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
          file_base64,
        },
      });

      setStage("Lendo nota com IA...");
      toast.message("Nota enviada — IA processando...");
      try {
        await parse({ data: { id } });
        toast.success("Leitura concluída. Revise os itens.");
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao processar com IA. Documento salvo para nova tentativa.");
      }
      onCreated(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setBusy(false);
      setStage("");
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Recebimento Inteligente com IA</p>
          <p className="text-xs text-muted-foreground">
            Envie uma foto ou PDF da nota fiscal — a IA extrai os itens automaticamente.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => cameraRef.current?.click()} disabled={busy} className="flex-1 sm:flex-initial">
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
          Tirar foto
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy} variant="outline" className="flex-1 sm:flex-initial">
          <Upload className="mr-1 h-4 w-4" />
          Enviar arquivo
        </Button>
        {busy && stage && <span className="self-center text-xs text-muted-foreground">{stage}</span>}
      </div>
      <input
        ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={fileRef} type="file" accept={ACCEPT} className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
