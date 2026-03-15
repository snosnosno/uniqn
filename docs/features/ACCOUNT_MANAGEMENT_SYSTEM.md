# 계정 관리 시스템

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 모바일앱 기준

이 문서는 `uniqn-mobile/`과 `functions/`에 실제 존재하는 계정 관리 기능만 정리합니다. 과거 `app2/`의 페이지 구조와 라우팅 설명은 현재 기준이 아닙니다.

## 기준 파일

앱:

- `uniqn-mobile/app/(auth)/login.tsx`
- `uniqn-mobile/app/(auth)/signup.tsx`
- `uniqn-mobile/app/(app)/settings/index.tsx`
- `uniqn-mobile/app/(app)/settings/change-password.tsx`
- `uniqn-mobile/app/(app)/settings/delete-account.tsx`
- `uniqn-mobile/app/(app)/settings/my-data.tsx`
- `uniqn-mobile/app/(app)/settings/terms.tsx`
- `uniqn-mobile/app/(app)/settings/privacy.tsx`
- `uniqn-mobile/src/services/auth/`

백엔드:

- `functions/src/index.ts`
- `functions/src/auth/verifyAndSaveProfile.ts`
- `functions/src/account/scheduledDeletion.ts`
- `functions/src/account/loginNotification.ts`

## 현재 제공 기능

### 회원가입

- 약관 동의
- 계정 정보 입력
- 본인인증
- 가입 완료 후 앱 메인 이동

회원가입 화면은 `uniqn-mobile/app/(auth)/signup.tsx`입니다.

### 로그인

- 이메일/비밀번호 로그인
- 소셜 로그인
- 자동 로그인
- 생체 인증 로그인

관련 구현:

- `uniqn-mobile/app/(auth)/login.tsx`
- `uniqn-mobile/src/services/auth/authCoreService.ts`
- `uniqn-mobile/src/services/auth/socialLoginService.ts`
- `uniqn-mobile/src/services/auth/biometricService.ts`

### 약관 및 개인정보 동의

- 회원가입 시 필수 동의: 이용약관, 개인정보처리방침
- 선택 동의: 마케팅 수신
- 백엔드 저장: `functions/src/index.ts`, `functions/src/auth/verifyAndSaveProfile.ts`
- 앱 내 조회 경로:
  - `/(app)/settings/terms`
  - `/(app)/settings/privacy`
  - `/(app)/settings/my-data`

### 비밀번호 변경

- 경로: `uniqn-mobile/app/(app)/settings/change-password.tsx`
- 설정 화면에서 진입합니다.

### 마이데이터 조회

- 경로: `uniqn-mobile/app/(app)/settings/my-data.tsx`
- 현재 사용자 기본 정보와 약관 동의 상태를 표시합니다.

### 마케팅 동의 변경

- 경로: `uniqn-mobile/app/(app)/settings/index.tsx`
- `updateMarketingConsent`를 통해 동의 상태를 갱신합니다.

### 계정 삭제

- 경로: `uniqn-mobile/app/(app)/settings/delete-account.tsx`
- 30일 유예 삭제 흐름을 사용합니다.
- 백엔드 정리 작업은 `functions/src/account/scheduledDeletion.ts`가 담당합니다.

### 로그인 알림

- 서버 구현: `functions/src/account/loginNotification.ts`
- 새 로그인 기록과 알림 저장 흐름을 처리합니다.

## 현재 설정 화면 기준 계정 관련 항목

`uniqn-mobile/app/(app)/settings/index.tsx` 기준:

- 비밀번호 변경
- 자동 로그인
- 생체 인증
- 마케팅 정보 수신
- 이용약관
- 개인정보처리방침
- 사업자정보
- 계정 삭제

## 데이터 모델 메모

- 사용자 스키마는 `language: 'ko' | 'en'` 필드를 허용합니다.
- 약관 동의 및 마케팅 동의는 사용자 정보와 하위 컬렉션 문맥에서 함께 다뤄집니다.
- 삭제 요청은 `scheduledDeletionAt` 기준으로 처리됩니다.

## 문서 작성 원칙

다음 내용은 현재 문서에 다시 넣지 않습니다.

- 과거 웹앱 파일 구조
- 레거시 라우팅 추가 절차
- 웹 전용 번역 리소스 예시
- 현재 코드에 없는 과거 설정 UI 설명
