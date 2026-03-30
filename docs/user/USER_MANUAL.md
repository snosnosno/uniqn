# 사용자 매뉴얼

최종 업데이트: 2026-03-30  
기준 코드: `uniqn-mobile/app/`

이 문서는 현재 모바일 앱 화면 흐름만 정리합니다.

## 시작하기

- 로그인: `/(auth)/login`
- 회원가입: `/(auth)/signup`
- 비밀번호 재설정: `/(auth)/forgot-password`

## 메인 흐름

### 공고 확인

- 홈 탭: `/(app)/(tabs)/index`
- 공고 상세: `/(app)/jobs/[id]`

### 지원

- 지원 화면: `/(app)/jobs/[id]/apply`
- 취소 화면: `/(app)/applications/[id]/cancel`

### 일정 / QR

- 일정 탭: `/(app)/(tabs)/schedule`
- QR 탭: `/(app)/(tabs)/qr`

### 알림

- 알림 센터: `/(app)/notifications`
- 카테고리 필터, 그룹화, 읽음/삭제 지원

### 평가

- 대기 평가: `/(app)/reviews/pending`
- 평가 이력: `/(app)/reviews/history`
- 평가 작성/상세: `/(app)/reviews/*`

### 고객지원

- 메인: `/(app)/support`
- FAQ: `/(app)/support/faq`
- 문의 작성: `/(app)/support/create-inquiry`
- 내 문의: `/(app)/support/my-inquiries`

## 설정

화면: `/(app)/settings`

현재 제공 항목:

- 푸시 알림
- 비밀번호 변경
- 자동 로그인
- 생체 인증
- 다크 모드
- 캐시 삭제
- 이용약관 / 개인정보처리방침 / 사업자정보
- 마케팅 수신 동의
- 계정 삭제

관련 세부 화면:

- `/(app)/settings/change-password`
- `/(app)/settings/delete-account`
- `/(app)/settings/my-data`
- `/(app)/settings/terms`
- `/(app)/settings/privacy`
- `/(app)/settings/business-info`

## 문제 발생 시

- 로그인 문제: 이메일/비밀번호와 계정 상태 확인
- 알림 문제: 기기 권한 + 앱 설정의 푸시 토글 확인
- 일정이 비어 있으면 지원/확정 상태 확인
- 문의 답변은 `문의 내역`에서 확인
