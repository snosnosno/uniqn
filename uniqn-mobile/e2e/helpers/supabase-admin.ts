/**
 * Supabase Admin 유틸리티 (E2E 테스트용)
 *
 * Firebase Admin SDK를 대체하는 Supabase 헬퍼.
 * pre-seeded QA 계정을 활용하므로 service role key 없이도 대부분 동작함.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { E2E_CONFIG } from '../config';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface SupabaseAuthToken {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// QA 계정 상수 (Supabase migration으로 pre-seeded)
// ---------------------------------------------------------------------------

export const SUPABASE_QA_ACCOUNTS = {
  staff: {
    id: '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8',
    email: 'qa-staff@uniqn.test',
    password: 'TestPass1!',
    role: 'staff' as const,
    name: 'QA스태프',
  },
  employer: {
    id: '9cf771e9-0e67-413d-8395-5b1d573ae64d',
    email: 'qa-employer@uniqn.test',
    password: 'TestPass1!',
    role: 'employer' as const,
    name: 'QA구인자',
  },
  admin: {
    id: '95337a77-9700-427e-8ff3-bc7a14abb90e',
    email: 'qa-admin@uniqn.test',
    password: 'TestPass1!',
    role: 'admin' as const,
    name: 'QA관리자',
  },
} as const;

// ---------------------------------------------------------------------------
// signInWithSupabase — REST API 직접 호출
// ---------------------------------------------------------------------------

/**
 * Supabase password grant로 로그인 후 토큰 반환.
 * @supabase/supabase-js 클라이언트 대신 fetch를 사용해 E2E 환경 의존성을 최소화.
 */
export async function signInWithSupabase(
  email: string,
  password: string
): Promise<SupabaseAuthToken> {
  const { url, anonKey } = E2E_CONFIG.supabase;
  const endpoint = `${url}/auth/v1/token?grant_type=password`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(응답 본문 없음)');
    throw new Error(`Supabase 로그인 실패 [${response.status}] — email: ${email}\n응답: ${body}`);
  }

  return response.json() as Promise<SupabaseAuthToken>;
}

// ---------------------------------------------------------------------------
// getAdminClient — service role key가 있을 때만 반환
// ---------------------------------------------------------------------------

/**
 * Supabase service_role 클라이언트를 반환.
 * E2E_SUPABASE_SERVICE_ROLE_KEY가 설정되지 않은 경우 null을 반환하며,
 * pre-seeded 데이터만으로도 대부분의 테스트는 동작한다.
 */
export function getAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env['E2E_SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!serviceRoleKey) {
    console.warn(
      '[supabase-admin] E2E_SUPABASE_SERVICE_ROLE_KEY 미설정 — service_role 클라이언트 없이 진행합니다. ' +
        'pre-seeded 계정으로 대부분의 테스트는 동작합니다.'
    );
    return null;
  }

  return createClient(E2E_CONFIG.supabase.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// buildStorageStateEntry — Playwright storageState localStorage 엔트리 생성
// ---------------------------------------------------------------------------

/**
 * Playwright global-setup에서 storageState JSON을 구성할 때 사용.
 * Supabase auth 토큰 엔트리와 Zustand auth-storage 엔트리를 배열로 반환.
 */
export function buildStorageStateEntry(
  token: SupabaseAuthToken,
  accountRole: 'staff' | 'employer' | 'admin',
  _baseUrl: string
): { name: string; value: string }[] {
  const account = SUPABASE_QA_ACCOUNTS[accountRole];

  // Supabase auth localStorage 엔트리 (sb-{projectRef}-auth-token)
  const supabaseAuthEntry = {
    name: E2E_CONFIG.supabase.authStorageKey,
    value: JSON.stringify(token),
  };

  // Zustand auth-storage 엔트리
  const authStorageEntry = {
    name: 'auth-storage',
    value: JSON.stringify({
      state: {
        status: 'authenticated',
        user: {
          uid: token.user.id,
          email: token.user.email,
          displayName: account.name,
          photoURL: null,
        },
        profile: {
          uid: token.user.id,
          email: token.user.email,
          name: account.name,
          nickname: account.name,
          displayName: account.name,
          role: accountRole,
          status: 'active',
          isActive: true,
          phoneVerified: true,
          profileCompleted: true,
          emailVerified: true,
        },
        lastActivity: new Date().toISOString(),
      },
      version: 0,
    }),
  };

  return [supabaseAuthEntry, authStorageEntry];
}
