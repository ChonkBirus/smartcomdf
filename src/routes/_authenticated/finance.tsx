import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/finance" || location.pathname === "/finance/") {
      throw redirect({ to: "/finance/dashboard" });
    }
  },
  component: () => <Outlet />,
});
