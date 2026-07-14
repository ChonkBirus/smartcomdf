import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main style={{ padding: 40 }}>
      <h1>HOME OK</h1>
      <p>SSR_MINIMAL_HOME_OK_2026_07_13</p>
    </main>
  );
}