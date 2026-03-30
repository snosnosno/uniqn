# 인증 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/src/services/auth/`, `uniqn-mobile/src/stores/authStore.ts`, `functions/src/api/auth.ts`

## 현재 인증 구조

- 인증 상태 저장: `uniqn-mobile/src/stores/authStore.ts`
- 편의 훅: `uniqn-mobile/src/hooks/useAuth.ts`
- 인증 서비스: `uniqn-mobile/src/services/auth/`
- 서버측 프로필 검증/저장: `verifyAndSaveProfile`

앱 인증 상태는 store 기반으로 관리합니다.

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
- 구조: 약관 -> 계정 정보 -> 본인확인(전화번호 OTP) -> 프로필 저장

### 비밀번호 재설정

- 화면: `uniqn-mobile/app/(auth)/forgot-password.tsx`
- 서비스: `resetPassword()`

## 전화번호 검증

- OTP 요청: `uniqn-mobile/src/hooks/auth/usePhoneSMS.ts`
- OTP 확인: `uniqn-mobile/src/hooks/auth/useOTPVerification.ts`
- 전화번호 중복 확인: `checkPhoneExists`
- 서버 검증/프로필 반영: `verifyAndSaveProfile`
- reCAPTCHA 검증 유틸: `functions/src/utils/recaptcha.ts`

현재 문서 기준은 서버 검증 포함 전화번호 인증 흐름입니다. 과거 웹 예제나 별도 추가 인증 전용 문서를 현재 구조처럼 설명하지 않습니다.

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

| 함수명 | 설명 |
|---|---|
| `checkEmailExists` | 이메일 중복 확인 |
| `checkNicknameExists` | 닉네임 중복 확인 |
| `checkPhoneExists` | 전화번호 중복 확인 |
| `verifyAndSaveProfile` | 프로필 검증 및 저장 |
| `revokeAppleToken` | Apple 토큰 폐기 |

## 운영 문서 범위 밖

아래 내용은 현재 기준이 아닙니다.

- 예전 context 기반 설명
- 현재 로그인 화면에 없는 소셜 로그인 노출 설명
- 별도 추가 인증 제품 문서
- 과거 웹 포털 인증 라우트
