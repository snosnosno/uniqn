# 웹 Apple OAuth 로그인 — 설계 (2026-07-21)

> 문제: 모바일에서 Apple 로그인으로 가입한 사용자가 **웹에서 로그인할 방법이 0%**다.
> 결정: 웹 전용 Apple OAuth(`signInWithOAuth`) 경로 신설. 1차 범위는 **기존 계정 로그인 전용**.

## 근거 (실측)

| # | 사실 | 증거 |
|---|---|---|
| 1 | 웹에서 Apple 섹션 미렌더 | `app/(auth)/login.tsx:219-222` `shouldRenderAppleSection = Platform.OS === 'ios' && …` |
| 2 | 소셜 버튼 자체가 iOS 가드 | `src/components/auth/SocialLoginButtons.tsx:22` `if (Platform.OS !== 'ios') return null` |
| 3 | 웹 OAuth 경로 미구현 | 레포 전체 `signInWithOAuth` **0건**, `signInWithOtp`/`verifyOtp` **0건**. 소셜은 `signInWithIdToken`(네이티브) 뿐 (`socialLoginService.ts:280`) |
| 4 | 해당 사용자는 비밀번호 없음 | prod `auth.users`: apple identity 1명(`cf740613-…`, 2026-07-20 가입), `encrypted_password` NULL, email `…@privaterelay.appleid.com`, `phone_confirmed_at` NULL |
| 5 | 재설정 우회로도 죽음 | `authCoreService.ts:444` `resetPasswordForEmail` — SMTP 전량 실패 상태 |
| 6 | `expo-apple-authentication`은 웹 미지원 | `node_modules/expo-apple-authentication`에 `.web.*` 파일 **0건**, package.json에 `browser`/`exports` 엔트리 없음 (`main: build/index.js` 단일) |
| 7 | 웹 세션 수신 준비는 이미 됨 | `src/lib/supabase.ts:23` `detectSessionInUrl: Platform.OS === 'web'` 이미 true, `persistSession: true` |
| 8 | SPA fallback 존재 | `public/_redirects` `/*  /index.html  200` → 임의 경로를 expo-router가 처리 가능 |

⚠️ `public/_redirects`에 **확장자 없는 경로용 rewrite 규칙 추가 금지** — CF clean-URL과 충돌해 308 무한루프(파일 내 실측 경고).

## 범위 결정 — 옵션 A (권장)

현행 `signInWithApple()`은 Apple 인증 → `signInWithIdToken` → 프로필 조회/생성 → PortOne 본인인증 → analytics를 한 흐름에 묶는다. 웹 `signInWithOAuth`는 `auth.users`/`auth.identities`만 만들고 `public.users` 프로필은 건드리지 않는다. → **웹 최초 로그인 Apple 사용자는 인증은 됐는데 앱 프로필이 없는 상태**가 될 수 있다.

- **옵션 A (채택)**: 기존 계정 로그인 전용. 콜백에서 프로필 조회 → 없거나 `phoneVerified !== true`면 **즉시 signOut + 앱 가입 안내** 후 `/login` 복귀. 네이티브 코드 무변경 → 회귀 위험 최소.
- **옵션 B (범위 밖)**: 웹 신규가입 허용 — PortOne 웹 SDK·약관 동의·프로필 설정 화면 신규 구축이 필요한 별도 대형 과제.

## Guardrails

**Must Have**
- 웹에서 기존(모바일 가입 완료) Apple 계정 로그인 가능
- 프로필 없는/미완성 사용자는 안전하게 signOut + 앱 안내 — **유령 세션 금지**
- 네이티브 iOS Apple 로그인 **무회귀** (`appleAuthService.ts`·`socialLoginService.ts`·`SocialLoginButtons.tsx` 미변경)
- `app_config` 원격 플래그로 웹 버튼만 즉시 OFF 가능
- Apple client secret(.p8)은 Supabase Dashboard에만 — 레포 미노출

