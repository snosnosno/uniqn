-- 죽은 Lane D(featured 유료노출) 수익모델 잔재 컬럼 제거.
-- 배경: 가상화폐 지갑/IAP 수익모델 전체 제거(#196/#199) 후 is_featured 는 소비처 없는 inert 컬럼(true 행 0).
-- 안전: #201 로 모든 클라이언트 SELECT 에서 제거 + 웹(uniqn-app) 재배포 + 모바일 OTA(group 0b50ff86)
--       완료 후 적용(배포본이 SELECT 중인 상태에서 드롭하면 읽기 증발).
-- 의존: 인덱스 idx_jp_featured(status, is_featured DESC, created_at DESC) 는 컬럼 DROP 시 자동 제거.
--       list_all_managed_postings RPC 는 RETURNS SETOF job_postings + SELECT * 라 자동 정합(영향 없음).
--       is_featured 를 본문에서 참조하는 함수/뷰/정책 0건 실측(pg_proc.prosrc·pg_depend·pg_policies).
-- prod 적용 완료(2026-06-24, MCP apply_migration, version 20260624144736). 본 파일은 로컬/CI db reset 정합용.
ALTER TABLE public.job_postings DROP COLUMN IF EXISTS is_featured;
