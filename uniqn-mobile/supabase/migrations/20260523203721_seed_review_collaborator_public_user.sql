-- E2E review-collaborator(e5555555) 의 public.users 행을 멱등 시드.
--
-- 배경: 20260520205822_seed_review_collaborator_account.sql 는 auth.users 만 INSERT 하고
--   public.users 생성을 handle_new_user 트리거에 의존한다. 그러나 CI(supabase start) 의
--   로컬 스택에서는 handle_new_user 가 직접 auth.users INSERT 에 발동하지 않아(known: PR #90)
--   collaborator 의 public.users 행이 생성되지 않는다. 결과적으로 auth.users 만 있고
--   public.users 가 없는 orphan 상태 → 앱 auth 초기화가 signOut → 로그인 화면 →
--   collaborator e2e(공유받은 공고 등) 전면 실패.
--   프로덕션에서는 트리거가 정상 발동해 행이 이미 존재하므로 ON CONFLICT 로 no-op.
--
-- 값은 prod 의 실제 collaborator 행과 동일(완전한 프로필 플래그 포함)하게 맞춰
--   authRedirect 게이트(phone_verified/identity_verified)에 의한 약관 리다이렉트도 방지.
-- prevent_role_escalation 은 BEFORE UPDATE OF role 이라 INSERT 에는 영향 없음.

INSERT INTO public.users (
  id, email, name, role, phone,
  phone_verified, identity_verified, identity_verified_at, identity_provider, profile_completed
) VALUES (
  'e5555555-5555-4555-a555-555555555555',
  'review-collaborator@uniqn.app',
  '심사용 협업자',
  'employer',
  '+821055550005',
  true, true, NOW(), 'portone_inicis', true
)
ON CONFLICT (id) DO NOTHING;
