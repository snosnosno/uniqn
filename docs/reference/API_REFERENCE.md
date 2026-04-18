# Supabase API Reference

최종 업데이트: 2026-04-18  
기준 코드: `uniqn-mobile/supabase/functions/`, `uniqn-mobile/supabase/migrations/`

이 문서는 현재 배포 중인 Supabase Edge Functions와 PostgreSQL RPC / 트리거 / 스케줄 작업 이름을 정리합니다. 상세 동작이 필요하면 각 구현 파일을 직접 확인하세요.

## Export 구조

- Edge Functions: `uniqn-mobile/supabase/functions/<function-name>/index.ts` — 외부 호출용 HTTP 엔드포인트
- RPC (PL/pgSQL): `uniqn-mobile/supabase/migrations/` 마이그레이션으로 정의 — DB 내 트랜잭션/집계/권한 체크 함수
- Triggers: `uniqn-mobile/supabase/migrations/` 마이그레이션 — 테이블 변경 시 자동 실행
- Scheduled: `pg_cron` 확장 기반 PostgreSQL 내장 스케줄러

앱에서는 `supabase.functions.invoke('<function-name>', { body })` 또는 `supabase.rpc('<rpc_name>', { ... })` 형태로 호출합니다.

## Auth / Profile (Edge Functions)

| 이름 | 디렉터리 | 설명 |
|---|---|---|
| `verify-portone-identity` | `supabase/functions/verify-portone-identity/` | PortOne 본인인증 토큰 검증 |
| `verify-and-save-portone-profile` | `supabase/functions/verify-and-save-portone-profile/` | 본인인증 기반 프로필 검증 및 저장 |
| `revoke-apple-token` | `supabase/functions/revoke-apple-token/` | Apple Sign-In 토큰 폐기 |

이메일/닉네임/전화번호 중복 체크는 PostgreSQL RPC 또는 Repository 쿼리로 처리합니다 (`uniqn-mobile/src/repositories/supabase/UserRepository.ts` 참조).

## Notifications (Edge Functions)

| 이름 | 디렉터리 | 설명 |
|---|---|---|
| `send-push-notification` | `supabase/functions/send-push-notification/` | 푸시 알림 전송 (FCM/APNs) |
| `send-job-posting-announcement` | `supabase/functions/send-job-posting-announcement/` | 공고 대상 공지 전송 |
| `send-system-announcement` | `supabase/functions/send-system-announcement/` | 시스템 공지 전송 |
| `initialize-unread-counter` | `supabase/functions/initialize-unread-counter/` | unread counter 초기화 |
| `decrement-unread-counter` | `supabase/functions/decrement-unread-counter/` | unread counter 감소 |
| `reset-unread-counter` | `supabase/functions/reset-unread-counter/` | unread counter 재설정 |

## Account / Session (Edge Functions)

| 이름 | 디렉터리 | 설명 |
|---|---|---|
| `process-scheduled-deletions` | `supabase/functions/process-scheduled-deletions/` | 삭제 예약 계정 처리 (cron 호출) |
| `cleanup-orphan-accounts` | `supabase/functions/cleanup-orphan-accounts/` | 고아 계정 정리 (cron 호출) |

## Job Posting Approval (Edge Functions)

| 이름 | 디렉터리 | 설명 |
|---|---|---|
| `approve-job-posting` | `supabase/functions/approve-job-posting/` | 대회 공고 승인 |
| `reject-job-posting` | `supabase/functions/reject-job-posting/` | 대회 공고 반려 |
| `resubmit-job-posting` | `supabase/functions/resubmit-job-posting/` | 반려 공고 재제출 |

## Schedule Board Sync (Edge Functions)

| 이름 | 디렉터리 | 설명 |
|---|---|---|
| `sync-schedule-board-outbox` | `supabase/functions/sync-schedule-board-outbox/` | 스케줄 보드 동기화 outbox 처리 |

