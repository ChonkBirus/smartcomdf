import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  createCheckoutSession,
  type CheckoutSessionResult,
} from "@/lib/billing-checkout.functions";
import { syncBillingStatus } from "@/lib/billing-sync.functions";
import { Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CouponInput } from "./CouponInput";
import type { ValidatedCoupon } from "@/lib/billing-coupons.functions";

type Method = "PIX" | "BOLETO" | "CREDIT_CARD";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planSlug: "starter" | "pro" | "business";
  planName: string;
  cycle: "MONTHLY" | "YEARLY";
};

export function CheckoutDialog({ open, onOpenChange, planSlug, planName, cycle }: Props) {
  const [method, setMethod] = useState<Method>("PIX");
  const [result, setResult] = useState<CheckoutSessionResult | null>(null);
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);

  // Lookup plan id + price for coupon validation
  const { data: plan } = useQuery({
    enabled: open,
    queryKey: ["plan-lookup", planSlug, cycle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, monthly_price, annual_price")
        .eq("slug", planSlug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const baseAmount = plan ? Number(cycle === "YEARLY" ? plan.annual_price : plan.monthly_price) : 0;

  const checkoutFn = useServerFn(createCheckoutSession);
  const m = useMutation({
    mutationFn: (payment_method: Method) =>
      checkoutFn({
        data: {
          plan_slug: planSlug,
          billing_cycle: cycle,
          payment_method,
          coupon_code: coupon?.code ?? null,
        },
      }),
    onSuccess: (r) => {
      setResult(r);
      if (r.payment_method === "CREDIT_CARD" && r.invoice_url) {
        window.open(r.invoice_url, "_blank", "noopener");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao iniciar cobrança"),
  });

  const reset = () => {
    setResult(null);
    setMethod("PIX");
    setCoupon(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assinar {planName}</DialogTitle>
          <DialogDescription>
            Ciclo {cycle === "YEARLY" ? "anual" : "mensal"}. A assinatura é ativada após confirmação
            do pagamento.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="PIX">Pix</TabsTrigger>
                <TabsTrigger value="BOLETO">Boleto</TabsTrigger>
                <TabsTrigger value="CREDIT_CARD">Cartão</TabsTrigger>
              </TabsList>
              <TabsContent value="PIX" className="text-sm text-muted-foreground pt-3">
                Pagamento instantâneo. Geramos um QR Code e o código Pix Copia e Cola.
              </TabsContent>
              <TabsContent value="BOLETO" className="text-sm text-muted-foreground pt-3">
                Boleto bancário com vencimento em 3 dias úteis. A confirmação pode levar 1 a 2 dias
                após o pagamento.
              </TabsContent>
              <TabsContent value="CREDIT_CARD" className="text-sm text-muted-foreground pt-3">
                Você será direcionado ao checkout seguro do provedor. Não armazenamos dados de
                cartão.
              </TabsContent>
            </Tabs>

            {plan && baseAmount > 0 && (
              <CouponInput
                planId={plan.id}
                amount={baseAmount}
                value={coupon}
                onChange={setCoupon}
              />
            )}

            {plan && baseAmount > 0 && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {baseAmount.toFixed(2)}</span>
                </div>
                {coupon && (
                  <div className="flex justify-between text-primary">
                    <span>Desconto ({coupon.code})</span>
                    <span>- R$ {coupon.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>R$ {(coupon ? coupon.final_amount : baseAmount).toFixed(2)}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => m.mutate(method)} disabled={m.isPending}>
                {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar cobrança
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <ResultView result={result} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResultView({ result, onClose }: { result: CheckoutSessionResult; onClose: () => void }) {
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const syncFn = useServerFn(syncBillingStatus);
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { charge_id: result.charge_id } }),
    onSuccess: (r) => {
      const s = (r as any)?.status as string | undefined;
      if (s === "RECEIVED" || s === "CONFIRMED" || s === "RECEIVED_IN_CASH") {
        toast.success("Pagamento confirmado. Sua assinatura está ativa.");
      } else {
        toast.message(
          "Pagamento ainda não identificado. Aguarde alguns instantes e tente novamente.",
        );
      }
    },
    onError: () =>
      toast.error(
        "Não foi possível atualizar o status agora. Tente novamente em alguns instantes.",
      ),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
        {result.discount_amount > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {result.original_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>Desconto{result.coupon_code ? ` (${result.coupon_code})` : ""}</span>
              <span>- R$ {result.discount_amount.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>R$ {result.amount.toFixed(2)}</span>
        </div>
        <div className="text-xs text-muted-foreground">Vencimento: {result.due_date}</div>
      </div>

      {result.payment_method === "PIX" && result.pix_qr_code_base64 ? (
        <div className="space-y-3">
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${result.pix_qr_code_base64}`}
              alt="QR Code Pix"
              className="h-56 w-56 rounded-md border bg-white p-2"
            />
          </div>
          {result.pix_copy_paste && (
            <div className="space-y-1">
              <Label>Pix Copia e Cola</Label>
              <div className="flex gap-2">
                <code className="flex-1 truncate rounded border bg-background px-2 py-1 text-xs">
                  {result.pix_copy_paste}
                </code>
                <Button size="icon" variant="outline" onClick={() => copy(result.pix_copy_paste!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {result.payment_method === "BOLETO" && result.bank_slip_url ? (
        <Button asChild className="w-full">
          <a href={result.bank_slip_url} target="_blank" rel="noopener">
            Abrir boleto <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      ) : null}

      {result.payment_method === "CREDIT_CARD" && result.invoice_url ? (
        <Button asChild className="w-full">
          <a href={result.invoice_url} target="_blank" rel="noopener">
            Ir para checkout seguro <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      ) : null}

      {result.invoice_url && result.payment_method !== "CREDIT_CARD" ? (
        <a
          href={result.invoice_url}
          target="_blank"
          rel="noopener"
          className="block text-center text-xs text-muted-foreground hover:underline"
        >
          Ver fatura no provedor
        </a>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Após o pagamento, a confirmação será automática pelo Asaas. Isso pode levar alguns
        instantes. A assinatura é ativada automaticamente.
      </p>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar status
        </Button>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </DialogFooter>
    </div>
  );
}
