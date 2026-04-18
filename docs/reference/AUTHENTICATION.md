# 인증 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/src/services/auth/`, `uniqn-mobile/src/stores/authStore.ts`, `uniqn-mobile/src/lib/supabase.ts`, `uniqn-mobile/supabase/functions/`

## 현재 인증 구조

- 백엔드: Supabase Auth (Email/Password, Apple Sign-In, Phone SMS OTP)
- Supabase 클라이언트: `uniqn-mobile/src/lib/supabase.ts`
- 인증 상태 저장: `uniqn-mobile/src/stores/authStore.ts`
- 편의 훅: `uniqn-mobile/src/hooks/useAuth.ts`
- 인증 서비스: `uniqn-mobile/src/services/auth/` (authCoreService, appleAuthService, socialLoginService, profileService, portOneIdentityService, biometricService)
- 서버측 본인인증/프로필 검증/저장: Edge Function `verify-and-save-portone-profile`

앱 인증 상태는 store 기반으로 관리하며, Supabase Auth의 onAuthStateChange로 세션을 추적합니다. 앱 역할(`admin`/`employer`/`staff`)은 `auth.users.raw_app_meta_data.role`에 저장되며 JWT를 통해 클라이언트와 RLS 정책에 전달됩니다.

## 현재 사용자 흐름

### 로그인

- 화면: `uniqn-mobile/app/(auth)/login.tsx`
- 이메일/비밀번호 로그인: `login()`
- Apple 로그인: `signInWithApple()`
- 자동 로그인 토글: `useAutoLogin()`
- 생체 인증 로그인: `useBiometricAuth()`

현재 로그인 화면은 Apple 로그인만 노출합니다. `signInWithGoogle`, `signInWithKakao` 서비스는 존재하지만 현재 store-facing 로그인 화면 기준 주 경로가 아닙니다.

### 회원가입

- 화면: `uniqn-mobile/app/(auth)/signup.tsx`
- 폼: `uniqn-mobile/src/components/auth/signup/SignupForm.tsx`
- 구조: 약관 -> 계정 정보 -> 본인확인(PortOne CI/DI) -> Supabase Auth 사용자 생성 -> 프로필 저장

### 비밀번호 재설정

- 화면: `uniqn-mobile/app/(auth)/forgot-password.tsx`
- 서비스: Supabase `auth.resetPasswordForEmail()` 래퍼

## 본인 인증 (PortOne)

- 서비스: `uniqn-mobile/src/services/auth/portOneIdentityService.ts`
- 토큰 검증 Edge Function: `verify-portone-identity`
- 검증+프로필 저장 Edge Function: `verify-and-save-portone-profile`
- 전화번호 SMS 인증은 Supabase Auth Phone(Twilio 프로바이더)을 사용하거나, PortOne 통합 본인인증 흐름으로 대체합니다.

PortOne 기반 본인인증은 CI/DI 값을 포함한 결과를 Edge Function에서 검증한 뒤 `public.users`에 저장합니다. 중복 가입/명의도용 차단 용도로 사용됩니다.

현재 문서 기준은 서버 검증 포함 본인확인 흐름입니다. 과거 웹 예제나 별도 추가 인증 전용 문서를 현재 구조처럼 설명하지 않습니다.

## 상태 저장과 역할 계산

- `authStore`가 인증 상태, 프로필, hydrate 상태를 유지합니다.
- 역할 플래그 계산은 `RoleResolver`가 단일 소스입니다.
- `useAuth()`는 store 값을 래핑해 제공합니다.

현재 권한 역할:

- `admin`
- `employer`
- `staff`

## 자동 로그인 / 생체 인증

- 자동 로그인 설정: `useAutoLogin`
- 생체 인증 설정 및 자격 증명 관리: `useBiometricAuth`, `biometricService`
- 설정 화면: `uniqn-mobile/app/(app)/settings/index.tsx`

생체 인증은 자동 로그인 활성화 상태와 실제 기기 가용성에 따라 동작합니다.

## 현재 서버 공개 엔트리

인증 관련 Edge Functions:

| 이름 | 타입 | 설명 |
|---|---|---|
| `verify-portone-identity` | Edge Function | PortOne 본인인증 토큰 검증 |
| `verify-and-save-portone-profile` | Edge Function | 본인인증 기반 프로필 검증 및 저장 |
| `revoke-apple-token` | Edge Function | Apple Sign-In 토큰 폐기 |

이메일/닉네임/전화번호 중복 확인은 PostgreSQL RPC 또는 Repository 쿼리로 처리합니다 (`UserRepository`).

Supabase Auth 빌트인 엔트리는 SDK를 통해 호출합니다:

- `supabase.auth.signInWithPassword()` — 이메일/비밀번호 로그인
- `supabase.auth.signUp()` — 이메일 회원가입
- `supabase.auth.signInWithIdToken({ provider: 'apple' })` — Apple Sign-In
- `supabase.auth.signInWithOtp()` / `supabase.auth.verifyOtp()` — Phone SMS OTP (Twilio 프로바이더)
- `supabase.auth.resetPasswordForEmail()` — 비밀번호 재설정 메일
- `supabase.auth.signOut()` — 로그아웃
- `supabase.auth.onAuthStateChange()` — 세션 변경 구독

## 운영 문서 범위 밖

아래 내용은 현재 기준이 아닙니다.

- 예전 context 기반 설명
- 현재 로그인 화면에 없는 소셜 로그인 노출 설명
- 별도 추가 인증 제품 문서
- 과거 웹 포털 인증 라우트
- Firebase Auth / Firebase Functions 기반 레거시 인증 흐름 (2026-04-11 이관 완료)