## 주요 RPC (PL/pgSQL)

기준 파일: `uniqn-mobile/supabase/migrations/`

| 이름 | 설명 |
|---|---|
| `cancel_application_atomically` | 지원 취소 트랜잭션 (work_log/counter 정합성 포함) |
| `confirm_application_v3` | 지원 확정 및 assignment 반영 |
| `process_qr_checkin_atomically` | QR 출퇴근 원자성 처리 |
| `sync_schedule_board` | 스케줄 보드 outbox 적재 |
| `register_as_employer` | employer 등록 요청 |
| 통계 increment RPC (`stats_increment_*`) | 공고/지원 통계 원자 증감 |
| 게시판 RPC (`board_*`) | 조회수 증가, 반응 토글 등 |

## PostgreSQL Triggers

기준 파일: `uniqn-mobile/supabase/migrations/`

| 이름 (요약) | 테이블/이벤트 | 설명 |
|---|---|---|
| `validate_job_posting_data` | job_postings INSERT/UPDATE | 공고 canonical 필드 / search index 검증 및 동기화 |
| `update_job_posting_applicant_count` | applications 변경 | 공고 지원자 수 집계 |
| `on_user_role_change` | users.role UPDATE | `auth.users.raw_app_meta_data.role` 동기화 |
| `sync_application_completion_from_work_logs` | work_logs UPDATE | work log 기반 완료 상태 동기화 |
| `on_tournament_approval_change` | job_postings UPDATE | 대회 승인 상태 후처리 |
| `on_fixed_posting_expired` | job_postings UPDATE | 고정 공고 만료 후처리 |
| `on_work_date_expired` | job_postings UPDATE | 마지막 근무일 기반 만료 후처리 |
| 알림 트리거 (application/work_log/job_posting/misc) | 여러 테이블 | 지원/출퇴근/일정/정산/노쇼/평가/신고/문의 등 이벤트 기반 notifications 레코드 생성 |
| `notification_push_trigger` | notifications INSERT | `send-push-notification` Edge Function 호출 |
| `notification_counter_triggers` | notifications INSERT/UPDATE/DELETE | unread counter 동기화 |
| `work_logs_payroll_trigger` | work_logs UPDATE | 정산 데이터 일관성 유지 |

알림 트리거 세트는 `20260417010000_application_notifications.sql` ~ `20260417050000_work_log_checkinout_notifications.sql`에 분리 정의되어 있습니다.

## Scheduled Jobs (pg_cron)

기준 파일: `uniqn-mobile/supabase/migrations/20260414130000_setup_outbox_cron.sql`, `20260417060000_firebase_scheduled_jobs.sql`, `20260417070000_account_maintenance_cron.sql` 등

| 이름 (요약) | 설명 |
|---|---|
| expired push token 정리 | 만료 푸시 토큰 정리 |
| rate limit 정리 | rate limit 레코드 정리 |
| 실패 counter 재시도 | 실패한 unread counter 재시도 |
| review reminder 발송 | 평가 리마인더 발송 |
| 고정 공고 만료 | 고정 공고 만료 처리 |
| last work date 만료 | 마지막 근무일 기준 공고 만료 |
| 계정 정리 | `cleanup-orphan-accounts` / `process-scheduled-deletions` Edge Function 주기 호출 |
| schedule board outbox | `sync-schedule-board-outbox` 주기 호출 |

## 공통 메모

- Edge Functions region은 Supabase 프로젝트 기본값을 따릅니다 (ap-northeast-2 등).
- RLS는 모든 테이블에서 활성화되어 있으며, Repository/RPC/Edge Function 전 경로에서 권한이 강제됩니다.
- 인증된 호출은 사용자 JWT를 사용하고, 서비스 수준 쿼리는 service role key 기반으로 Edge Function 내부에서만 사용합니다.
- 미구현 결제/구독 API는 이 문서에 포함하지 않습니다.
