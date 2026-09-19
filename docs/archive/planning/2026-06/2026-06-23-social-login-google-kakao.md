# Google + Kakao 소셜로그인 구현 계획

> 작성일: 2026-06-23 | 범위: Google + Kakao (네이티브 iOS/Android + 웹) | Naver는 2단계 분리(이번 범위 제외)

## 1. 목표 & 범위

- **In scope**: Google·Kakao 소셜로그인을 네이티브(iOS/Android, EAS 빌드)와 웹(Cloudflare Pages) 양쪽에서 동작.
- **Out of scope (2단계)**: Naver — Supabase 빌트인 provider가 아니라 Edge Function 토큰 교환 커스텀 경로가 필요. 별도 PR.
- **변경 없음**: DB (`handle_new_user` 화이트리스트 + CHECK 제약에 이미 apple/google/kakao/naver 존재).

## 2. 이미 존재하는 것 (재사용 토대)

| 자산 | 위치 | 역할 |
|------|------|------|
| Apple 로그인 (완성) | `src/services/auth/socialLoginService.ts:177` | `signInWithIdToken` 패턴 + 프로필 생성/검증/재시도 로직 |
| 소셜 프로필 완성 | `socialLoginService.ts:598` `completeSocialProfile` | PortOne 본인인증 + 약관 → `phoneVerified` 채움 (provider 무관) |
| analytics provider 분기 | `socialLoginService.ts:641` | 이미 `apple|google|kakao` 처리 |
| Google/Kakao 스텁 | `socialLoginService.ts:669`, `:678` | 현재 "준비 중" throw → 실제 구현 대상 |
| 버튼 UI | `src/components/auth/SocialLoginButtons.tsx` | 현재 iOS Apple만. Google/Kakao + Android/웹 추가 대상 |
| 로그인 화면 배선 | `app/(auth)/login.tsx:179,277` | `handleAppleLogin`, `loadingProvider`, `SocialLoginButtons` |
| Supabase 클라 | `src/lib/supabase.ts` | 웹 `detectSessionInUrl:true`, 네이티브 AsyncStorage |
| 딥링크 설정 | `app.config.ts` | scheme `uniqn`, DOMAIN `uniqn.app`, iOS associatedDomains / Android https applinks |
| DB 트리거 | `supabase/migrations/...add_naver_to_handle_new_user.sql` | 4종 provider 자동 프로필 생성 |

## 3. 아키텍처 결정 — 통합 `signInWithOAuth` + `expo-web-browser` (권장)

**결론: Google·Kakao 둘 다, 네이티브·웹 둘 다 단일 경로(`supabase.auth.signInWithOAuth`)로 구현.**

- **네이티브**: `signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } })` → 반환 URL을 `WebBrowser.openAuthSessionAsync(url, redirectUri)`로 열기(iOS=ASWebAuthenticationSession / Android=Custom Tabs, **임베디드 웹뷰 아님** → Google `disallowed_useragent` 회피) → 콜백 URL에서 `exchangeCodeForSession`(PKCE).
- **웹**: `signInWithOAuth({ provider, options: { redirectTo } })` → 페이지 리다이렉트 → 복귀 시 `detectSessionInUrl:true`가 세션 자동 수립.
- **공통 후처리**: 세션 수립 후 기존 Apple 경로의 프로필 lookup/생성/검증 로직을 **공유 헬퍼로 추출**해 재사용 → `completeSocialProfile` 본인인증 체인으로 연결.

