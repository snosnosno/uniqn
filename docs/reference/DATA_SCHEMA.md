# 데이터 스키마 가이드

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/src/schemas/`, `uniqn-mobile/src/types/`, `uniqn-mobile/src/repositories/supabase/`, `uniqn-mobile/supabase/migrations/`

이 문서는 현재 런타임에서 실제로 중요한 테이블과 canonical 필드만 요약합니다. 결제/포인트 설계 초안은 운영 스키마가 아니며 별도 아카이브 문서로 취급합니다.

백엔드는 Supabase(PostgreSQL) 기반이며, 테이블 및 컬럼 이름은 스네이크 케이스(`snake_case`)를 사용합니다. 앱 코드 레이어(타입/스키마)에서는 카멜 케이스(`camelCase`)를 사용하고 Repository가 매핑합니다.

## Source of Truth

- 앱 입력/문서 스키마: `uniqn-mobile/src/schemas/`
- 앱 타입: `uniqn-mobile/src/types/`
- DB 타입(자동 생성): `uniqn-mobile/src/types/supabase.ts`
- PostgreSQL 접근 규칙: `uniqn-mobile/src/repositories/supabase/`
- 테이블/RLS/RPC/트리거 정의: `uniqn-mobile/supabase/migrations/`
- 서버 후처리/집계/검증: `uniqn-mobile/supabase/functions/` (Edge Functions) + PostgreSQL 트리거 + RPC

## 핵심 테이블

### `users`

주요 역할:

- 앱 권한 역할
- 프로필 기본 정보
- 구인자 등록 상태
- 알림/마케팅 동의

중요 필드 예시 (DB 컬럼 스네이크 케이스 / 앱 필드 카멜 케이스):

- `role`
- `email`
- `name`
- `phone`
- `phone_verified` / `phoneVerified`
- `marketing_agreed` / `marketingAgreed`
- `profile_completed` / `profileCompleted`

참고: Supabase Auth의 `auth.users`와는 별도로 `public.users`에 앱 프로필/역할을 저장합니다. `public.users.id`는 `auth.users.id`와 동일합니다.

### `job_postings`

현재 공고 문서는 strict canonical V3 기준으로 다룹니다.

중요 top-level 필드 (DB 컬럼):

- `schema_version`
- `status`
- `owner_id`
- `posting_type`
- `work_date`
- `work_dates`
- `role_keys`
- `created_at`
- `updated_at`
- `total_positions`
- `filled_positions`
- `stats`

중요 nested(JSONB) 필드:

- `location`
- `schedule`
- `role_catalog`
- `compensation`
- `questions`
- `fixed_config`
- `tournament_config`
- `urgent_config`

### `applications`

주요 목적:

- 공고 지원
- 상태 추적
- 날짜/역할 assignment
- 취소 요청 및 이력

중요 필드 (DB 컬럼):

- `job_posting_id`
- `applicant_id`
- `status`
- `assignments`
- `confirmation_history`
- `cancellation_request`

### `work_logs`

주요 목적:

- 근무 기록
- 출퇴근 시간
- 완료 상태 동기화
- 정산 계산 근거

중요 필드 (DB 컬럼):

- `job_posting_id`
- `staff_id`
- `date`
- `check_in_time`
- `check_out_time`
- `status`
- `payroll_*` (정산 관련 컬럼 — 정산은 별도 테이블 없이 `work_logs.payroll_*` 컬럼으로 관리)

### `notifications`

주요 목적:

- 알림 센터 표시
- unread counter 동기화
- 딥링크 이동 데이터 저장

중요 필드 (DB 컬럼):

- `recipient_id`
- `type`
- `category`
- `is_read`
- `link`
- `data`

unread 카운터는 별도 `notification_counters` 테이블에서 PostgreSQL 트리거로 동기화합니다.

### 운영성 테이블

- `announcements`
- `reports`
- `inquiries`
- `event_qr_codes`
- `job_posting_templates`
- `app_config`
- `notification_settings`
- `user_consents`
- `board_posts` / `board_comments` / `board_memberships` / `board_votes` / `board_reports` / `board_comment_reactions`
- `fcm_tokens`
- `employer_applications`
- `rate_limits`
- `action_logs`
- `schedule_board_sync_outbox`

## 현재 스키마 해석 원칙

- 문서보다 코드가 우선이며, 스키마 최종 진실은 `uniqn-mobile/supabase/migrations/` 마이그레이션 및 `uniqn-mobile/src/types/supabase.ts`입니다.
- `job_postings`는 strict parse 기반 canonical 문서를 우선합니다.
- 레거시 fallback이 일부 남아 있어도 새 문서는 canonical 필드만 써야 합니다.
- 결제/포인트 관련 테이블은 현재 운영 스키마가 아닙니다.
- 모든 테이블은 RLS 활성화되어 있으며, 권한 체크는 `(auth.jwt() -> 'app_metadata' ->> 'role')` 기준입니다.

## 참고 경로

- `uniqn-mobile/src/schemas/auth.schema.ts`
- `uniqn-mobile/src/schemas/notification.schema.ts`
- `uniqn-mobile/src/types/user.ts`
- `uniqn-mobile/src/types/notification.ts`
- `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts`
- `uniqn-mobile/src/repositories/supabase/NotificationRepository.ts`
- `uniqn-mobile/src/types/supabase.ts`
- `uniqn-mobile/supabase/migrations/20260409000000_base_schema.sql` (핵심 테이블 정의)
