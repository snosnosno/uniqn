/**
 * 닉네임으로 가입자 찾기 — 모바일 UserRepository.searchByNickname 과 같은 RPC(search_users_by_nickname).
 * 짧은 입력 차단(열거 방지)은 호출측(2~15자)과 RPC 본문이 한다.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabaseUtils';

export interface NicknameSearchResult {
  uid: string;
  name: string;
  nickname?: string;
  region?: string;
}

export async function searchUsersByNickname(nickname: string): Promise<NicknameSearchResult[]> {
  const { data, error } = await supabase.rpc('search_users_by_nickname', { p_nickname: nickname });
  if (error) handleSupabaseError(error, { operation: '닉네임 사용자 검색', table: 'users' });
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    uid: row.id as string,
    name: (row.name as string) ?? '',
    nickname: (row.nickname as string) ?? undefined,
    region: (row.region as string) ?? undefined,
  }));
}
