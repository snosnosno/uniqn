-- 주간 배치 그리드 — Phase 1 ⑥ 컨테이너 쓰기 경로 fail-closed (적대 리뷰 HIGH 적발)
--
-- 적대 리뷰 발견(다수결 3/3 confirmed): SELECT carve-out(④/⑤)만으로는 부족하다. job_postings 의
-- INSERT/UPDATE permissive 정책들(job_postings_insert_authenticated=임의 authenticated,
-- jp_insert=employer/admin, jp_update_*)이 status 를 전혀 검사하지 않아:
--   (a) 임의 employer 가 타 워크스페이스에 status='container' 행을 직접 INSERT → get_or_create_venue_container
--       의 is_workspace_member 게이트(S2/R2) 우회,
--   (b) uniq_venue_container + RPC 의 ON CONFLICT→SELECT 폴백을 악용한 "컨테이너 하이재킹"
--       (공격자가 victim workspace_id 로 컨테이너 선점 → victim RPC 가 공격자 소유 id 반환),
--   (c) 일반 공고를 container 로 status 전이시켜 malformed 컨테이너 주입.
--
-- 조치: RESTRICTIVE 정책으로 모든 클라이언트 롤(authenticated/anon 등 public)의 컨테이너 직접
--   INSERT/UPDATE 를 차단한다. RESTRICTIVE 는 permissive 와 AND 합산이라 기존 정책을 재작성하지
--   않고 컨테이너만 막는다. SECDEF RPC(get_or_create_venue_container 등)는 definer=postgres=테이블
--   소유자 + FORCE RLS off 이므로 RLS 를 우회 → 영향 없음. 즉 "컨테이너 쓰기 = SECDEF RPC 전용".
--   비컨테이너 공고의 INSERT/UPDATE 가시성은 종전과 완전히 동일(무회귀).
CREATE POLICY "jp_container_no_direct_insert" ON public.job_postings
  AS RESTRICTIVE FOR INSERT TO public
  WITH CHECK (status <> 'container'::posting_status);

CREATE POLICY "jp_container_no_direct_update" ON public.job_postings
  AS RESTRICTIVE FOR UPDATE TO public
  USING (status <> 'container'::posting_status)
  WITH CHECK (status <> 'container'::posting_status);

-- R1 드리프트 fail-closed 보험: 컨테이너는 filled_positions 를 절대 쓰지 않는다(read-time COUNT).
--   Phase 3 에서 add_direct_staff 가 컨테이너 skip 분기를 받기 전에 컨테이너로 호출되면 filled+1 로
--   드리프트(filled=N,total=0)가 발생할 수 있으므로, DB 레벨 CHECK 로 원천 차단(드리프트 시 에러).
ALTER TABLE public.job_postings
  ADD CONSTRAINT chk_container_no_filled
  CHECK (status <> 'container'::posting_status OR COALESCE(filled_positions, 0) = 0);
