-- ============================================================================
-- Migration: add blurhash placeholder columns
-- ============================================================================
--
-- impeccable v2 §18 — 모든 원격 이미지에 blurhash placeholder 부착.
-- 클라이언트 선계산 방식 (Option A / D4):
--   1. expo-image-manipulator 로 32×32 축소
--   2. blurhash npm (~15KB) 으로 해시 계산
--   3. 업로드 시 이미지 URL + blurhash 동시 저장
--   4. 소비: <Image source={uri} placeholder={{ blurhash }} transition={200} />
--
-- 스키마 전략:
--   · 스칼라 이미지 URL 컬럼 → 동명 `_blurhash` 컬럼 추가 (nullable text)
--   · 비정규화 미러 컬럼(applications, work_logs)도 동일하게 sync 컬럼 추가
--   · JSON 배열 이미지(announcements.images, board_posts.image_attachments)는
--     각 항목 객체에 `blurhash` 필드 포함 — 앱 레이어 zod validation 으로 강제
--
-- 컬럼 폭: blurhash 해시는 보통 20~40자. TEXT nullable 로 충분.
-- ============================================================================

BEGIN;

-- 1. 원본(source of truth) 이미지 컬럼 ----------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS photo_url_blurhash text;

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS og_image_url_blurhash text;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_url_blurhash text;

-- 2. 비정규화 미러 이미지 컬럼 ---------------------------------------------
-- users.photo_url 에서 스냅샷된 값. 역참조 비용 줄이기 위해 동일 blurhash 를
-- 복사 보관. 앱 레이어(Repository / RPC)에서 업데이트 시 함께 sync.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS applicant_photo_url_blurhash text;

ALTER TABLE public.work_logs
  ADD COLUMN IF NOT EXISTS staff_photo_url_blurhash text;

-- 3. 주석(column comments) -------------------------------------------------

COMMENT ON COLUMN public.users.photo_url_blurhash IS
  'impeccable v2 §18. 프로필 사진 blurhash 해시(~30자). 클라이언트 선계산.';

COMMENT ON COLUMN public.job_postings.og_image_url_blurhash IS
  'impeccable v2 §18. OG 이미지 blurhash 해시. 공고 카드 placeholder.';

COMMENT ON COLUMN public.announcements.image_url_blurhash IS
  'impeccable v2 §18. 공지사항 대표 이미지 blurhash. `announcements.images` '
  '배열 항목은 각 객체에 blurhash 필드 포함(zod 스키마).';

COMMENT ON COLUMN public.applications.applicant_photo_url_blurhash IS
  'impeccable v2 §18. users.photo_url_blurhash 비정규화 사본. 지원 시점 스냅샷.';

COMMENT ON COLUMN public.work_logs.staff_photo_url_blurhash IS
  'impeccable v2 §18. users.photo_url_blurhash 비정규화 사본. 근무 배치 시점 스냅샷.';

COMMIT;

-- ============================================================================
-- Rollback (수동 수행 시):
-- BEGIN;
-- ALTER TABLE public.users DROP COLUMN IF EXISTS photo_url_blurhash;
-- ALTER TABLE public.job_postings DROP COLUMN IF EXISTS og_image_url_blurhash;
-- ALTER TABLE public.announcements DROP COLUMN IF EXISTS image_url_blurhash;
-- ALTER TABLE public.applications DROP COLUMN IF EXISTS applicant_photo_url_blurhash;
-- ALTER TABLE public.work_logs DROP COLUMN IF EXISTS staff_photo_url_blurhash;
-- COMMIT;
-- ============================================================================
