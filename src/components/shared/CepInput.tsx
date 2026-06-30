import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { lookupCep, maskCep, onlyDigitsCep, type CepResult } from "@/lib/address-lookup";

type Props = {
  value: string;
  onChange: (cepDigitsOrMasked: string) => void;
  onResolve: (data: CepResult) => void;
  placeholder?: string;
  disabled?: boolean;
  /** when true, auto-fires lookup as soon as 8 digits are typed (default true) */
  autoLookup?: boolean;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
};

export function CepInput({
  value, onChange, onResolve, placeholder = "00000-000",
  disabled, autoLookup = true, id, className, ...rest
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const lastQueried = React.useRef<string>("");

  async function run(cepDigits: string) {
    if (cepDigits.length !== 8 || lastQueried.current === cepDigits) return;
    lastQueried.current = cepDigits;
    setLoading(true);
    try {
      const r = await lookupCep(cepDigits);
      if (r) {
        onResolve(r);
      } else {
        toast.error("Não foi possível buscar o CEP. Preencha o endereço manualmente.");
      }
    } catch {
      toast.error("Não foi possível buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        className={className}
        value={maskCep(value ?? "")}
        placeholder={placeholder}
        disabled={disabled || loading}
        inputMode="numeric"
        onChange={(e) => {
          const masked = maskCep(e.target.value);
          onChange(masked);
          const digits = onlyDigitsCep(e.target.value);
          if (autoLookup && digits.length === 8) void run(digits);
        }}
        onBlur={() => {
          const digits = onlyDigitsCep(value ?? "");
          if (digits.length === 8) void run(digits);
        }}
        aria-invalid={rest["aria-invalid"]}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || loading || onlyDigitsCep(value ?? "").length !== 8}
        onClick={() => void run(onlyDigitsCep(value ?? ""))}
        title="Buscar CEP"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </Button>
    </div>
  );
}
