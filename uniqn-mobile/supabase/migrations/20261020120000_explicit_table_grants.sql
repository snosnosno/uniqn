-- ============================================================
-- 기본 privilege 의존 테이블 4종에 명시 GRANT 추가 (Supabase 2026-10-30 변경 대응)
-- ============================================================
-- 배경: Supabase 가 2026-10-30 부터 public 스키마 **신규 테이블**에 Data API 권한을
--   자동 부여하지 않는다. 기존 테이블은 그대로지만, 마이그를 처음부터 재실행하는 환경
--   (preview branch · 로컬 `supabase db reset` · 신규 프로젝트)은 "신규 생성"으로 취급된다.
--   아래 4개 테이블은 생성 마이그에 GRANT 없이 기본 privilege 에 기대고 있었다.
--
-- 성격: **추가 전용(additive)**. prod 에서는 이미 기본 privilege 로 ALL 을 보유 중이라
--   no-op 이다. 권한을 넓히지도 좁히지도 않고, 재실행 환경에서 의도한 접근만 보장한다.
--   부여 범위는 각 테이블의 실제 접근 경로(RLS 정책·EF·SECDEF RPC)에 맞춘 최소치다.
--
-- 재발 방지: scripts/check-table-grants.js (npm run quality 에 포함)
-- ============================================================

-- ops-web 블라인드 프리셋 — 소유자 RLS(FORCE) 로 authenticated 가 직접 CRUD.
-- anon 은 생성 마이그(20260724000000)에서 이미 회수.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ops_blind_presets TO authenticated;
GRANT ALL ON TABLE public.ops_blind_presets TO service_role;

-- push ticket 적재 — RLS 정책 0개(deny-all), send-push-notification · poll-push-receipts EF 가
-- service_role 로만 접근한다.
GRANT ALL ON TABLE public.push_tickets TO service_role;

-- 공고 공지 발송 이력 — 읽기는 jpa_select_manager 정책(authenticated),
-- 쓰기는 send_job_posting_announcement SECDEF RPC(소유자 권한) 전용.
GRANT SELECT ON TABLE public.job_posting_announcements TO authenticated;
GRANT ALL ON TABLE public.job_posting_announcements TO service_role;

-- 근무 일정 감사 이벤트 — authenticated SELECT 는 생성 마이그(20260911053907)에 이미 있음.
-- 쓰기는 release_scheduled_assignment SECDEF RPC 전용.
GRANT ALL ON TABLE public.work_schedule_audit_events TO service_role;
