/**
 * Supabase E2E 데이터 검증 스크립트
 *
 * Supabase에 pre-seeded된 QA 데이터 상태를 확인한다.
 * 데이터는 migration으로 관리되므로 이 스크립트는 상태 조회 및 로그용.
 *
 * 사용법:
 *   npx ts-node e2e/scripts/seedSupabase.ts
 *
 * 전제: e2e/.env.test (또는 환경변수) 설정 필요
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { config } from 'dotenv';
import path from 'path';

// e2e/.env.test 로드 (프로젝트 루트 기준)
config({ path: path.join(__dirname, '..', '.env.test') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[ERROR] 환경변수 누락: EXPO_PUBLIC_SUPABASE_URL 또는 EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
  console.error('e2e/.env.test 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface QaAccount {
  label: string;
  email: string;
  password: string;
  role: string;
}

const SUPABASE_QA_ACCOUNTS: QaAccount[] = [
  { label: 'staff', email: 'qa-staff@uniqn.test', password: 'TestPass1!', role: 'staff' },
  { label: 'employer', email: 'qa-employer@uniqn.test', password: 'TestPass1!', role: 'employer' },
  { label: 'admin', email: 'qa-admin@uniqn.test', password: 'TestPass1!', role: 'admin' },
];

interface SignInResult {
  label: string;
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
}

interface ProfileResult {
  email: string;
  name?: string;
  role?: string;
  found: boolean;
}

async function testSignIn(account: QaAccount): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data.user) {
    return {
      label: account.label,
      email: account.email,
      success: false,
      error: error?.message ?? '사용자 데이터 없음',
    };
  }

  // 로그인 후 세션 정리
  await supabase.auth.signOut();

  return {
    label: account.label,
    email: account.email,
    success: true,
    userId: data.user.id,
  };
}

async function fetchProfiles(emails: string[]): Promise<ProfileResult[]> {
  const { data, error } = await supabase
    .from('users')
    .select('email, name, role')
    .in('email', emails);

  if (error) {
    console.warn('[WARN] users 테이블 조회 실패:', error.message);
    return emails.map((email) => ({ email, found: false }));
  }

  const rowMap = new Map<string, { name?: string; role?: string }>(
    (data ?? []).map((row) => [row.email as string, { name: row.name, role: row.role }])
  );

  return emails.map((email) => {
    const row = rowMap.get(email);
    return row ? { email, name: row.name, role: row.role, found: true } : { email, found: false };
  });
}

async function fetchJobPostingCount(): Promise<number | null> {
  const { count, error } = await supabase
    .from('job_postings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.warn('[WARN] job_postings 조회 실패:', error.message);
    return null;
  }

  return count;
}

async function main(): Promise<void> {
  console.log('=== Supabase E2E 데이터 검증 ===');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('');

  // 1. 각 QA 계정 로그인 테스트
  console.log('--- [1/3] 계정 로그인 테스트 ---');
  const signInResults: SignInResult[] = [];

  for (const account of SUPABASE_QA_ACCOUNTS) {
    const result = await testSignIn(account);
    signInResults.push(result);

    if (result.success) {
      console.log(`[OK]   ${result.label.padEnd(8)} ${result.email} (uid: ${result.userId})`);
    } else {
      console.log(`[FAIL] ${result.label.padEnd(8)} ${result.email} — ${result.error}`);
    }
  }

  // 2. users 테이블 프로필 조회
  console.log('');
  console.log('--- [2/3] users 프로필 조회 ---');
  const emails = SUPABASE_QA_ACCOUNTS.map((a) => a.email);
  const profiles = await fetchProfiles(emails);

  for (const profile of profiles) {
    if (profile.found) {
      console.log(
        `[OK]   ${profile.email} — name: ${profile.name ?? '(없음)'}, role: ${profile.role ?? '(없음)'}`
      );
    } else {
      console.log(`[MISS] ${profile.email} — users 테이블에 없음`);
    }
  }

  // 3. job_postings 개수 조회
  console.log('');
  console.log('--- [3/3] job_postings 개수 조회 ---');
  const jobCount = await fetchJobPostingCount();

  if (jobCount !== null) {
    console.log(`[OK]   job_postings: ${jobCount}개`);
  } else {
    console.log('[FAIL] job_postings 조회 실패');
  }

  // 전체 결과 요약
  const signInOk = signInResults.filter((r) => r.success).length;
  const signInFail = signInResults.filter((r) => !r.success).length;
  const profileOk = profiles.filter((p) => p.found).length;
  const profileMiss = profiles.filter((p) => !p.found).length;

  console.log('');
  console.log('=== 검증 요약 ===');
  console.log(
    `로그인:  ${signInOk}/${SUPABASE_QA_ACCOUNTS.length} 성공${signInFail > 0 ? ` (${signInFail}개 실패)` : ''}`
  );
  console.log(
    `프로필:  ${profileOk}/${emails.length} 존재${profileMiss > 0 ? ` (${profileMiss}개 누락)` : ''}`
  );
  console.log(`공고:    ${jobCount !== null ? `${jobCount}개` : '조회 실패'}`);

  const allOk = signInFail === 0 && profileMiss === 0 && jobCount !== null;
  console.log(`상태:    ${allOk ? '✓ 모든 QA 데이터 정상' : '✗ 일부 항목 확인 필요'}`);

  if (!allOk) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[ERROR] 검증 스크립트 실행 실패:', error);
  process.exit(1);
});
