import { useQuery } from '@tanstack/react-query';
import { resolveOpsEntry } from '@/auth/entry';
import { supabase } from '@/lib/supabase';
import { fetchEntryProfile } from '@/repositories/authRepository';

export const opsEntryKey = (userId: string) => ['auth', 'entry', userId] as const;

/** 로그인한 사용자가 콘솔에 들어갈 수 있는지(가입 완료 여부). */
export function useOpsEntry(userId: string) {
  return useQuery({
    queryKey: opsEntryKey(userId),
    queryFn: async () => resolveOpsEntry(await fetchEntryProfile(supabase, userId)),
    staleTime: 5 * 60_000,
  });
}
