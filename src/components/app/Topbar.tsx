import { LogOut, User as UserIcon, LifeBuoy, RefreshCw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsBell } from "./NotificationsBell";
import { supabase } from "@/integrations/supabase/client";
import { useContext, useEffect, useState } from "react";
import { OnboardingCtx } from "@/components/onboarding/OnboardingProvider";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
function useOnboardingSafe() {
  return useContext(OnboardingCtx) as null | { startTour: (k: string) => void };
}

export function Topbar({
  name,
  email,
  avatarUrl,
  companyName,
  userId,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  companyName?: string | null;
  userId?: string | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const onboarding = useOnboardingSafe();
  const initials = (name ?? email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setImgFailed(false);
    setResolvedAvatar(null);
    resolveAvatarUrl(avatarUrl).then((url) => {
      if (!cancelled) setResolvedAvatar(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur md:px-6">
      <SidebarTrigger />
      {companyName && (
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Empresa:</span>
          <span className="font-medium">{companyName}</span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell userId={userId} />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {resolvedAvatar && !imgFailed && (
                  <AvatarImage src={resolvedAvatar} onError={() => setImgFailed(true)} />
                )}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{name ?? "Usuário"}</div>
              <div className="text-xs text-muted-foreground truncate">{email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/help" })}>
              <LifeBuoy className="mr-2 h-4 w-4" /> Central de Ajuda
            </DropdownMenuItem>
            {onboarding && (
              <DropdownMenuItem onClick={() => onboarding.startTour("initial")}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar tour
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
