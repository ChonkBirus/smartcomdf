import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./OnboardingProvider";
import { TOURS } from "./TourRegistry";

export function ModuleHelpButton({ tourKey, label = "Como usar esta tela" }: { tourKey: string; label?: string }) {
  const { startTour } = useOnboarding();
  if (!TOURS[tourKey]) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => startTour(tourKey)} className="gap-1.5">
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

export function StartTourButton({ tourKey, label }: { tourKey: string; label?: string }) {
  const { startTour } = useOnboarding();
  const tour = TOURS[tourKey];
  if (!tour) return null;
  return (
    <Button size="sm" onClick={() => startTour(tourKey)}>
      {label ?? `Iniciar ${tour.name}`}
    </Button>
  );
}
