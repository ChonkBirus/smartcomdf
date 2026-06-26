import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Image as ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listServiceOrderPhotos, registerServiceOrderPhoto, deleteServiceOrderPhoto,
  type ServiceOrderPhoto,
} from "@/lib/service-order-photos.functions";

type Status = "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";

const TYPE_LABEL: Record<ServiceOrderPhoto["photo_type"], string> = {
  BEFORE: "Antes",
  DURING: "Durante",
  AFTER: "Depois",
  PROBLEM: "Problema encontrado",
  MATERIAL: "Material utilizado",
  OTHER: "Outro",
};

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET = "service-order-photos";

export function ServiceOrderPhotos({
  serviceOrderId,
  companyId,
  status,
  canUpload,
  canDelete,
}: {
  serviceOrderId: string;
  companyId: string;
  status: Status;
  canUpload: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listServiceOrderPhotos);
  const registerFn = useServerFn(registerServiceOrderPhoto);
  const deleteFn = useServerFn(deleteServiceOrderPhoto);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["so-photos", serviceOrderId],
    queryFn: () => listFn({ data: { id: serviceOrderId } }),
  });

  const editable = canUpload && (status === "IN_PROGRESS" || status === "PAUSED");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["so-photos", serviceOrderId] });
    qc.invalidateQueries({ queryKey: ["so-exec-logs", serviceOrderId] });
  };

  const removeMutation = useMutation({
    mutationFn: (photoId: string) => deleteFn({ data: { photoId } }),
    onSuccess: () => { invalidate(); toast.success("Foto removida."); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover foto"),
  });

  const [previewPhoto, setPreviewPhoto] = useState<ServiceOrderPhoto | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando fotos…</p>;

  return (
    <div className="space-y-3">
      {editable && (
        <UploadControls
          serviceOrderId={serviceOrderId}
          companyId={companyId}
          onUploaded={async (input) => {
            await registerFn({ data: input });
            invalidate();
            toast.success("Foto enviada.");
          }}
        />
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className="group relative rounded-md overflow-hidden border bg-muted aspect-square"
              onClick={() => setPreviewPhoto(p)}
            >
              {p.signed_url ? (
                <img src={p.signed_url} alt={p.file_name}
                  className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  Sem prévia
                </div>
              )}
              <div className="absolute top-1 left-1">
                <Badge variant="secondary" className="text-[10px]">{TYPE_LABEL[p.photo_type]}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!previewPhoto} onOpenChange={(v) => !v && setPreviewPhoto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewPhoto ? TYPE_LABEL[previewPhoto.photo_type] : ""}</DialogTitle>
          </DialogHeader>
          {previewPhoto?.signed_url && (
            <img src={previewPhoto.signed_url} alt={previewPhoto.file_name}
              className="w-full max-h-[70vh] object-contain rounded-md bg-foreground" />
          )}
          {previewPhoto?.description && (
            <p className="text-sm text-muted-foreground">{previewPhoto.description}</p>
          )}
          {previewPhoto && (
            <p className="text-xs text-muted-foreground">
              {previewPhoto.uploaded_by_name ?? "—"}
              {" · "}
              {new Date(previewPhoto.created_at).toLocaleString("pt-BR")}
            </p>
          )}
          <DialogFooter>
            {previewPhoto && canDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Remover esta foto?")) {
                    removeMutation.mutate(previewPhoto.id);
                    setPreviewPhoto(null);
                  }
                }}
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setPreviewPhoto(null)}>
              <X className="h-4 w-4 mr-1" /> Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadControls({
  serviceOrderId,
  companyId,
  onUploaded,
}: {
  serviceOrderId: string;
  companyId: string;
  onUploaded: (input: {
    serviceOrderId: string;
    photoType: ServiceOrderPhoto["photo_type"];
    filePath: string;
    fileName: string;
    fileSize?: number;
    description?: string;
  }) => Promise<void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<ServiceOrderPhoto["photo_type"]>("DURING");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato inválido. Aceitos: JPG, PNG, WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("A imagem excede o limite de 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const photoId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/${serviceOrderId}/${photoId}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      await onUploaded({
        serviceOrderId,
        photoType,
        filePath: path,
        fileName: safeName,
        fileSize: file.size,
        description: description.trim() || undefined,
      });
      setDescription("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3 bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo da foto</Label>
          <Select value={photoType} onValueChange={(v) => setPhotoType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABEL) as Array<keyof typeof TYPE_LABEL>).map((k) => (
                <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Descrição (opcional)</Label>
          <Textarea rows={1} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          size="lg"
          variant="outline"
          className="h-12"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Camera className="h-5 w-5 mr-2" />}
          Câmera
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12"
          disabled={uploading}
          onClick={() => galleryRef.current?.click()}
        >
          <ImageIcon className="h-5 w-5 mr-2" /> Galeria
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        JPG, PNG ou WEBP até 10 MB. As fotos ficam em bucket privado.
      </p>
    </div>
  );
}
