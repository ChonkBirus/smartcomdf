import { ShieldCheck } from "lucide-react";

export function AuthLoadingScreen({ message = "Verificando sessão..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
        <ShieldCheck className="h-8 w-8 text-primary-foreground" />
      </div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
