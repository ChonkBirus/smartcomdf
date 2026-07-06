import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Small "?" icon that opens a plain-language explanation on hover/tap.
 * Works on desktop (click) and mobile (tap) via Popover.
 */
export function FieldHelp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda sobre este campo"
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-w-[280px] text-xs leading-relaxed"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** Label + inline help icon. Use in place of <Label> whenever a field has a help text. */
export function LabelWithHelp({
  label,
  help,
  htmlFor,
  className,
  required,
}: {
  label: string;
  help: ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <FieldHelp>{help}</FieldHelp>
    </div>
  );
}

export default FieldHelp;
