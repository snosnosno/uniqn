/**
 * UNIQN Mobile - Supabase Client
 *
 * @description 단일 Supabase 클라이언트 인스턴스
 */

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { getEnv } from './env';
import { createTimeoutFetch } from './supabaseFetch';
import { supabaseSessionStorage } from './supabaseSessionStorage';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const env = getEnv();
    _client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        // 네이티브 세션은 SecureStore(키체인/KeyStore)에 조각내 넣는다 (감사 auth-F3).
        // 예전에는 AsyncStorage 평문이라 루팅·탈옥 기기나 기기 백업에서 refresh token 이
        // 그대로 읽혔다 — 장기 자격증명이라 비밀번호 변경으로도 안 끊긴다.
        //
        // 웹(undefined = localStorage)은 의도적으로 그대로 둔다. sessionStorage 로 좁히면
        // 탭을 닫을 때마다 로그아웃돼 자동로그인과 정면 충돌한다 — 결정만 기록하고 바꾸지 않는다.
        storage: Platform.OS === 'web' ? undefined : supabaseSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        // 데이터 평면 타임아웃(감사 err-01). 리포지토리 330개 호출 지점에는 공통 래퍼가
        // 없어서 개별 배선이 불가능했다 — 클라이언트가 쓰는 fetch 를 바꾸는 것이
        // PostgREST·RPC·Storage·Auth 를 한 번에 덮는 유일한 지점이다.
        // (Realtime 은 WebSocket 이라 이 경로를 타지 않는다.)
        fetch: createTimeoutFetch(),
      },
    });
  }
  return _client;
}

/** Proxy for backwards-compatible import: `import { supabase } from '@/lib/supabase'` */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
