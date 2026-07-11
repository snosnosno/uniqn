-- ============================================================
-- A5: public.derive_region_slug(text) + region 백필 검증
-- ============================================================
-- 목적: findRegionByAddress(src/constants/regions.ts) SQL 포팅의 우선순위 충돌 회피
--   (경기 광주 vs 광주광역시, 부산 강서구 vs 서울 강서구, 서귀포 vs 제주시)와
--   백필 UPDATE 의 멱등성(기존 region 미덮어쓰기) + grant(anon 차단)을 검증.
-- 안전: BEGIN/ROLLBACK 래핑 + 마커(__sql_fixture_region_*).
-- ============================================================

BEGIN;
SELECT plan(13);

-- ── 함수 도출 규칙 (순수) ──────────────────────────────────
-- ① '경기' 명시 → 경기 도시 한정 (광역시 광주와 충돌 회피)
SELECT is(public.derive_region_slug('경기 광주시 오포읍'), '경기 광주시', '경기 광주시 → 경기 광주시');
-- ② 광역시
SELECT is(public.derive_region_slug('광주광역시 동구'), '광주', '광주광역시 → 광주(광역시)');
-- ② 광역시 우선 (부산 강서구는 서울 강서구가 아님)
SELECT is(public.derive_region_slug('부산광역시 강서구'), '부산', '부산 강서구 → 부산(서울 강서구 아님)');
-- ③ 제주 — 서귀포 먼저
SELECT is(public.derive_region_slug('제주특별자치도 서귀포시 중문'), '제주 서귀포시', '서귀포 → 제주 서귀포시');
SELECT is(public.derive_region_slug('제주시 노형동'), '제주 제주시', '제주시 → 제주 제주시');
-- ④ 서울 구 (명시)
SELECT is(public.derive_region_slug('서울특별시 강남구 역삼동'), '서울 강남구', '서울 강남구 → 서울 강남구');
-- ⑤ 폴백 — 접두 없는 구 이름
SELECT is(public.derive_region_slug('강남구 어딘가 홀덤펍'), '서울 강남구', '구 이름만 → 서울 구 폴백');
-- 미매칭 / 빈값
SELECT is(public.derive_region_slug(''), NULL, '빈 문자열 → NULL');
SELECT is(public.derive_region_slug(NULL), NULL, 'NULL → NULL');
SELECT is(public.derive_region_slug('해외 라스베가스 벨라지오'), NULL, '키워드 없음 → NULL');
SELECT is(public.derive_region_slug('경기도'), NULL, '경기 명시·도시 미매칭 → NULL(분기 내 반환)');

-- ── grant: anon EXECUTE 차단 ───────────────────────────────
SELECT is(
  has_function_privilege('anon', 'public.derive_region_slug(text)', 'EXECUTE'),
  false,
  'anon 은 derive_region_slug EXECUTE 불가(유지보수 전용)'
);

-- ── 백필 멱등성 + 채움 ─────────────────────────────────────
DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_ws_id    uuid := gen_random_uuid();
  v_jp_fill  uuid := gen_random_uuid();  -- region NULL → 채워져야 함
  v_jp_keep  uuid := gen_random_uuid();  -- region 기존값 → 보존되어야 함
  v_region   text;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_region_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"RG_OWNER"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_owner_id, '__sql_fixture_region_owner@test.local', 'fixture', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws_id, '__sql_fixture_region_ws', v_owner_id, now(), now());

  -- region 미설정(채움 대상): district 로 '서울 송파구' 도출 기대
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, location, created_at, updated_at)
  VALUES (v_jp_fill, v_owner_id, v_ws_id, '__sql_fixture: region fill', 1, 0, 'active',
          '{"name":"펍A","district":"서울 송파구 잠실동"}'::jsonb, now(), now());

  -- region 기존값(보존 대상): district 는 '부산' 도출되지만 덮어쓰면 안 됨
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, location, created_at, updated_at)
  VALUES (v_jp_keep, v_owner_id, v_ws_id, '__sql_fixture: region keep', 1, 0, 'active',
          '{"name":"펍B","district":"부산 해운대구","region":"서울 강남구"}'::jsonb, now(), now());

  -- 마이그레이션과 동일한 백필 UPDATE
  UPDATE public.job_postings jp
  SET location = jsonb_set(jp.location, '{region}', to_jsonb(d.region), true)
  FROM (
    SELECT id, public.derive_region_slug(location->>'district') AS region
    FROM public.job_postings
    WHERE location->>'region' IS NULL
      AND id IN (v_jp_fill, v_jp_keep)
  ) d
  WHERE jp.id = d.id AND d.region IS NOT NULL;

  SELECT location->>'region' INTO v_region FROM public.job_postings WHERE id = v_jp_fill;
  IF v_region IS DISTINCT FROM '서울 송파구' THEN
    RAISE EXCEPTION 'backfill fill: expected 서울 송파구, got %', v_region;
  END IF;

  SELECT location->>'region' INTO v_region FROM public.job_postings WHERE id = v_jp_keep;
  IF v_region IS DISTINCT FROM '서울 강남구' THEN
    RAISE EXCEPTION 'backfill idempotency: expected 서울 강남구(보존), got %', v_region;
  END IF;

  DELETE FROM public.job_postings WHERE id IN (v_jp_fill, v_jp_keep);
  DELETE FROM public.workspaces WHERE id = v_ws_id;
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  DELETE FROM public.workspaces WHERE owner_id = v_owner_id;
  DELETE FROM public.users WHERE id = v_owner_id;
  DELETE FROM auth.users WHERE id = v_owner_id;
END $$;

SELECT pass('region 백필: NULL 행 채움 + 기존 region 보존(멱등) 검증');

SELECT * FROM finish();
ROLLBACK;
