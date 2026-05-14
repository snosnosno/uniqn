# 세션 유지 — 비활성 타임아웃 제거 및 Supabase auto-refresh 위임

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱에 직접 구현된 30분 비활성 세션 만료 로직을 제거하고, 세션 수명 관리를 Supabase SDK의 `autoRefreshToken` + `persistSession`에 완전히 위임한다. 사용자는 refresh token이 만료(기본 30일)될 때까지 재로그인 없이 세션을 이어간다.

**Architecture:** `sessionService.ts`의 책임을 3가지 독립 관심사로 정리:

1. **유지할 것:** `onAuthStateChange` → `authStore` 동기화, 로그인 시도 rate limiting (브루트포스 방어), 초기 부트스트랩 가드 (캐시 복원 타이밍)
2. **삭제할 것:** 30분 비활성 타임아웃, 경고 토스트, 강제 `signOut`, 수동 `refreshSession` 인터벌 (SDK 내장 기능과 이중 구현), `recordActivity` export
3. **SDK에 위임:** 모든 토큰 수명 관리 (access token 자동 갱신, refresh token 만료 감지)

**Tech Stack:** TypeScript 5.9, Supabase JS v2 (`autoRefreshToken: true`, `persistSession: true`, `AsyncStorage`), Zustand, Jest 29, Expo Router v4

**Blast Radius:**

- `src/services/observability/sessionService.ts` (~600줄 → ~120줄, 관심사 A만 유지)
- **NEW** `src/services/auth/loginAttemptService.ts` (~100줄, 관심사 B 분리)
- `src/services/auth/authCoreService.ts` (import 경로 업데이트 1곳)
- `src/services/observability/index.ts` (export 정리)
- `src/services/observability/__tests__/sessionService.test.ts` (테스트 재작성)
- **NEW** `src/services/auth/__tests__/loginAttemptService.test.ts` (login rate limit 테스트 이관)
- `src/hooks/useAppInitialize.ts` (AppState 리스너에 `startAutoRefresh`/`stopAutoRefresh` 훅 추가)
- `app/_layout.tsx` (`recordActivity` 호출 제거)
- `src/hooks/useNavigationTracking.ts` (`recordActivity` 제거)

**영향 밖 (의도적):** `src/stores/authStore.ts`의 `suppressedSessionUserId` 필드는 **유지**. 비활성 타임아웃과 무관하고 "auto-login 비활성화 후 자동 복원 차단" 기능에 독립적으로 사용됨 (`authStore.ts:407-417`의 `clearAutoLoginBlockedSession` 경로).

---

## Task 0.5: Supabase Auth 프로젝트 설정 확인 (사전 점검)

Plan은 "기본 30일 refresh token, 1h access token"을 전제하지만, Supabase Dashboard 설정이 다를 수 있다. 구현 전 실제 값 확인.

**Files:** N/A (설정 조회 후 plan 본문 갱신)

- [ ] **Step 1: MCP로 Supabase Auth 설정 조회**

  ```
  mcp__supabase__execute_sql:
    SELECT
      raw_app_meta_data->'config'->>'jwt_exp' as jwt_exp,
      raw_app_meta_data->'config'->>'refresh_token_rotation_enabled' as rotation_enabled,
      raw_app_meta_data->'config'->>'security_refresh_token_reuse_interval' as reuse_interval
    FROM auth.config LIMIT 1;
  ```

  또는 Supabase Dashboard → Authentication → Sessions에서 직접 확인:
  - JWT expiry (access token)
  - Refresh token rotation
  - Refresh token reuse interval
  - Inactivity timeout (없으면 무한)
  - Time-box (절대 만료 시간)

- [ ] **Step 2: Plan 본문 갱신**

  실측 값으로 본문 "기본 30일" 부분 교체. Inactivity/timebox가 활성화돼 있다면 본 plan의 전제가 부분 무효 → 사용자에게 confirm 후 진행.

---

## Task 1: 제거 대상 / 유지 대상 정리

현재 `sessionService.ts` 구조를 기준으로 변경 범위를 확정한다.

**Files:**

- Read: `src/services/observability/sessionService.ts`

