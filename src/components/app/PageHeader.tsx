import type { ReactNode } from "react";
import { ModuleHelpButton } from "@/components/onboarding/ModuleHelpButton";

export function PageHeader({ title, description, actions, tourKey }: {
  title: string; description?: string; actions?: ReactNode; tourKey?: string;
}) {
  return (
    <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {(actions || tourKey) && (
        <div className="flex flex-wrap gap-2">
          {tourKey && <ModuleHelpButton tourKey={tourKey} />}
          {actions}
        </div>
      )}
    </div>
  );
}
