# 국제화 가이드

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/app/`, `uniqn-mobile/src/schemas/`, `uniqn-mobile/src/utils/date/`, `uniqn-mobile/src/components/auth/signup/`

이 문서는 현재 앱에 실제로 존재하는 언어 관련 구현만 정리합니다.

## 현재 기준

- 앱 UI 기본 언어는 한국어입니다.
- 사용자 스키마에는 `language: 'ko' | 'en'` 필드가 있지만, 앱 전역 언어 전환 UI는 현재 없습니다.
- 날짜와 달력 표시는 `date-fns/locale/ko`를 기준으로 동작합니다.
- 이용약관, 개인정보처리방침, 회원가입 동의 문구는 별도 번역 리소스가 아니라 현재 화면과 컴포넌트 코드에 포함되어 있습니다.

## 기준 파일

1. `uniqn-mobile/src/schemas/user.schema.ts`
2. `uniqn-mobile/app/(app)/settings/index.tsx`
3. `uniqn-mobile/app/(app)/settings/terms.tsx`
4. `uniqn-mobile/app/(app)/settings/privacy.tsx`
5. `uniqn-mobile/src/components/auth/signup/termsContent.ts`
6. `uniqn-mobile/src/utils/date/formatting.ts`
7. `uniqn-mobile/src/components/schedule/CalendarView.tsx`

## 현재 포함 범위

### 사용자 프로필 언어 필드

- 사용자 문서와 스키마는 `ko`, `en` 값을 저장할 수 있습니다.
- 이 필드는 향후 확장 여지는 있지만, 현재 앱 전체 문자열 번역 스위치로 연결되지는 않습니다.

### 한국어 날짜/달력 로컬화

- 일정, 공지, 문의, 신고, 근무 이력 등 날짜 표시는 한국어 로케일을 기준으로 포맷됩니다.
- 캘린더 UI도 한국어 요일과 표기 흐름을 전제로 구성되어 있습니다.

### 정책 텍스트 노출

- 회원가입 단계와 설정 화면에서 이용약관, 개인정보처리방침을 직접 표시합니다.
- 별도 다국어 리소스 파일이나 번역 서버를 현재 앱의 기준 구현으로 보지 않습니다.

## 현재 제외 범위

- 앱 전역 번역 프레임워크
- 언어 전환 설정 화면
- 원격 번역 리소스 동기화
- 웹 전용 i18n 구조

## 새 i18n 작업 전 체크

1. 번역 저장 위치를 코드 상수, JSON 리소스, 원격 저장소 중 무엇으로 할지 먼저 정합니다.
2. 사용자 언어 선택값을 Firestore 프로필, 로컬 스토어, 또는 둘 다에 저장할지 결정합니다.
3. 전체 앱 번역인지, 약관과 정책 텍스트만 번역할지 범위를 명확히 합니다.

## 관련 문서

- `docs/core/DEVELOPMENT_GUIDE.md`
- `docs/reference/ARCHITECTURE.md`
- `docs/reference/DATA_SCHEMA.md`