- [ ] **Step 1: 제거 대상 확정 (line 번호 기준)**

  | 대상      | 범위                                                                                                                                | 사유                               |
  | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
  | 상수      | `SESSION_TIMEOUT`, `SESSION_WARNING_BUFFER`, `TOKEN_REFRESH_INTERVAL` (20-22)                                                       | 비활성 타임아웃 제거               |
  | 모듈 상태 | `lastActivity`, `sessionTimeoutId`, `sessionWarningTimeoutId`, `tokenRefreshIntervalId`, `managedSessionUserId` (41-48)             | 타임아웃 관리 제거                 |
  | 헬퍼      | `shouldManageSessionForUser`, `clearSessionRuntime`, `syncManagedSessionState` (51-86)                                              | 타임아웃 전용                      |
  | 이벤트    | `handleAppStateChange` 내 session-check/clearTimeout 분기 (226-238)                                                                 | 포그라운드 세션 체크 불필요        |
  | 함수      | `checkSession`, `resetActivityTimer`, `clearSessionTimeout`, `clearSessionWarning`, `showSessionWarning`, `expireSession` (300-386) | 30분 만료 로직                     |
  | 함수      | `startTokenRefreshInterval`, `clearTokenRefreshInterval`, `checkAndRefreshToken` (388-430)                                          | SDK autoRefreshToken과 중복        |
  | Export    | `recordActivity`, `refreshToken`, `getValidToken`, `isSessionActive`, `getSessionState`                                             | 프로덕션 미사용 또는 타임아웃 전용 |

- [ ] **Step 2: 유지 대상 확정**

  | 대상                     | 사유                                                                                                                                                                                 |
  | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `initialize` / `cleanup` | Supabase auth 이벤트 구독 + authStore 동기화                                                                                                                                         |
  | `handleAuthStateChange`  | SIGNED_IN/OUT/TOKEN_REFRESHED → authStore                                                                                                                                            |
  | 부트스트랩 가드          | `armStartupAuthRestoreGuard`, `shouldWaitForStartupAuthRestore`, `waitForRestoredAuthUser`, `clearStartupAuthRestoreGuard`, `shouldSkipAuthStoreSync` (캐시 복원 타이밍 레이스 방지) |
  | 로그인 시도 제한         | `checkLoginAttempts`, `incrementLoginAttempts`, `resetLoginAttempts`, `getRemainingLoginAttempts` (브루트포스 방어, 별개 관심사)                                                     |

---

## Task 2: sessionService.ts 리팩토링

**Files:**

- Modify: `src/services/observability/sessionService.ts`

- [ ] **Step 1: 상수/모듈 상태 정리**

  남길 상수: `AUTH_RESTORE_SETTLE_TIMEOUT_MS`, `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION`.
  남길 모듈 상태: `isInitialized`, `appStateSubscription`, `authUnsubscribe`, `authStoreUnsubscribe`, `startupAuthRestoreGuardUntil`.
  제거: 위 Task 1 Step 1 표의 상수/모듈 상태.

- [ ] **Step 2: `initialize` 재작성**

  ```typescript
  export function initialize(): void {
    if (isInitialized) return;

    armStartupAuthRestoreGuard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthStateChange(session?.user ?? null);
    });
    authUnsubscribe = () => subscription.unsubscribe();

    isInitialized = true;
    logger.info('세션 매니저 초기화 완료');
  }
  ```

  주의: `AppState` 리스너, `authStore.subscribe`, `syncManagedSessionState` 호출 모두 제거. 타이머가 없으므로 포그라운드 복귀 시 재평가할 것이 없음.

- [ ] **Step 3: `cleanup` 재작성**

  제거 대상에서 파생된 state check 조건 단순화. 타이머/구독만 해제:

  ```typescript
  export function cleanup(): void {
    if (!isInitialized && !authUnsubscribe) return;

    clearStartupAuthRestoreGuard();
    authUnsubscribe?.();
    authUnsubscribe = null;

    isInitialized = false;
    logger.info('세션 매니저 정리 완료');
  }
  ```

  `AppState` 구독/`authStoreUnsubscribe` 관련 코드 제거.

