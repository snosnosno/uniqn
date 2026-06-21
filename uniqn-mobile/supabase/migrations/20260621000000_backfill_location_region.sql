-- A5 (region 후속): 기존 공고 location.region 백필
--
-- 배경: PR #192 가 구조화 지역(region slug) 필터를 도입(src/constants/regions.ts)하고
--   PR #194 가 작성폼 저장경로(draftAdapter)를 고쳐 신규 공고는 region 을 저장한다.
--   그러나 기존 공고는 전부 location.region IS NULL → 지역 필터(eq location->>'region')에
--   하나도 걸리지 않아 필터가 기존 데이터에 무용하다. 자유텍스트 주소(location->>'district')
--   에서 best-effort 로 region slug 를 도출해 채운다.
--
-- 도출 규칙: src/constants/regions.ts 의 findRegionByAddress(:179-207) 를 SQL 로 포팅한다.
--   우선순위(충돌 회피): ① '경기' 명시 → 경기 도시 한정(광역시 광주와 혼동 방지)
--   ② 광역시 시단위 ③ 제주(서귀포 먼저, 제주시 substring 충돌 방지) ④ 서울 구
--   ⑤ 폴백: 도/시 접두 없는 구 이름 = 서울 구(수도권 집중). 매칭 실패 시 NULL 유지.
--
-- 멱등성: WHERE location->>'region' IS NULL 가드로 재실행 시 이미 채워진 행(사용자 직접
--   선택 포함)을 건드리지 않는다. 도출 실패(NULL)는 그대로 두어 사용자가 편집폼에서 보정.
--
-- 함수 public.derive_region_slug(text): 백필 + pgTAP 테스트 + 출시 전 재백필에 재사용한다.
--   유지보수 전용이므로 anon/authenticated/PUBLIC EXECUTE 를 명시 REVOKE 한다
--   (pitfall_supabase_new_function_anon_default_grant).

CREATE OR REPLACE FUNCTION public.derive_region_slug(addr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  t text := btrim(coalesce(addr, ''));
  r text;
BEGIN
  IF t = '' THEN
    RETURN NULL;
  END IF;

  -- 1) 경기 우선 — '경기' 명시 시 경기 도시로 한정(광역시 광주와 혼동 방지)
  IF position('경기' in t) > 0 THEN
    SELECT m.slug INTO r FROM (VALUES
      ('수원시','경기 수원시'),('성남시','경기 성남시'),('고양시','경기 고양시'),
      ('용인시','경기 용인시'),('부천시','경기 부천시'),('안산시','경기 안산시'),
      ('안양시','경기 안양시'),('남양주시','경기 남양주시'),('화성시','경기 화성시'),
      ('평택시','경기 평택시'),('의정부시','경기 의정부시'),('시흥시','경기 시흥시'),
      ('파주시','경기 파주시'),('김포시','경기 김포시'),('광명시','경기 광명시'),
      ('광주시','경기 광주시'),('군포시','경기 군포시'),('하남시','경기 하남시'),
      ('오산시','경기 오산시'),('양주시','경기 양주시'),('이천시','경기 이천시'),
      ('구리시','경기 구리시'),('안성시','경기 안성시'),('포천시','경기 포천시'),
      ('의왕시','경기 의왕시'),('여주시','경기 여주시'),('동두천시','경기 동두천시'),
      ('과천시','경기 과천시'),('가평군','경기 가평군'),('양평군','경기 양평군'),
      ('연천군','경기 연천군')
    ) AS m(kw, slug)
    WHERE position(m.kw in t) > 0
    ORDER BY length(m.kw) DESC, m.kw
    LIMIT 1;
    RETURN r;  -- 경기 명시인데 도시 미매칭이면 NULL (findRegionByAddress 동치: 분기 내 return)
  END IF;

  -- 2) 광역시 — 시 단위 명시 매칭
  SELECT m.slug INTO r FROM (VALUES
    ('부산','부산'),('대구','대구'),('인천','인천'),('광주','광주'),
    ('대전','대전'),('울산','울산'),('세종','세종')
  ) AS m(kw, slug)
  WHERE position(m.kw in t) > 0
  ORDER BY length(m.kw) DESC, m.kw
  LIMIT 1;
  IF r IS NOT NULL THEN
    RETURN r;
  END IF;

  -- 2-1) 제주 — 서귀포시 먼저(제주시 substring 충돌 방지)
  IF position('서귀포' in t) > 0 THEN
    RETURN '제주 서귀포시';
  END IF;
  IF position('제주' in t) > 0 THEN
    RETURN '제주 제주시';
  END IF;

  -- 3)+4) 서울 구 매칭 — '서울' 명시 또는 폴백(구 이름만)은 둘 다 서울 구 결과라 통합.
  --   (findRegionByAddress 의 step3 'if 서울' 과 step4 폴백이 동일 결과 집합이라 동치)
  SELECT m.slug INTO r FROM (VALUES
    ('강남구','서울 강남구'),('강동구','서울 강동구'),('강북구','서울 강북구'),
    ('강서구','서울 강서구'),('관악구','서울 관악구'),('광진구','서울 광진구'),
    ('구로구','서울 구로구'),('금천구','서울 금천구'),('노원구','서울 노원구'),
    ('도봉구','서울 도봉구'),('동대문구','서울 동대문구'),('동작구','서울 동작구'),
    ('마포구','서울 마포구'),('서대문구','서울 서대문구'),('서초구','서울 서초구'),
    ('성동구','서울 성동구'),('성북구','서울 성북구'),('송파구','서울 송파구'),
    ('양천구','서울 양천구'),('영등포구','서울 영등포구'),('용산구','서울 용산구'),
    ('은평구','서울 은평구'),('종로구','서울 종로구'),('중랑구','서울 중랑구'),
    ('중구','서울 중구')
  ) AS m(kw, slug)
  WHERE position(m.kw in t) > 0
  ORDER BY length(m.kw) DESC, m.kw
  LIMIT 1;

  RETURN r;  -- 미매칭이면 NULL → region 그대로 NULL 유지
END
$fn$;

COMMENT ON FUNCTION public.derive_region_slug(text) IS
  '자유텍스트 주소 → region slug best-effort 도출(유지보수 전용). src/constants/regions.ts findRegionByAddress 의 SQL 포팅.';

-- 유지보수 전용: 앱 런타임 역할(anon/authenticated)에 노출하지 않는다.
REVOKE EXECUTE ON FUNCTION public.derive_region_slug(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.derive_region_slug(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.derive_region_slug(text) FROM authenticated;

-- 백필: region 미설정 행만 도출 결과로 채운다(NULL 도출은 건너뜀 → 멱등).
DO $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.job_postings jp
  SET location = jsonb_set(jp.location, '{region}', to_jsonb(d.region), true)
  FROM (
    SELECT id, public.derive_region_slug(location->>'district') AS region
    FROM public.job_postings
    WHERE location->>'region' IS NULL
  ) d
  WHERE jp.id = d.id
    AND d.region IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'location.region backfill: % row(s) updated', v_updated;
END $$;