**Must NOT Have**
- 웹 신규가입/온보딩(PortOne·약관·프로필 설정)
- Google/카카오 웹 확장
- DB 스키마 변경·신규 마이그레이션 (`app_config`에 행 1건 추가는 데이터 삽입이며 스키마 변경 아님)
- `*.pages.dev` 프리뷰 도메인 지원 (1차는 `uniqn.app` 전용)
- `supabase/config.toml` 변경 (로컬 CI 스택 전용, prod Apple provider와 무관)

## 파일 계획

**신규**

| 경로 | 책임 |
|---|---|
| `src/services/auth/webAppleAuthService.ts` | `getWebAppleLoginAvailability()`, `signInWithAppleWeb(redirect?)` — 네이티브 SDK 의존 없음 |
| `src/services/auth/__tests__/webAppleAuthService.test.ts` | 단위 테스트 |
| `app/(auth)/callback.tsx` | OAuth 콜백 — 세션 확보 후 프로필 분기 |
| `app/(auth)/__tests__/callback.test.tsx` | 콜백 테스트 |
| `src/components/auth/AppleWebSignInButton.tsx` | 웹 전용 버튼(순수 Pressable) |
| `src/components/auth/__tests__/AppleWebSignInButton.test.tsx` | 버튼 테스트 |
| `src/domains/webAppleLogin/webAppleLoginFlag.ts` (+`index.ts`) | 원격 플래그 zod 파서 (`weeklyGridFlag.ts` 패턴) |
| `src/hooks/useWebAppleLoginEnabled.ts` | 플래그 훅 |

**수정**

| 경로 | 변경 |
|---|---|
| `src/services/appConfigService.ts` | `getWebAppleLoginFlagRaw()` 추가 (`getWeeklyGridFlagRaw:24`·`getOpsHubFlagRaw:57` 동일 패턴) |
| `src/lib/queryClient.ts` | `queryKeys.appConfig.webAppleLoginEnabled()` |
| `src/config/featureFlags.ts` | `web_apple_login_enabled: false` 빌드타임 fallback |
| `app/(auth)/login.tsx` | `Platform.OS === 'web'` 분기 → 버튼 렌더 + `signInWithAppleWeb()` |
| `app/(auth)/_layout.tsx` | `<Stack.Screen name="callback" />` 등록 |
| `src/services/auth/index.ts` | 배럴 export |

### 설계 편차 2건 (요청안 대비)

1. **`SocialLoginButtons`/`appleAuthService` 가드 완화 대신 웹 전용 파일 신설** — 근거 #6. 두 파일 모두 `expo-apple-authentication`을 직접 import하며 웹 구현이 존재하지 않아, 가드만 풀면 웹에서 크래시 위험. 별도 파일로 분리해 네이티브 회귀 위험을 0에 가깝게 유지.
2. **롤백을 빌드타임 env var가 아닌 `app_config` 원격 플래그로** — 네이티브 Apple은 `EXPO_PUBLIC_ENABLE_APPLE_LOGIN`(빌드타임)이지만, 웹은 값 변경 시 CF Pages 재빌드가 필요하다. 이미 검증된 `weekly_grid_enabled`/`ops_hub_enabled` 패턴을 쓰면 Studio에서 값 1건만 바꿔 **재배포 없이 즉시 롤백**된다.

## 구현 단계

### Phase 1 — 사람 선행 게이트 (블로킹, 코드 없음)
아래 "사용자 선행 작업" 절 수행. 완료 전에는 Phase 6 QA 불가.
- 완료 기준: Supabase Dashboard Apple Provider의 Client IDs 목록에서 **Services ID가 첫 번째**임을 육안 확인
- Risk: **High** — 콘솔 설정 실수는 조용한 실패로 이어짐

### Phase 2 — 원격 플래그 배선
`weeklyGridFlag.ts` / `getWeeklyGridFlagRaw` / `useWeeklyGridEnabled` 3종 패턴을 `web_apple_login_enabled` 키로 복제.
- 완료 기준: 원격 값 우선, 로딩/에러/행 부재 시 fallback `false`로 수렴하는 유닛 테스트 통과
- Risk: Low

