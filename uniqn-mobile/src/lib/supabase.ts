/**
 * UNIQN Mobile - Supabase Client
 *
 * @description 단일 Supabase 클라이언트 인스턴스
 */

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getEnv } from './env';
import { createTimeoutFetch } from './supabaseFetch';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const env = getEnv();
    _client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
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
