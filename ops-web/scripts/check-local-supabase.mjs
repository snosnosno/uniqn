/**
 * 로컬 Supabase 연결 확인 — `npm run check:local-db`.
 *
 * anon 으로 공개 RPC `ops_get_monitor_snapshot` 을 없는 토큰으로 호출한다.
 * "함수를 찾을 수 없음"·네트워크 오류가 아니라 비즈니스 응답(빈 결과 또는 P0001)이 오면
 * ① 로컬 DB 에 접속되고 ② ops 마이그레이션이 적용돼 있다는 뜻이다.
 * 선행: uniqn-mobile 에서 `npx supabase start`.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  const text = readFileSync(path, 'utf-8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  );
}

const env = readEnvFile(new URL('../.env.development.local', import.meta.url));
const url = env.VITE_SUPABASE_URL;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  process.stderr.write(`로컬 Supabase URL 이 아닙니다: ${url}\n`);
  process.exit(1);
}

const supabase = createClient(url, env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.rpc('ops_get_monitor_snapshot', {
  p_monitor_token: '00000000-0000-0000-0000-000000000000',
});

const missingFunction =
  error && (error.code === 'PGRST202' || /Could not find the function/.test(error.message));
if (missingFunction || (error && !error.code)) {
  process.stderr.write(
    `연결 실패 또는 ops 마이그레이션 미적용: ${error.code ?? ''} ${error.message}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `로컬 Supabase 연결 OK (${url}) — 응답: ${error ? `${error.code} ${error.message}` : JSON.stringify(data)}\n`
);