### Phase 3 — 웹 인증 서비스 (TDD)
- RED: `getWebAppleLoginAvailability()` — `Platform.OS!=='web'` → `{enabled:false, reason:'not_web'}`, 플래그 OFF → `'disabled_by_flag'`, 웹+ON → `{enabled:true}`
- RED: `signInWithAppleWeb(redirectPath?)` — `signInWithOAuth({provider:'apple', options:{redirectTo: …'/callback'}})` 호출 검증 / availability false면 호출 없이 `BusinessError` / supabase `{error}` → `AuthError(AUTH_INVALID_CREDENTIALS)` 래핑
- Platform.OS 모킹은 `socialLoginService.test.ts` 기존 방식 준수
- 완료 기준: `npm test -- webAppleAuthService` 전부 PASS
- Risk: Medium

### Phase 4 — 콜백 라우트 (TDD)
- RED: 세션 O + 프로필 `phoneVerified:true, isActive:true` → `setUser`/`setProfile` + `getResolvedAuthenticatedRoute` 결과로 `router.replace`
- RED: 세션 O + 프로필 `null` 또는 `phoneVerified:false` → `signOut()` + 앱 가입 안내 + `/login`
- RED: 프로필 `isActive:false` → 비활성 안내 후 signOut
- RED: 세션 X(취소) → 에러 토스트 + `/login`, signOut 미호출
- 완료 기준: `npm test -- callback` PASS + `_layout.tsx` 등록 반영
- Risk: **Medium-High** — 신규가입 오탐지로 기존 사용자를 잘못 차단하면 영향 큼. null/false 판정을 테스트로 촘촘히 덮을 것

### Phase 5 — 로그인 화면 통합 (TDD)
- RED: `Platform.OS==='web' && enabled` 일 때만 버튼 렌더, press → `onPress`
- RED: 웹에서 기존 `SocialLoginButtons`(iOS 전용)는 렌더되지 않음 + 기존 iOS 케이스 그대로 통과(무회귀 고정)
- 완료 기준: `npm test -- AppleWebSignInButton login SocialLoginButtons socialLoginService` 전부 PASS
- Risk: Low

### Phase 6 — 통합 검증 + 계정 연결 QA
`npm run quality` + 전체 스위트 + 아래 계정 연결 실측. 플래그 ON→QA→OFF 리허설 1회.
- Risk: **High** — 실 Apple 계정·prod 대상. 트래픽 적은 시간대 권장

## 사용자 선행 작업 (코드보다 먼저)

### Apple Developer 콘솔
1. 기존 네이티브 App ID에 Sign in with Apple capability 활성 확인
2. **Services ID 신규 생성** (Identifiers → Services IDs → +)
   - Sign In with Apple 체크 → **Configure**
   - 🚨 **Primary App ID를 기존 네이티브 App ID로 그룹핑(App Grouping)** — 빠뜨리면 웹/네이티브가 **서로 다른 Apple `sub`**를 받아 동일 사용자가 **중복 계정**으로 생성될 수 있음 (Apple 플랫폼 요구사항, Supabase 무관)
   - Domains: `uniqn.app`
   - Return URLs: `https://ygfxukhktpqymahfrvbz.supabase.co/auth/v1/callback` (자사 도메인 아님 — Supabase 콜백)
   - 도메인 소유권 검증 파일 요구 시 콘솔이 제시하는 값 그대로 배치 (`public/_redirects`에 `/.well-known/*` 패스스루 이미 존재 → 충돌 없음)
3. **Key 생성** (Keys → + → Sign in with Apple → 위 Primary App ID 연결) → `.p8` 다운로드 (**1회만 가능**, 안전 백업)
4. Team ID / Key ID / Services ID 기록