- [ ] **Step 4: `handleAuthStateChange` 단순화**

  `shouldManageSessionForUser` 호출 제거. authStore 동기화만 수행:

  ```typescript
  async function handleAuthStateChange(user: SupabaseUser | null): Promise<void> {
    let nextUser = user;

    if (nextUser) {
      clearStartupAuthRestoreGuard();
    } else if (shouldWaitForStartupAuthRestore(nextUser)) {
      const restored = await waitForRestoredAuthUser();
      clearStartupAuthRestoreGuard();
      if (restored) {
        logger.debug('Ignored transient null auth event while Supabase session restored', {
          component: 'sessionService',
          uid: restored.id,
        });
        nextUser = restored;
      }
    }

    try {
      if (!shouldSkipAuthStoreSync(nextUser)) {
        await useAuthStore.getState().checkAuthState(nextUser);
      }
    } catch (error) {
      logger.warn('인증 상태 변경 중 스토어 동기화에 실패했습니다', {
        component: 'sessionService',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  ```

  토큰 갱신 관련 try/catch 블록 전체 제거 (282-287).

- [ ] **Step 5: default export / named export 정리**

  최종 export (관심사 A만):

  ```typescript
  export const sessionService = {
    initialize,
    cleanup,
  };
  ```

  제거: `recordActivity`, `isSessionActive`, `getSessionState`, `refreshToken`, `getValidToken`, `checkLoginAttempts` 외 3개 (Task 2.5로 이관).

---

## Task 2.5: loginAttemptService로 rate limiting 분리

`sessionService`의 책임을 **auth 이벤트 동기화**로만 제한하기 위해, 로그인 시도 제한 로직을 `src/services/auth/loginAttemptService.ts`로 뽑아낸다.

**Files:**

- Create: `src/services/auth/loginAttemptService.ts`
- Create: `src/services/auth/__tests__/loginAttemptService.test.ts`
- Modify: `src/services/auth/authCoreService.ts` (import 경로 변경)
- Modify: `src/services/observability/index.ts` (이 함수들은 더 이상 observability에서 export하지 않음)

- [ ] **Step 1: 새 파일로 4개 함수 이동**

  `sessionService.ts`의 `checkLoginAttempts`, `incrementLoginAttempts`, `resetLoginAttempts`, `getRemainingLoginAttempts` 및 관련 상수(`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION`)와 타입(`LoginAttempts`)을 `loginAttemptService.ts`로 그대로 복사. import는 `@/lib/secureStorage`, `@/utils/logger`, `@/errors`로 정리.

- [ ] **Step 2: authCoreService.ts import 경로 업데이트**

  `src/services/auth/authCoreService.ts:26-30`:

  ```typescript
  // Before
  import {
    checkLoginAttempts,
    incrementLoginAttempts,
    resetLoginAttempts,
  } from '@/services/observability/sessionService';
  // After
  import {
    checkLoginAttempts,
    incrementLoginAttempts,
    resetLoginAttempts,
  } from './loginAttemptService';
  ```

- [ ] **Step 3: 테스트 이관**

  `sessionService.test.ts`의 로그인 시도 관련 describe 블록 전체를 `loginAttemptService.test.ts`로 이관. mock shape 유지.

- [ ] **Step 4: observability 공개 API 정리**

  `src/services/observability/index.ts`에서 `checkLoginAttempts` 외 3개 export 제거. 외부 import는 이제 `@/services/auth/loginAttemptService`에서 가져옴.

---

## Task 2.7: onAuthStateChange callback deadlock 패턴 수정 (Codex 발견 #3)

**문제:** Supabase 공식 troubleshooting 문서가 명시한 known bug — `onAuthStateChange` callback 안에서 `await`로 다른 Supabase auth/PostgREST 호출 시 다음 Supabase 호출이 hang됨. 현재 `sessionService.ts`가 3곳에서 위반:

1. line 138: `await supabase.auth.getUser()` (callback 호출 경로 안)
2. line 246: `await waitForRestoredAuthUser()` (위 호출 포함)
3. line 260: `await useAuthStore.getState().checkAuthState(nextUser)` → `getUserProfile` (PostgREST)

**Files:** Modify `src/services/observability/sessionService.ts`

- [ ] **Step 1: `onAuthStateChange` 콜백 deferral 패턴 적용**

  callback 본체를 다음 micro-tick으로 defer해 SDK 내부 상태 머신 재진입을 회피.

  ```typescript
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase known bug: callback 내 await이 다음 supabase 호출을 hang 시킴.
    // setTimeout(0)로 다음 tick에 실행해 SDK 내부 락에서 빠져나오게 함.
    setTimeout(() => {
      void handleAuthStateChange(session?.user ?? null);
    }, 0);
  });
  ```

  주석 필수 — 왜 setTimeout인지 모르면 후임자가 "이상한 코드"로 보고 제거할 위험.

