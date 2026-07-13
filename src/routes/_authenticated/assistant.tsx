import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoadingScreen } from "@/components/app/AuthLoadingScreen";

const AssistantPage = lazy(() =>
  import("@/components/assistant/AssistantPage").then((module) => ({
    default: module.AssistantPage,
  })),
);

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "SmartCom IA — Copiloto" }] }),
  component: AssistantRoute,
});

function AssistantRoute() {
  return (
    <Suspense fallback={<AuthLoadingScreen message="Carregando SmartCom IA..." />}>
      <AssistantPage />
    </Suspense>
  );
}
