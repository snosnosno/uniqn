const DEFAULT_WEB_PORT = 4101;
const DEFAULT_ARTIFACT_DIR = 'output/playwright';

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStringEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for E2E tests. Set it in e2e/.env.test`);
  }
  return value;
}

const webPort = readNumberEnv('E2E_WEB_PORT', DEFAULT_WEB_PORT);
const baseUrl = readStringEnv('E2E_BASE_URL', `http://localhost:${webPort}`);
const artifactDir = readStringEnv('E2E_ARTIFACT_DIR', DEFAULT_ARTIFACT_DIR);

const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0];

// ---------------------------------------------------------------------------
// 심사·테스트 계정 비밀번호
// ---------------------------------------------------------------------------
// 이 값은 로컬 시드 마이그레이션(20260710000004_baseline_data_seed.sql)이 심는 값이라
// **로컬/CI 전용**이다. CI(e2e.yml)는 `supabase start` 로 로컬 스택을 띄우므로 이 기본값이 맞다.
//
// 2026-08-07 사고: 이 시드가 prod 에도 적용돼 있었고, 레포가 public 이라 평문 비밀번호로
// prod `review-admin`(app_metadata.role=admin) 에 누구나 로그인할 수 있었다.
// admin 은 permanently_delete_user 를 임의 사용자에게 호출할 수 있다(= auth.users 삭제).
// → prod `review-*` 4계정 비밀번호를 회전하고 전 세션을 파기했다.
//
// ⚠️ 시드가 만드는 @uniqn.app 계정은 4개가 아니라 **5개**다. 5번째
//    `pending-employer-staff@uniqn.app`(§5 AD-001)는 이름이 `review-` 로 시작하지 않아
//    2026-08-07 회전에서 누락됐고, 2026-08-07 실측 기준 prod 에서 아직 이 기본값과 일치한다.
//    권한이 staff 라 admin 경로는 없다. 전체 목록: docs/app-review/review-test-accounts.md
//
// 그래서 "로컬이 아닌 곳을 겨냥하는데 비밀번호가 여전히 시드 기본값"이면 여기서 막는다.
// 재발 시 조용히 통과하는 대신 즉시 실패한다 — prod 를 겨냥할 땐 회전된 값을
// E2E_TEST_ACCOUNT_PASSWORD 로 주입하고, 그 값을 레포에 커밋하지 말 것.
const LOCAL_SEED_ACCOUNT_PASSWORD = 'Review2026!';
const testAccountPassword = readStringEnv('E2E_TEST_ACCOUNT_PASSWORD', LOCAL_SEED_ACCOUNT_PASSWORD);

const supabaseHostname = new URL(supabaseUrl).hostname;
const isLocalSupabase =
  supabaseHostname === 'localhost' ||
  supabaseHostname === '127.0.0.1' ||
  supabaseHostname === '::1' ||
  supabaseHostname === 'host.docker.internal';

if (!isLocalSupabase && testAccountPassword === LOCAL_SEED_ACCOUNT_PASSWORD) {
  throw new Error(
    [
      `E2E 안전 정지: 원격 Supabase(${supabaseHostname}) 를 겨냥하는데 테스트 계정 비밀번호가`,
      '로컬 시드 기본값 그대로입니다. prod 계정 비밀번호는 2026-08-07 에 회전됐습니다.',
      'E2E_TEST_ACCOUNT_PASSWORD 에 회전된 값을 넣어 실행하세요(레포에 커밋 금지).',
    ].join(' ')
  );
}

export const E2E_CONFIG = {
  runtime: {
    webPort,
    baseUrl,
    artifactDir,
  },

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    projectRef: supabaseProjectRef,
    authStorageKey: `sb-${supabaseProjectRef}-auth-token`,
    isLocal: isLocalSupabase,
  },

  accounts: {
    /** 시드 계정 5종 공통 비밀번호. 로컬=시드 기본값, 원격=E2E_TEST_ACCOUNT_PASSWORD 필수. */
    password: testAccountPassword,
  },
} as const;
