import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/finance")({
  beforeLoad: ({ location }) => {
    // Normalize: strip trailing slash. Only redirect when the user is exactly
    // on /finance (parent layout). Any child path like /finance/dashboard,
    // /finance/transactions, etc. passes through — this prevents redirect loops.
    const normalized = location.pathname.replace(/\/+$/, "");
    if (normalized === "/finance") {
      throw redirect({ to: "/finance/dashboard", replace: true });
    }
  },
  component: () => <Outlet />,
});
