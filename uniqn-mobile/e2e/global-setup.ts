/**
 * Playwright Global Setup (Supabase 버전)
 * - Supabase pre-seeded QA 계정으로 로그인하여 storageState 생성
 * - 온보딩/튜토리얼 플래그 localStorage 사전 주입 (모달 방지)
 * - 자동 로그인 플래그 secure storage 사전 주입
 * - 미인증 상태 storageState 생성
 *
 * Firebase Admin SDK/Firestore 시딩은 T-W4-4에서 제거됨.
 * 테스트 데이터는 Supabase migration으로 pre-seeded됨.
 */
import fs from 'fs';
import path from 'path';
import { config as loadDotenv } from 'dotenv';

// .env.test 로드 (E2E_CONFIG가 EXPO_PUBLIC_SUPABASE_URL 등을 requireEnv로 읽기 때문에
// config import 전에 반드시 선행되어야 함)
loadDotenv({ path: path.join(__dirname, '.env.test') });

// eslint-disable-next-line import/first
import { TEST_ACCOUNTS, type TestAccount } from './fixtures/test-accounts';
// eslint-disable-next-line import/first
import { E2E_CONFIG } from './config';
// eslint-disable-next-line import/first
import { signInWithSupabase, buildStorageStateEntry } from './helpers/supabase-admin';

// ============================================================================
// 온보딩 UID 해싱 (앱과 동일한 알고리즘)
// ============================================================================

/**
 * src/utils/hash.ts의 hashUID와 동일한 해싱 함수
 * localStorage에 온보딩/튜토리얼 완료 플래그를 저장할 때 사용
 *
 * 이중 해시(djb2a 변형)로 ~64비트 공간 확보하여 충돌 저항성 강화
 *
 * SYNC: src/utils/hash.ts hashUID()와 동일 알고리즘 유지 필수
 * 어느 한쪽을 변경하면 다른 쪽도 반드시 동기화할 것
 */
function hashUID(uid: string): string {
  if (!uid) {
    throw new Error('hashUID: uid must be non-empty');
  }

  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }

  return `${Math.abs(hash1).toString(36)}_${Math.abs(hash2).toString(36)}`;
}

// ============================================================================
// storageState 생성 (Supabase Auth REST API 기반)
// ============================================================================

/**
 * Supabase Auth REST API로 로그인하고 Playwright storageState JSON을 생성한다.
 * UI 로그인에 의존하지 않아 앱 초기화(useAppInitialize) 없이도 인증 상태를 복원할 수 있다.
 */
async function generateStorageStates(): Promise<void> {
  const baseURL = E2E_CONFIG.runtime.baseUrl;
  const storageStatesDir = path.join(__dirname, 'fixtures', 'storage-states');

  fs.mkdirSync(storageStatesDir, { recursive: true });

  for (const [roleName, account] of Object.entries(TEST_ACCOUNTS) as Array<[string, TestAccount]>) {
    // 1. Supabase Auth REST API 로그인
    const token = await signInWithSupabase(account.email, account.password);

    // 2. 온보딩/튜토리얼 완료 플래그 (모달 방지)
    const userHash = hashUID(account.uid);
    const onboardingKey = `onboarding:notification_permission:${userHash}`;
    const onboardingVersionKey = `onboarding:version:${userHash}`;

    // 튜토리얼 완료 플래그
    // SYNC: src/constants/tutorials/index.ts TUTORIAL_KEY_MAP (키) + TUTORIAL_VERSIONS (버전)
    // 키 또는 버전 변경 시 여기도 반드시 업데이트할 것
    const tutorialTypes = ['app_intro', 'posting_guide', 'settlement', 'qr_checkin'] as const;
    // 현재 모든 튜토리얼 버전은 1 — TUTORIAL_VERSIONS 변경 시 동기화 필요
    const tutorialEntries = tutorialTypes.flatMap((type) => [
      { name: `tutorial:${type}:${userHash}`, value: 'true' },
      { name: `tutorial:version:${type}:${userHash}`, value: '1' },
    ]);

    // 3. 자동 로그인 플래그 (secureStorage 형식: uniqn_secure_ + key)
    const autoLoginStorageValue = JSON.stringify({
      value: true,
      storedAt: Date.now(),
    });

    // 4. Supabase auth + Zustand auth-storage 엔트리 생성
    const supabaseEntries = buildStorageStateEntry(token, account.role, baseURL);

    // 5. storageState JSON 구성
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            ...supabaseEntries,
            { name: onboardingKey, value: 'true' },
            { name: onboardingVersionKey, value: '1' },
            ...tutorialEntries,
            { name: 'uniqn_secure_autoLoginEnabled', value: autoLoginStorageValue },
          ],
        },
      ],
    };

    const filePath = path.join(storageStatesDir, `${roleName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
    console.log(`[storageState] ${roleName} (${account.email}) 생성 완료`);
  }

  // 미인증 상태 storageState
  const unauthenticatedStorageState = {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [],
      },
    ],
  };

  fs.writeFileSync(
    path.join(storageStatesDir, 'unauthenticated.json'),
    JSON.stringify(unauthenticatedStorageState, null, 2)
  );
  console.log('[storageState] unauthenticated 생성 완료');
}

// ============================================================================
// Global Setup
// ============================================================================

async function globalSetup(): Promise<void> {
  console.log('[e2e] Supabase QA 계정으로 storageState 생성 시작...');
  await generateStorageStates();
  console.log('[e2e] storageState 생성 완료');
}

export default globalSetup;