- [ ] **Step 2: `waitForRestoredAuthUser`의 `await getUser()` 검토**

  이 함수는 `handleAuthStateChange` 안에서 호출되므로, Step 1의 deferral로 자동 해결됨 (이미 다음 tick에서 실행). 추가 변경 불필요.

- [ ] **Step 3: 회귀 테스트 추가 (Task 4 Step 3에 통합)**

  ```typescript
  it('[REGRESSION] handleAuthStateChange가 다음 tick으로 defer되어 deadlock 회피', async () => {
    sessionService.initialize();
    const callback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];

    callback('SIGNED_IN', { user: mockUser } as Session);
    expect(mockCheckAuthState).not.toHaveBeenCalled(); // 같은 tick에선 미호출

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockCheckAuthState).toHaveBeenCalledWith(mockUser); // 다음 tick에 실행
  });
  ```

---

## Task 3: 호출부 정리 — `recordActivity` 제거

**Files:**

- Modify: `src/services/observability/index.ts:90-92`
- Modify: `app/_layout.tsx:167-168`
- Modify: `src/hooks/useNavigationTracking.ts:22, 252`

- [ ] **Step 1: observability barrel export 정리**

  `src/services/observability/index.ts`:

  ```typescript
  // Before
  export { recordActivity, isSessionActive, getSessionState, ... } from './sessionService';
  // After
  export { checkLoginAttempts, incrementLoginAttempts, resetLoginAttempts, getRemainingLoginAttempts, initialize, cleanup } from './sessionService';
  ```

- [ ] **Step 2: `app/_layout.tsx` 호출 제거**

  Line 166-170 주변의 dynamic import `.then(({ recordActivity }) => recordActivity())` 블록 삭제.

- [ ] **Step 3: `useNavigationTracking.ts` 정리**

  Line 22 `recordActivity` import 제거, Line 252 호출 제거. 라우트 변경 감지 자체는 Analytics 전송 목적으로 유지.

- [ ] **Step 3.5: `useAppInitialize.ts` AppState 리스너에 autoRefresh 훅 추가**

  Supabase JS RN 공식 가이드 준수: 백그라운드에서 JS 타이머가 멈추므로 `autoRefreshToken`도 함께 일시정지시키고, 포그라운드 복귀 시 재개해야 한다. 그렇지 않으면 백그라운드 장시간 체류 후 포그라운드 복귀 첫 요청이 401을 한 번 받을 수 있다.

  `src/hooks/useAppInitialize.ts:879-889` 기존 `useEffect`의 handler를 확장:

  ```typescript
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        supabase.auth.startAutoRefresh();
        if (state.isInitialized) {
          void syncAuthStateOnForeground();
        }
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    // 초기 1회 start — 첫 mount 시 AppState.currentState === 'active'여도 이벤트는 fire 안 함
    if (AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [state.isInitialized, syncAuthStateOnForeground]);
  ```

  `supabase` import 추가 (`@/lib/supabase`). Web 환경에서는 `startAutoRefresh`/`stopAutoRefresh`가 no-op이라 분기 불필요.

- [ ] **Step 4: 컴파일 검증**

  ```bash
  cd uniqn-mobile && npx tsc --noEmit
  ```

  `recordActivity`, `isSessionActive`, `getSessionState`, `refreshToken`, `getValidToken` 참조가 전부 제거됐는지 grep으로 재확인:

  ```bash
  grep -rn "recordActivity\|isSessionActive\|getSessionState\|sessionService\.refreshToken\|getValidToken" src/ app/
  ```

  hits: 0 (테스트 제외) 기대.

---

## Task 4: 테스트 재작성

**Files:**

- Modify: `src/services/observability/__tests__/sessionService.test.ts`

- [ ] **Step 1: 삭제 대상 테스트 식별**

  제거된 함수를 검증하는 모든 테스트 삭제:
  - "세션 타임아웃 후 expireSession 호출" 류
  - "30분 비활성 후 signOut 호출"
  - "포그라운드 복귀 시 checkSession 실행"
  - "tokenRefreshIntervalId 주기 갱신"
  - `isSessionActive`/`getSessionState` 직접 assert하는 테스트

