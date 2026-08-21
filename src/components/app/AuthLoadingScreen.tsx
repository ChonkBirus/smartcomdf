export function AuthLoadingScreen({ message = "Verificando sessão..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <img
        src="/brand/smart-pro-logo-icon.png"
        alt="Ícone SmartPro"
        className="h-14 w-14 rounded-2xl object-contain shadow-lg"
      />
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
