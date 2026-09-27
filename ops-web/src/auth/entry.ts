/**
 * 로그인 후 진입 판정 — 설계 §4.2.
 *
 * `users` 4컬럼을 **동기화 사본** `getAuthenticatedEntryRoute` 에 넣어 모바일과 같은 결론을 낸다.
 * 모바일은 결과가 가입·재인증·프로필 화면 경로지만 ops 웹엔 그 화면이 없다(가입은 UNIQN 에서) →
 * "콘솔 진입 가능" 또는 "UNIQN 에서 마무리할 단계" 로만 번역한다.
 */
import {
  AUTH_ENTRY_ROUTES,
  getAuthenticatedEntryRoute,
} from '@/core/shared/navigation/authRedirect';
import type { UserProfile } from '@/core/types';

export interface EntryProfile {
  socialProvider: UserProfile['socialProvider'] | null;
  phoneVerified: boolean | null;
  identityVerified: boolean | null;
  profileCompleted: boolean | null;
}

export type IncompleteStep = 'signup' | 'reverify' | 'profile';

export type OpsEntry = { kind: 'ready' } | { kind: 'incomplete'; step: IncompleteStep };

/** @param profile `users` 행. 없으면(null) 가입이 끝나지 않은 계정이다. */
export function resolveOpsEntry(profile: EntryProfile | null): OpsEntry {
  if (!profile) return { kind: 'incomplete', step: 'signup' };

  const route = getAuthenticatedEntryRoute(profile);
  switch (route) {
    case AUTH_ENTRY_ROUTES.appTabs:
      return { kind: 'ready' };
    case AUTH_ENTRY_ROUTES.identityReverify:
      return { kind: 'incomplete', step: 'reverify' };
    case AUTH_ENTRY_ROUTES.profileSetup:
      return { kind: 'incomplete', step: 'profile' };
    default:
      return { kind: 'incomplete', step: 'signup' };
  }
}
