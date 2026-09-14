import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, LayoutGrid, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="relative flex flex-col items-center justify-center min-h-[85vh] text-center px-4 overflow-hidden">
      {/* Background radial para profundidade no tema Grafite/Verde */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--color-accent)_0%,_transparent_70%)] opacity-20 pointer-events-none" />
      
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
        <Sparkles className="w-4 h-4 text-primary" />
        <span>Plataforma SmartPro 2026</span>
      </div>

      <h1 className="text-5xl font-bold font-display tracking-tight sm:text-7xl mb-6 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
        SmartPro
      </h1>
      
      <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
        Sistema de Gestão para Prestadores de Serviços e Comércio. Otimize seus orçamentos, projetos
        e financeiro em um só lugar.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
          <Link to="/quotes" className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Ver Orçamentos
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="backdrop-blur-sm bg-card/50 hover:bg-card/80 transition-all">
          <Link to="/projects" className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Projetos
          </Link>
        </Button>
      </div>
    </div>
  ),
});
