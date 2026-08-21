import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
        SmartPro
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mb-8">
        Sistema de Gestão para Prestadores de Serviços e Comércio. 
        Otimize seus orçamentos, projetos e financeiro em um só lugar.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link to="/quotes">Ver Orçamentos</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/projects">Projetos</Link>
        </Button>
      </div>
    </div>
  ),
});