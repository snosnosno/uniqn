-- ============================================================
-- 공고 좌표 컬럼 — 주소 검색 2단계(B2)
--
-- 배경(docs/planning/2026-07-31-address-search-3phase-design.md §2-A · §5 2단계):
--   B1 이 도로명주소를 정규 입력으로 만들었다. 이제 그 주소를 좌표로 바꿔 두면
--   스태프 길찾기가 `link/search/{주소문자열}`(핀이 뭉개진다) 대신
--   `link/to/{이름},{위도},{경도}`(정밀 핀)로 간다.
--
-- 🔴 좌표를 `location` jsonb 에 넣지 않는 이유 — 구버전 앱에서 공고가 통째로 사라진다.
--    `toJobPosting`(JobPostingRepositoryHelpers.ts:41)이 **파싱 전에** 자기 버전의 컬럼
--    화이트리스트로 걸러내므로 **새 컬럼**은 구버전이 조용히 버린다(안전).
--    반면 `location` jsonb 안의 새 키는 그 필터를 통과한 뒤
--    `postingLocationSchema`(`.strict()`)에 막혀 **문서 전체 safeParse 가 실패**한다
--    → `parseJobPostingDocument` 가 null → 목록에서 공고가 증발한다(#194 클래스).
--
-- ── 컬럼 선택 근거 ──────────────────────────────────────────
-- `double precision` — 카카오 로컬 API 가 문자열 `"127.0276"` 로 주는 십진 도(degree) 값이다.
--   numeric 은 이 용도에 과하고(연산 없음, 비교 없음), geography/PostGIS 는 3단계(임베드
--   지도)조차 필요로 하지 않는다. 근접 검색이 실제로 생기면 그때 PostGIS 로 승격한다 —
--   지금 넣으면 확장 의존만 늘고 쓰는 곳이 없다.
--
-- ── 무결성 제약 2종 ─────────────────────────────────────────
-- 좌표는 **클라이언트가 쓴다**(EF 가 계산해 돌려준 값을 공고 문서에 실어 보낸다).
-- 공고 소유자는 어차피 주소 텍스트를 자유롭게 쓸 수 있으므로 권한 확대는 아니지만,
-- 오염된 값이 들어오면 "길찾기가 엉뚱한 나라를 가리키는" 조용한 결함이 된다.
-- 그래서 서버가 **모양**을 검사한다(값의 진위는 검사할 수 없다 — 그건 EF 의 몫):
--   1. 대한민국 경계 박스 — 마라도(위도 33.06)·독도(경도 131.87)를 포함하고 여유를 둔 값.
--      NULL 은 통과한다(CHECK 는 NULL 을 UNKNOWN 으로 보고 거부하지 않는다).
--   2. 짝 강제 — 위도만 있고 경도가 없는 반쪽 좌표는 링크를 만들 수 없어 무의미하다.
--      한쪽만 지워지는 부분 갱신을 컴파일 타임이 아니라 **DB 가** 막는다.
--
-- ── 지오코딩 실패 시 ────────────────────────────────────────
-- NULL 을 허용한다. 좌표가 없으면 `mapLink` 가 기존 주소 텍스트 검색으로 폴백한다.
-- 🔴 fail-open 금지의 의미: "실패했는데 성공한 척"이 금지라는 뜻이지, 좌표 없는 공고를
--    막으라는 뜻이 아니다. 좌표는 부가 정보이고 없으면 B1 이전과 똑같이 동작한다.
--
-- ⚠️ 파리티: 함수·정책 **수 불변**(컬럼 추가 + CHECK 제약만, DDL 에 함수·정책 없음).
--    적용 후 실측으로 192 / 111 확인할 것.
-- ============================================================

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS geo_lat double precision,
  ADD COLUMN IF NOT EXISTS geo_lng double precision;

COMMENT ON COLUMN public.job_postings.geo_lat IS
  '근무지 위도(WGS84). 카카오 로컬 API 지오코딩 결과. 지오코딩 실패·주소 미입력 시 NULL. location jsonb 에 넣지 말 것(구버전 read 증발).';
COMMENT ON COLUMN public.job_postings.geo_lng IS
  '근무지 경도(WGS84). geo_lat 과 항상 짝(chk_job_postings_geo_pair).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_postings'::regclass
      AND conname = 'chk_job_postings_geo_bounds'
  ) THEN
    ALTER TABLE public.job_postings
      ADD CONSTRAINT chk_job_postings_geo_bounds
      CHECK (
        (geo_lat IS NULL OR (geo_lat >= 32.5 AND geo_lat <= 39.0))
        AND (geo_lng IS NULL OR (geo_lng >= 124.0 AND geo_lng <= 132.5))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_postings'::regclass
      AND conname = 'chk_job_postings_geo_pair'
  ) THEN
    ALTER TABLE public.job_postings
      ADD CONSTRAINT chk_job_postings_geo_pair
      CHECK ((geo_lat IS NULL) = (geo_lng IS NULL));
  END IF;
END $$;
