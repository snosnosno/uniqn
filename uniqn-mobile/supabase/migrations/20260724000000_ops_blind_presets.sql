-- ops_blind_presets: 내 계정 전용 블라인드 프리셋(B3)
-- 소유자별 블라인드 구조 저장/재사용. 소유자 전용(+admin) RLS, anon 표면 차단, FORCE RLS.
-- 스펙: taskB-3-brief.md. 패턴: ops S1 테이블 마이그(FORCE RLS + anon REVOKE + owner 스코프 정책).

CREATE TABLE public.ops_blind_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  levels jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ops_blind_presets_owner_name_key UNIQUE (owner_id, name)  -- 동명 갱신(upsert, spec §3.2) 지지
);
CREATE INDEX ops_blind_presets_owner_idx ON public.ops_blind_presets (owner_id, created_at DESC);

ALTER TABLE public.ops_blind_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_blind_presets FORCE ROW LEVEL SECURITY;

-- anon 표면 차단(Supabase 기본 privilege 가 anon 에 테이블 GRANT — RLS 0행이어도 명시 회수).
REVOKE ALL ON TABLE public.ops_blind_presets FROM PUBLIC, anon;

-- 소유자 전용(+admin). is_admin() 은 initplan 래핑. 정책은 authenticated 한정.
CREATE POLICY ops_blind_presets_owner_all ON public.ops_blind_presets
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

COMMENT ON TABLE public.ops_blind_presets IS '내 계정 전용 블라인드 프리셋(B3). 소유자 전용 RLS(FORCE), anon 표면 차단.';