- [ ] **Step 2: 유지 테스트 확인**

  `handleAuthStateChange` 시나리오 (SIGNED_IN/OUT/TOKEN_REFRESHED → authStore.checkAuthState 호출), 부트스트랩 가드 동작 (`waitForRestoredAuthUser` 타임아웃), 로그인 시도 제한은 **필수 유지**.

- [ ] **Step 3: 새 테스트 추가 (RED → GREEN)**

  회귀 방지용 단위 테스트를 추가. **IRON RULE**: REGRESSION 표시된 테스트는 필수.

  ```typescript
  describe('세션 유지 정책', () => {
    it('[REGRESSION] initialize 후 30분 경과해도 자동 signOut 호출되지 않는다', async () => {
      jest.useFakeTimers();
      sessionService.initialize();

      jest.advanceTimersByTime(30 * 60 * 1000 + 1000);
      await flushPromises();

      expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
      expect(routerReplaceSpy).not.toHaveBeenCalled();
    });

    it('[REGRESSION] AppState background → active 전환이 수동 refreshSession을 호출하지 않는다', async () => {
      sessionService.initialize();
      triggerAppStateChange('background');
      triggerAppStateChange('active');
      await flushPromises();

      expect(mockSupabase.auth.refreshSession).not.toHaveBeenCalled();
    });

    it('TOKEN_REFRESHED 이벤트 시 동일 user면 authStore 재동기화 skip', async () => {
      // shouldSkipAuthStoreSync 분기 검증
      mockAuthStoreState.status = 'authenticated';
      mockAuthStoreState.user = { uid: mockUser.id };
      mockAuthStoreState.profile = { uid: mockUser.id };

      sessionService.initialize();
      supabaseAuthCallback?.('TOKEN_REFRESHED', { user: mockUser } as Session);
      await flushPromises();

      expect(mockCheckAuthState).not.toHaveBeenCalled();
    });

    it('[REGRESSION] SDK가 SIGNED_OUT emit 시 (refresh token revoked) authStore 초기화로 전파', async () => {
      sessionService.initialize();
      supabaseAuthCallback?.('SIGNED_OUT', null);
      await flushPromises();

      expect(mockCheckAuthState).toHaveBeenCalledWith(null);
    });

    it('[REGRESSION] initialize 실패 후 cleanup 호출해도 crash 없음', () => {
      // onAuthStateChange mock throws
      mockSupabase.auth.onAuthStateChange.mockImplementationOnce(() => {
        throw new Error('init failed');
      });

      expect(() => sessionService.initialize()).toThrow();
      expect(() => sessionService.cleanup()).not.toThrow();
    });
  });
  ```

- [ ] **Step 3.5: useAppInitialize AppState 훅 테스트 (`useAppInitialize.test.ts`)**

  ```typescript
  it('[REGRESSION] AppState active 전환 시 supabase.auth.startAutoRefresh 호출', () => {
    renderHook(() => useAppInitialize());
    triggerAppStateChange('active');
    expect(mockSupabase.auth.startAutoRefresh).toHaveBeenCalled();
  });

  it('AppState background 전환 시 stopAutoRefresh 호출', () => {
    renderHook(() => useAppInitialize());
    triggerAppStateChange('background');
    expect(mockSupabase.auth.stopAutoRefresh).toHaveBeenCalled();
  });

  it('cleanup(언마운트) 시 stopAutoRefresh 호출 (타이머 누수 방지)', () => {
    const { unmount } = renderHook(() => useAppInitialize());
    unmount();
    expect(mockSupabase.auth.stopAutoRefresh).toHaveBeenCalled();
  });
  ```

- [ ] **Step 4: 테스트 실행**

  ```bash
  cd uniqn-mobile && npx jest src/services/observability/__tests__/sessionService.test.ts
  ```

  기대: 모든 테스트 통과. 기존 테스트 수 대비 ~40% 감소 예상.

---

## Task 5: 통합 검증

**Files:**

- Run: `npm run quality`, `npm test`

- [ ] **Step 1: 타입/린트/포맷 검증**

  ```bash
  cd uniqn-mobile && npm run quality
  ```

  실패 시 근본 원인 수정 (sessionService export 의존하는 곳 추가 발견 시 Task 3로 돌아가 그 파일도 정리).

