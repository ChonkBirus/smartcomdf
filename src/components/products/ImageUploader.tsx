import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Star, StarOff, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerItemImage, setPrimaryItemImage, deleteItemImage } from "@/lib/products.functions";

const ACCEPT = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export type ItemImage = {
  id: string;
  file_path: string;
  file_name: string;
  is_primary: boolean;
  url: string | null;
};

export function ImageUploader({
  itemId,
  companyId,
  images,
  onChange,
}: {
  itemId: string;
  companyId: string;
  images: ItemImage[];
  onChange: (images: ItemImage[]) => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const registerFn = useServerFn(registerItemImage);
  const setPrimaryFn = useServerFn(setPrimaryItemImage);
  const deleteFn = useServerFn(deleteItemImage);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const accepted: ItemImage[] = [];
      for (const file of Array.from(files)) {
        if (!ACCEPT.includes(file.type)) {
          toast.error(`Formato não suportado: ${file.name}`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          toast.error(`Arquivo maior que 5MB: ${file.name}`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${companyId}/${itemId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Falha no upload: ${upErr.message}`);
          continue;
        }
        const row = await registerFn({
          data: { item_id: itemId, file_path: path, file_name: file.name, is_primary: false },
        });
        accepted.push(row as ItemImage);
      }
      if (accepted.length) {
        onChange([...images, ...accepted]);
        toast.success(`${accepted.length} imagem(ns) enviada(s).`);
        qc.invalidateQueries({ queryKey: ["items"] });
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const setPrimary = useMutation({
    mutationFn: (id: string) => setPrimaryFn({ data: { id } }),
    onSuccess: (_d, id) => {
      onChange(images.map((i) => ({ ...i, is_primary: i.id === id })));
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_d, id) => {
      onChange(images.filter((i) => i.id !== id));
      qc.invalidateQueries({ queryKey: ["items"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP — até 5MB cada.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? "Enviando..." : "Enviar imagens"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {images.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          <ImageIcon className="mb-1 h-6 w-6 opacity-50" />
          Nenhuma imagem cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-md border border-border bg-muted"
            >
              {img.url ? (
                <img
                  src={img.url}
                  alt={img.file_name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full" />
              )}
              {img.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-nano font-medium text-primary-foreground">
                  Principal
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!img.is_primary && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={() => setPrimary.mutate(img.id)}
                    title="Tornar principal"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                {img.is_primary && (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    disabled
                  >
                    <StarOff className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-7 w-7"
                  onClick={() => remove.mutate(img.id)}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Back-compat
export type ProductImage = ItemImage;
