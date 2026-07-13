CREATE OR REPLACE FUNCTION public.register_as_employer(p_employer_agreements jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user record;
  v_now timestamptz := now();
BEGIN
  -- 현재 사용자 조회 + 잠금
  SELECT * INTO v_user
    FROM users
    WHERE id = auth.uid()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  -- staff → employer만 허용 (admin 상승 차단)
  IF v_user.role != 'staff' THEN
    RAISE EXCEPTION 'INVALID_ROLE_TRANSITION: 현재 역할 %, staff만 employer로 전환 가능', v_user.role;
  END IF;

  -- 역할 변경
  UPDATE users SET
    role = 'employer',
    employer_agreements = COALESCE(p_employer_agreements, employer_agreements),
    employer_registered_at = v_now,
    updated_at = v_now
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'newRole', 'employer',
    'registeredAt', v_now
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_as_employer(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_as_employer(jsonb) TO authenticated;
