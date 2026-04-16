import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { employerApplicationRepository } from '@/repositories';
import type { EmployerApplication } from '@/repositories';

export function useEmployerApplication(): ReturnType<typeof useQuery<EmployerApplication | null>> {
  const { user } = useAuth();

  return useQuery<EmployerApplication | null>({
    queryKey: queryKeys.employerApplications.myLatest(),
    queryFn: () => employerApplicationRepository.getLatest(),
    enabled: Boolean(user?.uid),
    staleTime: 30 * 1000,
  });
}
