-- job_posting_templates.description 컬럼 추가
-- 사유: TemplateModal UI와 TemplateRepository.saveTemplate/updateTemplate가
-- description을 처리하지만 DB 스키마에 컬럼이 없어 사용자가 설명 입력 시
-- "column description does not exist" 에러가 발생함.

ALTER TABLE public.job_posting_templates
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.job_posting_templates.description IS
  '템플릿 설명 (선택, max 100자) — TemplateModal.tsx에서 입력';
