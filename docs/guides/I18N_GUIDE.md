# 국제화 가이드

**최종 업데이트**: 2026년 3월 14일
**상태**: 현재 코드 기준

현재 `uniqn-mobile/`에는 전역 런타임 번역 시스템이 들어 있지 않습니다. 따라서 예전 웹앱 기준의 번역 리소스 파일 및 훅 중심 문서는 현재 코드와 맞지 않습니다.

## 현재 상태

- 앱 UI는 한국어 텍스트를 기본으로 사용합니다.
- 일부 데이터 모델은 언어 필드를 보유합니다.
  - 예: `uniqn-mobile/src/schemas/user.schema.ts`의 `language: 'ko' | 'en'`
- 날짜 포맷은 여러 화면에서 `date-fns/locale`의 `ko` 로케일을 사용합니다.
- 약관/개인정보처리방침 텍스트는 현재 앱 내부 컴포넌트와 화면 파일에 직접 포함되어 있습니다.

## 기준 파일

- `uniqn-mobile/src/schemas/user.schema.ts`
- `uniqn-mobile/app/(app)/settings/index.tsx`
- `uniqn-mobile/app/(app)/settings/terms.tsx`
- `uniqn-mobile/app/(app)/settings/privacy.tsx`
- `uniqn-mobile/src/components/auth/signup/termsContent.ts`
- `uniqn-mobile/src/utils/date/formatting.ts`
- `uniqn-mobile/src/components/schedule/CalendarView.tsx`

## 현재 문서화 가능한 범위

### 1. 언어 필드

- 사용자 스키마는 `ko`, `en` 값을 받을 수 있습니다.
- 다만 현재 설정 화면에는 전체 앱 언어 전환 UI가 없습니다.

### 2. 날짜/달력 로케일

- 일정, 공지, 문의, 신고 등에서 `date-fns/locale/ko`를 사용합니다.
- 캘린더도 한국어 월/요일 기준으로 표시됩니다.

### 3. 약관/정책 텍스트

- 회원가입 및 설정 화면에서 이용약관/개인정보처리방침을 직접 표시합니다.
- 별도 웹 번역 파일을 불러오는 구조가 아닙니다.

## 새 i18n 작업을 시작할 때 기준

현재 코드에 국제화 기능을 확장하려면 먼저 아래를 결정해야 합니다.

1. 번역 저장 방식
   - 코드 상수
   - JSON 리소스
   - 원격 설정
2. 런타임 라이브러리 도입 여부
   - 별도 번역 라이브러리를 도입할지
   - Expo/React Native 친화적인 다른 방식을 쓸지
3. 사용자 설정 저장 위치
   - Firestore 프로필
   - 로컬 저장소
   - 둘 다
4. 기본 언어 전환 범위
   - 전체 UI
   - 약관/정책만
   - 일부 핵심 화면만

## 금지할 문서 표현

현재 코드가 바뀌기 전까지 아래 표현은 쓰지 않습니다.

- "모바일앱에 전역 번역 런타임이 이미 붙어 있다"
- "웹 번역 리소스 파일이 현재 번역 소스다"
- "번역 훅이 기본 패턴이다"
- "설정 화면에서 전체 언어 전환이 이미 가능하다"

## 요약

현재 앱은 한국어 기본 UI + 일부 언어 필드 + 한국어 날짜 로케일 수준까지 구현되어 있습니다. 전면적인 런타임 번역 시스템은 아직 현재 코드의 소스 오브 트루스가 아닙니다.
