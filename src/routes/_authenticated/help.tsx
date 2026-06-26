import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, ArrowRight, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HELP_ARTICLES, type HelpArticle } from "@/lib/help-articles";
import { StartTourButton } from "@/components/onboarding/ModuleHelpButton";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({ meta: [{ title: "Central de Ajuda — SmartCom Pro" }] }),
  component: HelpCenterPage,
});

function HelpCenterPage() {
  const grouped = HELP_ARTICLES.reduce<Record<string, HelpArticle[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Central de Ajuda"
        description="Tutoriais, tours guiados e respostas para começar rápido."
      />

      <Card className="card-elevated mb-6">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <LifeBuoy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold">Faça o tour de boas-vindas</div>
              <p className="text-sm text-muted-foreground">
                Conheça o fluxo principal em poucos minutos. Você pode pular ou reiniciar a qualquer momento.
              </p>
            </div>
          </div>
          <StartTourButton tourKey="initial" label="Iniciar tour de boas-vindas" />
        </CardContent>
      </Card>

      <div className="space-y-8">
        {Object.entries(grouped).map(([category, articles]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <Card key={a.slug} className="card-elevated flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/help/$slug" params={{ slug: a.slug }}>
                          Ver tutorial <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {a.tourKey && <StartTourButton tourKey={a.tourKey} label="Iniciar tour" />}
                      {a.video_url && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={a.video_url} target="_blank" rel="noopener noreferrer">
                            <PlayCircle className="mr-1 h-4 w-4" /> Assistir vídeo
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
