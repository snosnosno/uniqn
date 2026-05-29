-- M1 (공고 자동마감 Approach B): posting_status enum 에 capacity_full 추가
--
-- 의미: "정원 도달로 자동 마감되었으나 빈자리 생기면 자동 복귀 대기 중" 상태.
--   closed(구인자 수동/만료 마감) / cancelled 와 구분.
-- 멱등: ADD VALUE IF NOT EXISTS. ALTER TYPE ADD VALUE 는 자체 트랜잭션에서 커밋되어야
--   이후 마이그(M2/M3)에서 사용 가능 → 단독 파일로 분리.
-- spec: docs/superpowers/specs/2026-05-28-job-posting-auto-close-design.md §2 M1

ALTER TYPE posting_status ADD VALUE IF NOT EXISTS 'capacity_full' AFTER 'active';