### 대안 (채택 안 함) — 네이티브 idToken SDK
Google `@react-native-google-signin`(네이티브 원탭) + Kakao 네이티브 SDK. UX는 더 매끄럽지만 ① 코드 경로가 provider×platform로 분기 폭증 ② 네이티브 config plugin/키 추가 ③ Kakao는 어차피 별도 처리. **DRY·explicit 원칙(골든 #3/#5) 위반**이라 1차에서는 통합 OAuth 채택. 추후 Google 원탭만 선택적 고도화 가능.

## 4. 구현 단계 (순서)

### Step 0. 의존성 추가
- `npx expo install expo-web-browser` (expo-linking·expo-crypto 이미 설치됨).
- `WebBrowser.maybeCompleteAuthSession()` 호출을 앱 진입부(또는 콜백 라우트)에 추가.

### Step 1. OAuth 코어 서비스 (신규 파일)
- `src/services/auth/oauthSignInService.ts` 신규.
  - `signInWithOAuthProvider(provider: 'google' | 'kakao'): Promise<AuthResult>`
  - 플랫폼 분기: web=리다이렉트 / native=`openAuthSessionAsync` + `exchangeCodeForSession`.
  - `redirectTo`: native=`Linking.createURL('auth/callback')`(→ `uniqn://auth/callback`), web=`${origin}/auth/callback`.
  - 취소·실패는 기존 `AuthError`/`BusinessError` + `ERROR_CODES`로 매핑(에러 메시지: 무엇+왜+어떻게).

### Step 2. Apple 프로필 로직 공유화 (리팩토링, 동작 동일)
- `socialLoginService.ts`의 신규/미완성 사용자 프로필 lookup·생성·검증·optimistic 분기를 `handlePostSocialAuth(user, provider, name)` 헬퍼로 추출.
- `signInWithApple`은 헬퍼 호출로 치환(순수 리팩토링, **Red-Green로 동치 보장**).
- `signInWithGoogle`/`signInWithKakao` 스텁(`:669`/`:678`)을 Step 1 코어 + 헬퍼 호출로 교체.

### Step 3. 콜백 라우트
- `app/(auth)/auth/callback.tsx`(또는 기존 라우팅에 통합) — native 딥링크/웹 리다이렉트 수신, 세션 확정 후 `completeSocialProfile` 필요 여부(신규=본인인증 화면, 기존=홈)로 분기. `authRedirect.ts` 재사용.

### Step 4. 버튼 UI 확장
- `SocialLoginButtons.tsx`: `onGoogleLogin`/`onKakaoLogin` props + Google/Kakao 버튼(브랜드 가이드 준수: Google 화이트+G로고, Kakao 옐로우 #FEE500). `Platform.OS!=='ios'` 早期 return 제거 → Android/웹에서도 Google/Kakao 노출(Apple은 iOS 한정 유지).
- `loadingProvider` 타입을 `'apple' | 'google' | 'kakao' | null`로 확장.

### Step 5. 로그인/가입 화면 배선
- `login.tsx`(+ `signup.tsx`): `handleGoogleLogin`/`handleKakaoLogin` 추가, `loadingProvider` state 확장, `SocialLoginButtons`에 핸들러 전달.

### Step 6. 본인인증 체인 연결
- 신규 Google/Kakao 사용자도 `completeSocialProfile`(`:598`)로 PortOne 본인인증 + 약관 동의 → `phoneVerified=true`. Apple과 동일 화면 재사용.

## 5. 외부 콘솔 설정 체크리스트 (⚠️ 사용자 직접 수행 — 코드로 불가)

- [ ] **Google Cloud Console**: OAuth 2.0 클라이언트 생성(Web). Authorized redirect URI에 Supabase 콜백 `https://<project-ref>.supabase.co/auth/v1/callback` 등록. Client ID/Secret 확보.
- [ ] **Kakao Developers**: 앱 생성 → 카카오 로그인 활성화 → Redirect URI에 Supabase 콜백 등록 → REST API 키(Client ID) + Client Secret(보안 사용 ON).
- [ ] **Supabase 대시보드** → Authentication → Providers: Google·Kakao 활성화 + 위 키 입력.
- [ ] **Supabase** → Authentication → URL Configuration → Redirect URLs 허용목록: `uniqn://auth/callback`, `https://uniqn.app/auth/callback`, `https://uniqn-app.pages.dev/auth/callback`(+ 개발용 localhost).
- [ ] (필요 시) 동의화면/브랜딩 심사 — Google OAuth consent screen, Kakao 비즈앱 전환(이메일 등 동의항목).

## 6. 테스트 계획

- **단위(jest)**: `oauthSignInService` 플랫폼 분기·에러 매핑 모킹 테스트. `handlePostSocialAuth` 추출 동치(Apple 기존 테스트 GREEN 유지). 버튼 렌더(플랫폼별 노출) 테스트.
- **Red-Green**: Step 2 리팩토링 — 추출 전후 Apple 테스트 동일 통과 확인.
- **수동 QA**: iOS/Android 실기기(EAS dev build) + 웹 3환경(localhost/pages.dev/uniqn.app)에서 Google·Kakao 신규/기존 로그인 + 본인인증 완료까지.
- **e2e**: 외부 OAuth는 결정적 테스트가 어려움 → 버튼 노출/네비게이션까지만 커버, 실제 OAuth는 수동.

## 7. 보안 / 검증 (프로젝트 규칙)

- PKCE flow(`exchangeCodeForSession`) 사용 — code interception 방어.
- 사용자 표시 이름 등 입력은 `sanitizeInput` + 길이 제한(Apple 경로 `:274` 패턴).
- 모든 실패는 `AppError`(E1~E7) 경유, 민감정보 미노출.
- `WebBrowser.openAuthSessionAsync` 사용(임베디드 웹뷰 금지) — Google 정책 + 자격증명 탈취 방지.
- 부분 인증 상태는 Apple 경로처럼 `signOut`으로 정리.

## 8. 리스크 / 오픈 이슈

- **Kakao + signInWithIdToken 미지원**: Kakao는 `signInWithOAuth`(웹 플로우) 경로로 통일(idToken 직접 검증 불가 전제). 검증 필요.
- **웹 콜백 라우팅**: Expo Router에서 `/auth/callback` 정적 빌드 노출 + SPA fallback(`_redirects`) 충돌 주의([[pitfall_splashscreen_tabs_index_url_collision]] 교훈).
- **딥링크 복귀**: Android autoVerify applinks와 커스텀 scheme(`uniqn://`) 혼용 시 콜백 수신 확인 필요.
- **Apple 심사**: 서드파티 로그인 제공 시 Sign in with Apple 필수 — 이미 충족.

## 9. 롤아웃

- 코드 머지 후 **웹(Cloudflare 재배포) + 모바일(EAS OTA 또는 신규 빌드)** 양쪽 배포 필요(딥링크/네이티브 설정 변경 시 OTA 불가 → 신규 빌드).
- 외부 콘솔 설정이 prod에 반영되어야 실제 동작.

## 10. 파일 변경 요약

| 파일 | 변경 |
|------|------|
| `package.json` | +expo-web-browser |
| `src/services/auth/oauthSignInService.ts` | 신규 — OAuth 코어 |
| `src/services/auth/socialLoginService.ts` | `handlePostSocialAuth` 추출 + Google/Kakao 스텁 교체 |
| `src/services/auth/index.ts` | export 추가 |
| `app/(auth)/auth/callback.tsx` | 신규 — 콜백 라우트 |
| `src/components/auth/SocialLoginButtons.tsx` | Google/Kakao 버튼 + 플랫폼 노출 |
| `app/(auth)/login.tsx`, `signup.tsx` | 핸들러 + loadingProvider 확장 |
| `app.config.ts` | (필요 시) 콜백 경로/scheme 확인 |
| 테스트 | oauthSignInService, 버튼, 동치 테스트 |

---

# autoplan 리뷰 (2026-06-23)

> Codex는 이 ChatGPT 계정에서 모델 미지원 → **subagent-only(단일 voice)** 로 진행. CEO → Design → Eng.

## Phase 1 — CEO/전략 리뷰 (independent Claude voice)

**판정: ADJUST SCOPE (프레이밍 재고 권고)**

| # | 심각도 | 발견 | 전략적 수정 |
|---|--------|------|-------------|
| C1 | CRITICAL | **본인인증 벽이 진짜 병목** — 소셜로그인 후 `authRedirect.ts:104-111`가 phoneVerified!==true면 PortOne 본인인증(~60-120s, 높은 이탈)으로 강제 라우팅. 로그인 버튼은 ~2s짜리 쉬운 단계만 줄이고 90% 비용(본인인증)은 그대로. | 본인인증이 법적 필수인지(19+/머니) 먼저 확정. 선택이면 **본인인증을 지원/정산 시점으로 지연** → 소셜로그인이 곧장 앱 탐색으로. 필수면 "마찰감소"가 아닌 "신뢰/친숙도"로 목표 재프레이밍. |
| C2 | CRITICAL | **계정 연결(account-linking) 전략 부재** — 같은 사람이 Apple→Google→Kakao 시 Supabase는 이메일 자동연결 안 함 → 중복 auth user → 중복 `public.users` → 지원이력/정산 분리. orphan-lockout 클래스 재발. | 출시 전 연결정책 확정(검증이메일 연결 vs "이미 X로 가입" 차단). **launch blocker, phase 2 아님**. |
| C3 | HIGH | **provider 우선순위가 Supabase 편의로 결정됨** — Google=빌트인이라 선택, Naver=Edge Function이라 후순위. 한국 audience(홀덤펍 40-50대+알바)는 Kakao >> Naver ≈ Google. Google은 <5% 가능성 + consent 심사 유지부담. | **Kakao 단독 선행** → 채택률 계측 → 2번째 provider는 데이터로(아마 Naver). |
| C4 | HIGH | **"통합 OAuth/DRY" 논거 자기모순** — Naver는 어차피 다른 아키(Edge Function)라 DRY 부분승. Kakao 네이티브 SDK 거부 = KakaoTalk 앱핸드오프(간편로그인) 포기 → 최대 볼륨 provider에서 전환율 손해. | Kakao(웻지)는 코드정돈이 아닌 **전환율 기준**으로 네이티브 앱핸드오프 평가. |
| C5 | HIGH | **per-provider 플래그/퍼널 계측 부재** — Apple은 kill switch 있음(`login.tsx:222`). 신규 2 prod auth 경로에 개별 플래그·이탈계측 없음. | (a) 본인인증 단계 이탈 계측 먼저(1주 데이터가 계획 무효화 가능). (b) Kakao/Google 개별 플래그. |
| C6 | MEDIUM | **외부콘솔 항목이 일정 리스크인데 체크박스로 위장** — Kakao email scope는 **비즈앱 심사 필수**(프로필이 user.email 소비). Google consent 심사 수주+갬블링 인접 가중. | dated·owner 의존성으로 승격 + email 거부 시 fallback(email=''). |
| C7 | MEDIUM | **"DB 변경 없음"이 취약 트리거에 대한 미검증 가정** — 2026-05-16 `handle_new_user`가 social_provider 떨군 사건 이력. 실트래픽이 더 강타. | Google/Kakao identity의 provider 값 매핑이 트리거에서 올바른지 **테스트 항목으로** 검증. |
| C8 | MEDIUM | **handlePostSocialAuth 추출 난이도 과소평가** — Apple 경로에 MMKV 이름캐시(`:247-265`)·apple 하드코딩 breadcrumb·고유 retry/optimistic(`:450-527`). | provider-무관 헬퍼는 실제 설계작업. "동치"를 free pass로 쓰지 말 것. |
