import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { findHelpArticle } from "@/lib/help-articles";
import { StartTourButton } from "@/components/onboarding/ModuleHelpButton";

export const Route = createFileRoute("/_authenticated/help_/$slug")({
  head: () => ({ meta: [{ title: "Tutorial — SmartCom Pro" }] }),
  component: TutorialArticlePage,
});

function TutorialArticlePage() {
  const { slug } = Route.useParams();
  const article = findHelpArticle(slug);
  if (!article) throw notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/help"><ArrowLeft className="mr-1 h-4 w-4" /> Central de Ajuda</Link>
      </Button>
      <PageHeader title={article.title} description={article.description} />

      <Card className="card-elevated">
        <CardContent className="space-y-4 p-6">
          {article.content.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/90">{p}</p>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            {article.tourKey && <StartTourButton tourKey={article.tourKey} label="Iniciar tour guiado" />}
            {article.video_url && (
              <Button asChild variant="outline">
                <a href={article.video_url} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="mr-1 h-4 w-4" /> Assistir vídeo
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