### Supabase Dashboard (prod `ygfxukhktpqymahfrvbz`)
5. Authentication → Providers → Apple
6. 🚨 **Client IDs 필드에 Services ID를 첫 번째 항목으로** — 웹 `signInWithOAuth`는 **첫 번째** client ID를 쓰고, 네이티브 `signInWithIdToken`은 순서 무관하게 목록 전체를 audience로 허용. 네이티브 App ID가 앞에 오면 **네이티브는 계속 되는데 웹만 Apple에서 거부**되는 조용한 실패 모드
7. Secret Key: Team ID + Key ID + `.p8`로 생성. ⏰ **6개월 만료** — 로테이션 알림 등록 필수(놓치면 웹 로그인 전면 장애)
8. URL Configuration → Redirect URLs에 `https://uniqn.app/callback` 추가
9. `.p8`/시크릿 레포 커밋 절대 금지

## 계정 연결 리스크 & 검증 절차

**리스크**: 웹 Services ID 경유 로그인이 네이티브 App ID 경유와 다른 Apple `sub`를 받으면, 기존 사용자(`cf740613-fd24-4d8c-97f4-ff8b1b4af380`)가 웹 로그인 시 **새 `auth.users` 행**을 만들어버린다. 문서로 단정 불가 — 실측 필요. 핵심 변수는 위 2번 App Grouping.

Supabase Studio SQL 에디터에서 사람이 직접 실행:

```sql
-- 1. 사전 기준선
select count(*) from auth.users;
select id, provider, provider_id, email, last_sign_in_at
from auth.identities
where user_id = 'cf740613-fd24-4d8c-97f4-ff8b1b4af380';
```

2. QA: 플래그 임시 ON → `uniqn.app`에서 **동일 Apple ID**로 "Apple로 로그인"

```sql
-- 3. 사후 확인
select count(*) from auth.users;  -- 사전과 동일해야 함(신규 행 없음)
select id, provider, provider_id, email, last_sign_in_at
from auth.identities
where user_id = 'cf740613-fd24-4d8c-97f4-ff8b1b4af380'
order by created_at;  -- 기존 apple identity의 last_sign_in_at만 갱신, 새 provider_id 행 없어야 함
```

4. `public.users` 프로필 행 수 동일 확인
5. 웹 로그인 성공 후 메인 탭으로 라우팅되는지(이미 `phoneVerified:true`이므로 차단 로직 미진입) 확인
6. 새 행/새 `provider_id` 관측 시 → **App Grouping 오류로 판정, 플래그 즉시 OFF**, Primary App ID 재확인 후 재검증

## 롤백

- `app_config.web_apple_login_enabled` → `false` (Studio UPDATE 1건, 재배포 불필요) → 버튼 즉시 미노출
- 원격 조회 실패/로딩 시에도 빌드타임 fallback `false`로 안전 측 수렴 — **fail-open 없음**
- 롤백은 버튼 노출만 제어(`ops_hub_enabled` 관례 동일). 콜백 라우트 자체 차단은 Phase 4에서 추가 방어선 필요 여부 재검토

## 완료 정의 (Exit Proof)

- [ ] `cd uniqn-mobile && npm run quality` → 0 errors (출력 첨부)
- [ ] `npm test -- webAppleAuthService callback AppleWebSignInButton login SocialLoginButtons socialLoginService` → 신규 PASS + 기존 무회귀 (pass/fail 카운트 첨부)
- [ ] Supabase Apple Provider 설정 — Client IDs 첫 번째 = Services ID 육안 확인
- [ ] 계정 연결 검증 1~5단계 SQL 출력 — `auth.users`/`auth.identities`/`public.users` 신규 행 **0**
- [ ] `web_apple_login_enabled=false` 롤백 리허설 — 재배포 없이 버튼 사라짐 확인
- [ ] 6개월 client secret 로테이션 알림 등록됨

## 미해결 질문

1. Apple Services ID 식별자 네이밍 (팀 컨벤션)
2. 웹 신규가입 차단 안내 카피 확정 — 초안: "모바일 앱에서 먼저 가입을 완료해주셔야 웹에서 로그인할 수 있어요" (impeccable 룰10 무엇+왜+어떻게)
3. `.p8` 로테이션 담당자 및 알림 채널
4. `*.pages.dev` 프리뷰 도메인 지원 필요 여부 (1차 제외 권장)
5. 옵션 B(웹 신규가입) 로드맵 편입 여부
