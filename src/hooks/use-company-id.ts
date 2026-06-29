import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/account.functions";

/**
 * Returns the current authenticated user's active company_id.
 * Used to scope React Query keys so cache does not leak when a super-admin
 * (or a user with multiple companies) switches the active company.
 */
export function useCompanyId(): string | null {
  const fn = useServerFn(getMyContext);
  const { data } = useQuery({
    queryKey: ["me", "company-id"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });
  return ((data as any)?.company?.id ?? (data as any)?.profile?.company_id ?? null) as string | null;
}
