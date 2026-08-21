import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getOnboardingProgress,
  listOnboardingProgress,
  upsertOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/onboarding.functions";
import { TOURS, type TourDefinition, type TourStep } from "./TourRegistry";
import { usePermissions } from "@/lib/permissions";
import { useFeatures } from "@/lib/features";
import { cn } from "@/lib/utils";

type Ctx = {
  activeTour: string | null;
  startTour: (key: string) => void;
  stopTour: (status?: "SKIPPED" | "COMPLETED") => void;
  progressFor: (key: string) => OnboardingProgress | null;
  isLoaded: boolean;
};

export const OnboardingCtx = createContext<Ctx | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return ctx;
}

export function OnboardingProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const fetchList = useServerFn(listOnboardingProgress);
  const fetchOne = useServerFn(getOnboardingProgress);
  const upsert = useServerFn(upsertOnboardingProgress);
  const qc = useQueryClient();

  const { data: all, isLoading } = useQuery({
    queryKey: ["onboarding", "all"],
    queryFn: () => fetchList(),
    enabled,
    staleTime: 60_000,
  });

  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const progressFor = useCallback(
    (key: string) => (all ?? []).find((p) => p.tour_key === key) ?? null,
    [all],
  );

  const upsertMut = useMutation({
    mutationFn: (v: {
      tourKey: string;
      status: OnboardingProgress["status"];
      currentStep?: number;
    }) => upsert({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding"] }),
  });

  const startTour = useCallback(
    (key: string) => {
      if (!TOURS[key]) return;
      const existing = progressFor(key);
      const nextStep = existing && existing.status === "IN_PROGRESS" ? existing.current_step : 0;
      setActiveTour(key);
      setStep(nextStep);
      upsertMut.mutate({ tourKey: key, status: "IN_PROGRESS", currentStep: nextStep });
    },
    [progressFor, upsertMut],
  );

  const stopTour = useCallback(
    (status: "SKIPPED" | "COMPLETED" = "SKIPPED") => {
      if (!activeTour) return;
      upsertMut.mutate({ tourKey: activeTour, status, currentStep: step });
      setActiveTour(null);
      setStep(0);
    },
    [activeTour, step, upsertMut],
  );

  // Auto-start initial tour for new users
  useEffect(() => {
    if (!enabled || isLoading || activeTour) return;
    const initial = (all ?? []).find((p) => p.tour_key === "initial");
    if (!initial) {
      let cancelled = false;
      // Defer to avoid flashing on first paint and to avoid setState during
      // parent render/mount of the dashboard.
      const t = setTimeout(() => {
        if (!cancelled) startTour("initial");
      }, 800);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [enabled, isLoading, all, activeTour, startTour]);

  // Sync step to backend (debounced via mutation queue)
  useEffect(() => {
    if (!activeTour) return;
    let cancelled = false;
    fetchOne({ data: { tourKey: activeTour } })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [activeTour, fetchOne]);

  const value = useMemo<Ctx>(
    () => ({
      activeTour,
      startTour,
      stopTour,
      progressFor,
      isLoaded: !isLoading,
    }),
    [activeTour, startTour, stopTour, progressFor, isLoading],
  );

  return (
    <OnboardingCtx.Provider value={value}>
      {children}
      {activeTour && (
        <TourOverlay
          tour={TOURS[activeTour]}
          step={step}
          onStepChange={(s) => {
            setStep(s);
            upsertMut.mutate({ tourKey: activeTour, status: "IN_PROGRESS", currentStep: s });
          }}
          onFinish={() => stopTour("COMPLETED")}
          onSkip={() => stopTour("SKIPPED")}
        />
      )}
    </OnboardingCtx.Provider>
  );
}

function TourOverlay({
  tour,
  step,
  onStepChange,
  onFinish,
  onSkip,
}: {
  tour: TourDefinition;
  step: number;
  onStepChange: (s: number) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const navigate = useNavigate();
  const { canView } = usePermissions();
  const { hasFeature } = useFeatures();

  const isStepAllowed = (s: TourStep) => {
    if (s.module && !canView(s.module)) return false;
    return true;
  };
  const isStepLocked = (s: TourStep) => Boolean(s.feature && !hasFeature(s.feature));

  // Filter steps the user can't view at all
  const steps = useMemo(() => tour.steps.filter(isStepAllowed), [tour, canView]);
  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep];
  const locked = current ? isStepLocked(current) : false;
  const isLast = safeStep >= steps.length - 1;

  useEffect(() => {
    if (!current?.route) return;
    let cancelled = false;
    // Defer to next tick to avoid updating router state while a parent
    // (e.g. Dashboard) is still mounting.
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        navigate({ to: current.route as never });
      } catch {
        /* noop */
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight") {
        if (isLast) onFinish();
        else onStepChange(safeStep + 1);
      } else if (e.key === "ArrowLeft" && safeStep > 0) onStepChange(safeStep - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [safeStep, isLast, onStepChange, onSkip, onFinish]);

  if (!current) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onSkip}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tour.name}
        className={cn(
          "relative w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-2xl",
          "sm:rounded-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-primary">
              {tour.name}
            </div>
            <h2 className="mt-1 text-lg font-bold leading-tight">{current.title}</h2>
          </div>
          <button
            onClick={onSkip}
            aria-label="Fechar tour"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

        {locked && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" />
            Este recurso está disponível nos planos Pro e Business.
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition",
                i <= safeStep ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Pular tour
          </Button>
          <div className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStepChange(Math.max(0, safeStep - 1))}
              disabled={safeStep === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            {isLast ? (
              <Button size="sm" onClick={onFinish}>
                Finalizar
              </Button>
            ) : (
              <Button size="sm" onClick={() => onStepChange(safeStep + 1)}>
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 text-right">
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Não mostrar novamente
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
