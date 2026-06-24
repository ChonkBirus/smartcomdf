import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eraser, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  collectCustomerSignature,
  listServiceOrderSignatures,
} from "@/lib/service-order-signatures.functions";

type Status = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

const BUCKET = "service-order-signatures";

export function ServiceOrderSignature({
  serviceOrderId,
  companyId,
  status,
  canCollect,
  defaultSignerName,
}: {
  serviceOrderId: string;
  companyId: string;
  status: Status;
  canCollect: boolean;
  defaultSignerName?: string | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listServiceOrderSignatures);
  const collectFn = useServerFn(collectCustomerSignature);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["so-signatures", serviceOrderId],
    queryFn: () => listFn({ data: { id: serviceOrderId } }),
  });

  const hasCustomerSig = signatures.some((s) => s.signature_type === "CUSTOMER");
  // Permitir coletar enquanto OS está em execução, pausada ou recém-concluída e ainda sem assinatura.
  const editable =
    canCollect &&
    !hasCustomerSig &&
    (status === "IN_PROGRESS" || status === "PAUSED" || status === "COMPLETED");

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-3">
      {signatures.length === 0 && !editable && (
        <p className="text-sm text-muted-foreground">
          Nenhuma assinatura coletada ainda.
        </p>
      )}

      {signatures.map((s) => (
        <div key={s.id} className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium">{s.signer_name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {s.signature_type === "CUSTOMER" ? "Cliente" : "Técnico"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(s.signed_at).toLocaleString("pt-BR")}
            </span>
          </div>
          {s.signed_url ? (
            <img
              src={s.signed_url}
              alt={`Assinatura de ${s.signer_name}`}
              className="w-full max-h-40 object-contain bg-white rounded border"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Pré-visualização indisponível.</p>
          )}
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            {s.signer_document && <div>Documento: {s.signer_document}</div>}
            {s.signer_email && <div>E-mail: {s.signer_email}</div>}
            {s.signer_phone && <div>Telefone: {s.signer_phone}</div>}
            {s.ip_address && <div>IP: {s.ip_address}</div>}
          </div>
        </div>
      ))}

      {editable && (
        <SignaturePad
          serviceOrderId={serviceOrderId}
          companyId={companyId}
          defaultSignerName={defaultSignerName ?? ""}
          onSaved={async ({ path, signerName, signerDocument, signerEmail, signerPhone }) => {
            await collectFn({
              data: {
                serviceOrderId,
                signaturePath: path,
                signerName,
                signerDocument: signerDocument || undefined,
                signerEmail: signerEmail || undefined,
                signerPhone: signerPhone || undefined,
                userAgent: navigator.userAgent.slice(0, 500),
              },
            });
            qc.invalidateQueries({ queryKey: ["so-signatures", serviceOrderId] });
            qc.invalidateQueries({ queryKey: ["so-exec-logs", serviceOrderId] });
            toast.success("Assinatura registrada.");
          }}
        />
      )}

      {hasCustomerSig && canCollect && (
        <p className="text-xs text-muted-foreground">
          Assinatura do cliente já foi coletada.
        </p>
      )}
    </div>
  );
}

function SignaturePad({
  serviceOrderId,
  companyId,
  defaultSignerName,
  onSaved,
}: {
  serviceOrderId: string;
  companyId: string;
  defaultSignerName: string;
  onSaved: (input: {
    path: string;
    signerName: string;
    signerDocument: string;
    signerEmail: string;
    signerPhone: string;
  }) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerDocument, setSignerDocument] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointer(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointer(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  };
  const onUp = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    hasStrokes.current = false;
  };

  const save = async () => {
    if (!hasStrokes.current) {
      toast.error("Faça a assinatura no quadro antes de salvar.");
      return;
    }
    if (signerName.trim().length < 2) {
      toast.error("Informe o nome de quem está assinando.");
      return;
    }
    setSaving(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvasRef.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
          "image/png",
        );
      });
      const sigId = crypto.randomUUID();
      const path = `${companyId}/${serviceOrderId}/${sigId}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (upErr) throw upErr;
      await onSaved({
        path,
        signerName: signerName.trim(),
        signerDocument: signerDocument.trim(),
        signerEmail: signerEmail.trim(),
        signerPhone: signerPhone.trim(),
      });
      clear();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Nome do assinante *</Label>
          <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label className="text-xs">CPF/CNPJ</Label>
          <Input value={signerDocument} onChange={(e) => setSignerDocument(e.target.value)} maxLength={32} />
        </div>
        <div>
          <Label className="text-xs">E-mail</Label>
          <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} maxLength={32} />
        </div>
      </div>

      <div>
        <Label className="text-xs flex items-center gap-1">
          <PenLine className="h-3.5 w-3.5" /> Assine no quadro abaixo
        </Label>
        <canvas
          ref={canvasRef}
          className="mt-1 w-full h-44 rounded border bg-white touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={clear} disabled={saving}>
          <Eraser className="h-4 w-4 mr-1" /> Limpar
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
          Salvar assinatura
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ao salvar, registramos data/hora, IP e dispositivo para fins de auditoria.
      </p>
    </div>
  );
}
