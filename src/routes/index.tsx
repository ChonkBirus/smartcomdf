import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, LayoutGrid, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="relative flex flex-col items-center justify-center min-h-[85vh] text-center px-4 overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      {/* Fundo premium - radial + grid sutil */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_800px_400px_at_50%_-10%,var(--color-primary),transparent_70%)] opacity-[0.08] pointer-events-none" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.04] pointer-events-none" />
      
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/60 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-md shadow-sm shadow-primary/5">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-medium tracking-wide">Plataforma SmartPro 2026</span>
      </div>

      <h1 className="text-5xl font-bold font-display tracking-tight sm:text-7xl mb-6 bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent leading-[0.9]">
        SmartPro
      </h1>
      
      <p className="text-[17px] sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed font-light">
        Sistema de Gestão para Prestadores de Serviços e Comércio. Otimize seus orçamentos, projetos
        e financeiro em um só lugar.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 font-medium group">
          <Link to="/quotes" className="flex items-center gap-2">
            <FileText className="w-5 h-5 transition-transform group-hover:scale-110 duration-300" />
            Ver Orçamentos
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="backdrop-blur-md bg-card/60 hover:bg-card/90 border-border/60 hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300 font-medium">
          <Link to="/projects" className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Projetos
          </Link>
        </Button>
      </div>
    </div>
  ),
});
