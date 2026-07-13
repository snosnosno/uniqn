-- ============================================================
-- reports.type CHECK constraint 교체
-- ============================================================
-- 배경: base_schema 에 설정된 chk_report_type 이 'spam/harassment/inappropriate/fraud/other'
--       (board_reports 스타일) 로 되어있어 실제 앱의 EmployeeReportType + EmployerReportType
--       대부분을 DB 레벨에서 차단. 이전에는 INSERT 자체가 도달하지 못해 묻혀있던 버그.
--
-- 소스 오브 트루스: src/types/report.ts
--   · EmployeeReportType (구인자 → 스태프): tardiness, negligence, no_show, early_leave,
--                                          inappropriate, dress_code, communication, other
--   · EmployerReportType (구직자 → 구인자): false_posting, employer_negligence,
--                                          unfair_treatment, inappropriate_behavior, other
-- ============================================================

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS chk_report_type;

ALTER TABLE public.reports ADD CONSTRAINT chk_report_type CHECK (
  type IN (
    -- EmployeeReportType (구인자 → 스태프)
    'tardiness',
    'negligence',
    'no_show',
    'early_leave',
    'inappropriate',
    'dress_code',
    'communication',
    -- EmployerReportType (구직자 → 구인자)
    'false_posting',
    'employer_negligence',
    'unfair_treatment',
    'inappropriate_behavior',
    -- 공통
    'other'
  )
);

COMMENT ON CONSTRAINT chk_report_type ON public.reports IS
  'src/types/report.ts 의 EmployeeReportType + EmployerReportType union 과 일치해야 함. '
  '기존 board_reports 스타일(spam/harassment/fraud) 은 잘못된 값이라 교체.';
