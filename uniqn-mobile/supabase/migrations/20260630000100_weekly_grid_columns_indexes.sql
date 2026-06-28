-- 주간 배치 그리드 — Phase 1 ② 컬럼·인덱스 (enum '①' 적용 이후 별도 트랜잭션)
--
-- job_postings.venue_id (nullable): 컨테이너 자기참조 + 그 운영처의 open 공고가 가리키는
--   그룹핑/집계 축. 접근 진실은 workspace_id RLS 가 담당하고, venue_id 는 그룹핑/집계 전용.
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES job_postings(id);

-- 그룹핑/집계 쿼리(venue 스팬: venue_id = :V OR id = :V) 가속.
CREATE INDEX IF NOT EXISTS idx_job_postings_venue_id
  ON job_postings(venue_id);

-- E2: 운영처당 컨테이너 1개 멱등 보장 (workspace + 정규화 운영처명 + schedule.kind).
--   동명/다중 운영처 충돌 방지 + get_or_create_venue_container 의 ON CONFLICT 추론 대상.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_venue_container
  ON job_postings (workspace_id, lower(title), (schedule ->> 'kind'))
  WHERE status = 'container';

-- work_logs 그리드/QR 확장:
--   color            — 셀 색상(토큰 팔레트 화이트리스트, S1/U3)
--   clocked_out_raw  — QR 원시 퇴근시각(덮어쓰기 금지, 운영자 수기수정 감사용)
--   end_time_source  — 'qr' | 'manual' (종료시각 출처)
--   edited_by        — 운영자 수기수정 행위자
ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS clocked_out_raw timestamptz,
  ADD COLUMN IF NOT EXISTS end_time_source text,
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES users(id);
