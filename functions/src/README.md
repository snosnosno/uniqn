# Functions Source Layout

최종 업데이트: 2026-03-30

`functions/src/index.ts`는 bootstrap 전용입니다. Admin 초기화와 Sentry 초기화 후 아래 barrel을 re-export합니다.

## Barrel 구조

- `src/api/`: callable / HTTP 엔트리
- `src/triggers/`: Firestore 트리거
- `src/scheduled/`: 스케줄 작업

## 주요 도메인

### Auth

- 중복 확인
- Apple 토큰 폐기
- 프로필 검증 및 저장

### Accounts

- 예약 삭제 처리
- 강제 계정 삭제
- 로그인 알림
- 로그인 실패 기록
- orphan 계정 정리

### Notifications

- 공지 발송 callable
- unread counter callable
- 지원/일정/정산/문의/신고/평가 관련 Firestore 트리거

### Admin

- 가입 요청 / 승인
- 사용자 생성 / 수정 / 삭제
- 관리자 통계

### Job Postings

- 승인 / 반려 / 재제출 callable
- canonical 검증 / applicant counter / OG sync

## Canonical Job Posting Touchpoints

- `src/api/jobPostings/`
- `src/triggers/jobPostings.ts`
- `src/triggers/onJobPostingOGSync.ts`

공고 관련 새 기능은 canonical field를 우선 사용하고, derived field는 명시적으로 범위를 제한합니다.
