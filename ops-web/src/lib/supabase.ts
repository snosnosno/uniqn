import { createClient } from '@supabase/supabase-js';
import { parseEnv } from './env';

const env = parseEnv(import.meta.env);

/**
 * 브라우저 Supabase 클라이언트 — uniqn.app 웹과 같은 기본 세션 방식(브라우저 저장소 + 자동 갱신).
 * 쓰기는 반드시 기존 `ops_*` SECDEF RPC 경유(설계 §5). 테이블 직접 DML 금지.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
