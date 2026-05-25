-- fix(db): applications.applicant_role 스키마 드리프트 정렬 (user_role → staff_role)
--
-- 문제: base_schema(20260409000000:165) 가 applicant_role 을 public.user_role 로 정의했으나,
-- 런타임은 staff_role 값(dealer/floor/serving/other 등)을 기록하고(ApplicationRepository.ts:482),
-- 생성 타입(supabase.ts)·TS 타입(StaffRole)·prod 컬럼 모두 staff_role 가정.
-- prod 는 수동 ALTER 로 이미 staff_role(미기록 드리프트) — prod 데이터 applicant_role='dealer' 확인.
-- 결과: fresh DB(CI/신규 환경)는 user_role 이라 non-staff 역할 지원 INSERT 가 confirm 전에 실패.
--
-- 수정: 마이그레이션을 prod 실체에 맞춰 staff_role 로 정렬. 멱등(현재 user_role 일 때만 ALTER).
-- user_role 값 중 staff_role 에 없는 'admin'/'employer' 는 applicant_role 에 저장되지 않음
-- (지원 역할은 포커룸 직무) — 마이그레이션 시점 테이블은 비어있어 USING 캐스트 안전.

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT atttypid::regtype::text INTO v_type
  FROM pg_attribute
  WHERE attrelid = 'public.applications'::regclass
    AND attname = 'applicant_role'
    AND NOT attisdropped;

  IF v_type = 'user_role' THEN
    ALTER TABLE public.applications
      ALTER COLUMN applicant_role TYPE public.staff_role
      USING applicant_role::text::public.staff_role;
    RAISE NOTICE 'applications.applicant_role: user_role → staff_role 정렬 완료';
  ELSE
    RAISE NOTICE 'applications.applicant_role 이미 % — 변경 없음', v_type;
  END IF;
END $$;
