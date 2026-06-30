import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/account.functions";

/**
 * Returns the current authenticated user's active company_id.
 * Used to scope React Query keys so cache does not leak when a super-admin
 * (or a user with multiple companies) switches the active company.
 */
export function useCompanyId(): string | null {
  const { companyId } = useCompanyContext();
  return companyId;
}

export function useCompanyContext() {
  const fn = useServerFn(getMyContext);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  const companyId = ((query.data as any)?.company?.id ?? (query.data as any)?.profile?.company_id ?? null) as string | null;
  return { ...query, companyId };
}