- [ ] **Step 2: Mock contract 사전 업데이트** (Codex 발견 #2)

  Plan은 mock 변경을 "필요할 수 있음" 수준으로 다뤘으나, 실제로는 **필수**. 다음 mock에 신규 메서드 추가:
  - `jest.setup.js`: `supabase.auth` mock에 `startAutoRefresh: jest.fn()`, `stopAutoRefresh: jest.fn()` 추가
  - `src/__tests__/hooks/useAppInitialize.test.ts`: react-native mock의 `AppState`에 `currentState: 'active'` 명시 + `addEventListener` mock이 listener를 capture하도록 (이미 useNotificationHandler.test에 비슷한 패턴 있음 — 참조)
  - `src/services/observability/__tests__/sessionService.test.ts`: setTimeout-deferral 패턴 검증을 위해 `jest.useFakeTimers()` 사용 시 `jest.advanceTimersByTime(0)` 호출 필요

- [ ] **Step 3: 전체 테스트 실행**

  ```bash
  cd uniqn-mobile && npm test
  ```

  실패 시 mock contract부터 점검 (Step 2). 통과 후 다음 단계.

- [ ] **Step 4: 수동 E2E 시나리오 (iOS 시뮬레이터)**

  | 시나리오                                                                                              | 기대 결과                                                                   |
  | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
  | 로그인 후 앱을 40분간 그대로 둠                                                                       | 로그인 상태 유지, 로그인 화면 튕김 없음                                     |
  | 로그인 후 앱 백그라운드 30분 → 포그라운드                                                             | 세션 유지, API 호출 정상                                                    |
  | 비행기 모드 1분 후 해제                                                                               | `signOut` 호출 없이 다음 요청부터 정상                                      |
  | Supabase Dashboard에서 해당 user 강제 logout (JWT invalidate)                                         | 다음 API 요청에서 401 → SDK `onAuthStateChange('SIGNED_OUT')` → 로그인 화면 |
  | refresh token 만료 (실제 30일 경과는 어려우니 JWT expiry 짧게 설정하거나 Supabase에서 session revoke) | SIGNED_OUT 이벤트 정상 전파 → authStore 초기화 → 로그인 화면                |

- [ ] **Step 5: 앱 포그라운드 복귀 시 `AppState` 리스너 회귀 확인**

  `useNotificationSyncOnForeground`, `tokenRefreshService` (FCM), `queryClient.ts` AppState 리스너가 **sessionService와 독립**으로 계속 동작하는지 확인. sessionService에서 AppState 구독만 빼면 나머지는 영향 없어야 함.

---

## Rollback

변경이 회귀를 일으키면:

1. `git revert <commit-sha>` — 단일 리팩토링 커밋이므로 되돌리기 간단.
2. Supabase Dashboard에서 JWT expiry를 짧게 (예: 10분) 설정하면 기존 30분 타임아웃과 유사한 보안 프로파일 복원 가능 (refresh token rotation은 기본 ON이므로 자동 갱신 주기만 짧아짐).

---

## Non-Goals (명시적 제외)

- `authStore.suppressedSessionUserId` 필드 제거: auto-login 비활성화 경로가 독립적으로 사용 중. 별도 작업.
- `tokenRefreshService.ts` 수정: 이름이 혼동 유발하지만 **FCM 푸시 토큰 갱신 전용**으로 auth 세션과 무관. 이름 변경은 별개 cleanup.
- `AuthErrorBoundary.tsx`의 "세션이 만료되었습니다" UI: Supabase 자체에서 `SIGNED_OUT` 전파 시 여전히 표시 가능. 문구 유지.
- "모든 기기에서 로그아웃" UX 추가: 별개 feature. TODO.

---

## 리뷰 포인트 (`/plan-eng-review`용)

- **아키텍처:** `sessionService`의 관심사 분리 (타임아웃 제거 vs auth sync vs login rate limit) 명확한가?
- **회귀 리스크:** `useAppInitialize`가 `sessionService.initialize` 호출 경로 — mock shape 변경 시 그 테스트 스위트 깨질 가능성 측정.
- **테스트 커버리지:** 제거된 동작을 검증하는 테스트 수와 새로 추가하는 "유지 보장" 회귀 테스트 수 대비.
- **보안:** 30분 → 30일 유효 세션 연장이 앱 특성(스태프 관리, PII 취급)에 적절한가? Refresh token rotation이 ON인 전제를 문서화.
- **SDK 위임 전제 검증:** Supabase JS v2의 `autoRefreshToken` 동작이 RN `AppState` 백그라운드에서도 예상대로 동작하는지 (Supabase 공식 문서 RN 가이드 확인 필요).

---

## What already exists (재사용 항목)

| 기존 코드                                                                                   | 본 plan에서 활용                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Supabase JS v2 `autoRefreshToken` + `persistSession` (`src/lib/supabase.ts:21-22`)          | 30분 타임아웃 제거 후 토큰 수명 관리를 여기로 완전 위임                                  |
| `AsyncStorage` adapter (`src/lib/supabase.ts:20`)                                           | 앱 재시작 후 세션 복원 — 변경 없이 유지                                                  |
| `authStore.suppressedSessionUserId` 필드 (`src/stores/authStore.ts:35,141,248,264,410,511`) | auto-login 비활성화 경로 — sessionService와 분리되어 그대로 유지                         |
| `useAppInitialize.ts:880` AppState 리스너                                                   | 이미 존재 — Task 3.5에서 `startAutoRefresh`/`stopAutoRefresh` 훅을 같은 핸들러 안에 추가 |
| `queryClient.ts:86-92` AppState 리스너                                                      | TanStack Query refocus용 — 독립적, 영향 받지 않음                                        |
| `loginAttempts*` 함수 (현 `sessionService.ts`)                                              | Task 2.5로 `loginAttemptService.ts` 분리 — 로직 자체는 1:1 이관                          |
| 부트스트랩 가드 (`armStartupAuthRestoreGuard` 외)                                           | 그대로 유지, deferral 적용 후에도 동작 동일                                              |

**잘못 재구현하지 않은 것:** Supabase autoRefreshToken을 manual interval로 감싸지 않음 (Plan은 오히려 그 manual 래퍼를 제거).

---

## Failure Modes Registry

| 시나리오                                                   | 테스트 커버                                       | 에러 처리                                                                      | 사용자 체감                                     | 위험도                          |
| ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------- |
| Refresh token revoke (Supabase Dashboard에서 sign-out all) | Task 4 Step 3 SIGNED_OUT 회귀 ✓                   | `handleAuthStateChange(null)` → authStore.checkAuthState(null) → 로그인 화면 ✓ | 명확 (로그인 화면)                              | LOW                             |
| Access token 만료 + 네트워크 오프라인                      | 단위 ✗, 수동 E2E (Task 5 Step 4) ✓                | SDK 자체 재시도, 더 이상 강제 signOut 안 함 ✓                                  | 다음 요청에서 자동 복구                         | LOW                             |
| 백그라운드 30분 후 포그라운드 → 첫 요청 401                | E2E ✓, 단위 ✗                                     | startAutoRefresh가 active 전환 시 재개 (Task 3.5) ✓                            | 사용자 모름 (1-tick 지연)                       | LOW                             |
| onAuthStateChange callback deadlock                        | Task 2.7 회귀 테스트 ✓                            | setTimeout deferral ✓                                                          | 더 이상 hang 안 함                              | RESOLVED                        |
| `initialize` 실행 중 onAuthStateChange 구독 실패           | Task 4 Step 3 cleanup idempotent ✓                | cleanup 가드 (initialize 부분 실패 후 호출 OK) ✓                               | 앱 부팅 실패 toast                              | LOW                             |
| Supabase JWT expiry 설정이 5분 미만                        | E2E 실측 (Task 5 Step 4 시나리오 5) ✗ → 추가 필요 | autoRefreshToken이 expiry 80% 시점에 갱신 시도 — 5분 미만이면 race 발생 가능   | 첫 요청 후 401 → 토큰 갱신 → 재시도 (지연 가능) | **MEDIUM** — Task 0.5 검증 필수 |

**Critical gap**: 위 표 마지막 행 — JWT expiry 5분 미만 설정 시 race 가능성. **Task 0.5 (Supabase config 사전 검증)이 이 gap을 닫는 게이트.** 통과하지 못하면 plan 진행 불가.

---

## Worktree parallelization strategy

**Sequential implementation, no parallelization opportunity.** 모든 Task가 `sessionService.ts` + 직접 의존 파일을 순차로 수정. 분산 가능한 독립 워크스트림 없음.

순서:

```
Task 0.5 (Supabase config 검증) [GATE]
   ↓
Task 1 (제거/유지 분류) ─► Task 2 (sessionService 리팩토링)
                              ↓
                          Task 2.5 (loginAttemptService 분리)
                              ↓
                          Task 2.7 (deadlock fix)
                              ↓
                          Task 3 (호출부 정리)
                              ↓
                          Task 4 (테스트 재작성)
                              ↓
                          Task 5 (통합 검증)
```

---

## Completion Summary (Eng Review)

- **Step 0 (Scope Challenge):** scope 적정 — 5 files, 0 새 클래스, 8개 미만 임계 통과
- **Architecture Review:** 3 issues found, 3 resolved (파일 분리, autoRefresh 훅, 실패 시나리오 검증)
- **Code Quality Review:** 0 issues found (cleanup 방향, DRY/error handling positive)
- **Test Review:** coverage diagram 생성, 7 gaps identified, 5 신규 테스트로 폐쇄 (4 REGRESSION 포함)
- **Performance Review:** 0 issues found (순수 개선 — 50min 폴링 + 30min 타이머 제거)
- **Outside voice (Codex):** 3 추가 발견 (deadlock pattern, Supabase config 미검증, mock contract 과소평가) — 모두 plan에 반영
- **Cross-model tension:** Codex finding 3 검증 후 옵션 A 선택 — 함께 수정
- **Failure modes:** 1 critical gap → Task 0.5(Supabase config 검증) 게이트로 폐쇄
- **TODOS.md:** 1 item 추가 (`tokenRefreshService` rename)
- **Parallelization:** N/A — 순차 구현
- **Lake Score:** 5/5 권장 — 모두 complete option 선택 (B파일분리, A autoRefresh, A deadlock fix, A config+mock 명시, A TODO add)

---

## NOT in scope (명시적 제외, 별도 PR)

| 항목                                                      | 사유                                                       | 후속 PR 후보                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `tokenRefreshService.ts` 이름 변경 (FCM 전용임을 명확히)  | 별개 cleanup, 본 PR scope 밖                               | `chore(observability): tokenRefreshService → fcmTokenRefreshService rename` |
| `authStore.suppressedSessionUserId` 제거                  | auto-login 비활성화 경로 독립 사용 — 본 plan의 변경과 무관 | 분리 가능하면 별도 분석 PR                                                  |
| "모든 기기에서 로그아웃" UX                               | feature 추가, 보안 강화. 세션 유지 정책 확정 후 진행       | 신규 feature                                                                |
| Inactivity timeout을 admin 역할에만 선택 적용             | "다른 보안 프로파일 필요" 의견 수렴되면 검토               | 신규 design doc                                                             |
| `AuthErrorBoundary` 메시지 카피 변경                      | SDK SIGNED_OUT 시 여전히 적절 — 변경 불필요                | N/A                                                                         |
| Codex가 본 plan 외에서 발견한 다른 deadlock 패턴 (있다면) | 본 plan은 sessionService 한정                              | 별도 audit PR                                                               |

---

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status       | Findings                                                                       |
| ------------- | --------------------- | ------------------------------- | ---- | ------------ | ------------------------------------------------------------------------------ |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —            | —                                                                              |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 1    | issues_found | 3 발견 (deadlock pattern, JWT 설정 미검증, mock contract 과소평가) — 모두 반영 |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | CLEAR        | 3 issues, 1 critical gap (Task 0.5 게이트로 폐쇄)                              |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —            | UI scope 없음                                                                  |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | —            | Dev API 변경 없음                                                              |

**CODEX:** Codex가 3개 핵심 이슈 발견 — sessionService deadlock 패턴(공식 known bug 검증), Supabase 프로젝트 JWT 수명 미검증, useAppInitialize mock contract 과소평가. 전부 plan에 반영 완료.

**CROSS-MODEL:** Codex finding 3에서 cross-model tension — Claude review는 부트스트랩 가드 "유지" 권장, Codex는 callback deadlock pattern 즉시 수정 권장. 사용자가 광범위 검증 후 Codex 옵션 채택, Task 2.7로 추가.

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — 구현 진행 가능. 단, **Task 0.5 (Supabase config 검증)은 구현 전 게이트**. JWT expiry/refresh token 설정이 plan 전제와 다르면 사용자에게 confirm 후 진행.
