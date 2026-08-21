import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Tag, X } from "lucide-react";
import { validateCoupon, type ValidatedCoupon } from "@/lib/billing-coupons.functions";

type Props = {
  planId: string;
  amount: number;
  value: ValidatedCoupon | null;
  onChange: (coupon: ValidatedCoupon | null) => void;
};

export function CouponInput({ planId, amount, value, onChange }: Props) {
  const [code, setCode] = useState("");
  const fn = useServerFn(validateCoupon);

  const m = useMutation({
    mutationFn: () => fn({ data: { code: code.trim(), plan_id: planId, amount } }),
    onSuccess: (r) => {
      onChange(r);
      toast.success(`Cupom ${r.code} aplicado.`);
      setCode("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Cupom inválido."),
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <div>
            <div className="font-medium">{value.code}</div>
            <div className="text-xs text-muted-foreground">
              {value.discount_type === "percent"
                ? `${value.discount_value}% de desconto`
                : `R$ ${value.discount_value.toFixed(2)} de desconto`}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label="Remover cupom"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="coupon-code">Cupom de desconto (opcional)</Label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="DIGITE O CÓDIGO"
          maxLength={64}
          disabled={m.isPending}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => m.mutate()}
          disabled={!code.trim() || m.isPending}
        >
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
