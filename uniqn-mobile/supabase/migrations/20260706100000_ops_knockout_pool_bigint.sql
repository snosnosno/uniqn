-- OPS 1f 후속 — knockout_pool int→bigint 승격 (KO 풀 산술 오버플로 근본 수선).
-- 배경(근본원인): 1c 에서 ops_live_stats.knockout_pool 을 int 로 정의. recompute 가
--   (v_total_buyins * v_bounty_cost)::int. H15 의 bounty_cost CHECK 상한 1억(100000000)만으론 불충분:
--   1억 × total_buyins(≥22) = 2.2e9 > int max(2,147,483,647) → DEFERRED 트리거 커밋 시점 22003
--   numeric overflow 로 터지고 이후 전 참가자 변이가 막힌다. prize_pool 은 이미 bigint 인데
--   knockout_pool 만 int 인 비대칭이 근원. 현실값 미도달로 비차단이었으나 정공법 = bigint 승격.
-- 변경 2곳만: (A) 컬럼 타입 bigint, (B) recompute DECLARE v_knockout_pool bigint + 산식 ::int 다운캐스트 제거.
--   함수 본체는 20260704100100_ops_1f_live_stats_deferred.sql 의 live 정의 베이스 전건 보존(회귀 금지).
-- bounty_cost CHECK 상한 1억은 유지(bigint 승격으로 오버플로 명분은 사라지나 무해한 sanity bound.
--   상한 조정은 별도 논의 — 이 PR 범위 밖).

-- ═══ A. 컬럼 타입 승격 (prod 0행 → 즉시·무락. 로컬 db:reset 정합. 기존 int 값은 bigint 로 무손실 확대) ═══
ALTER TABLE public.ops_live_stats
  ALTER COLUMN knockout_pool TYPE bigint;

-- ═══ B. recompute 재정의 — 20260704100100 live 정의 베이스, 두 곳만 변경:
--        DECLARE v_knockout_pool int→bigint, 산식 (v_total_buyins * v_bounty_cost)::int 의 ::int 제거
--        (v_total_buyins 가 bigint 라 곱은 이미 bigint — 다운캐스트만 제거). 나머지 로직·컬럼목록 전건 보존.
--        CREATE OR REPLACE — 시그니처 불변 → 기존 REVOKE(anon/authenticated) 보존. ═══
CREATE OR REPLACE FUNCTION public.fn_ops_recompute_live_stats(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_buy_in_cost int;
  v_rebuy_cost  int;
  v_addon_cost  int;
  v_bounty_cost int;
  v_playing      int;
  v_entries      int;
  v_reentries    int;
  v_total_rebuys bigint;
  v_total_addons bigint;
  v_total_chips  bigint;
  v_tables_open  int;
  v_seats_total  int;
  v_seats_free   int;
  v_average_stack bigint;
  v_big_blind    int;
  v_avg_stack_bb numeric;
  v_total_buyins bigint;
  v_prize_pool   bigint;
  v_knockout_pool bigint;  -- [후속] int→bigint (22억 KO 풀 오버플로 근본 수선)
BEGIN
  -- [CASCADE 가드] 대회 삭제 중 자식 DELETE 트리거가 부르면 조용히 종료(1c 보존)
  IF NOT EXISTS (SELECT 1 FROM public.ops_tournaments WHERE id = p_tournament_id) THEN
    RETURN;
  END IF;

  SELECT buy_in_cost, rebuy_cost, addon_cost, bounty_cost
    INTO v_buy_in_cost, v_rebuy_cost, v_addon_cost, v_bounty_cost
    FROM public.ops_tournaments WHERE id = p_tournament_id;

  SELECT
    count(*) FILTER (WHERE status = 'active'),
    count(*),
    COALESCE(sum(reentries), 0),
    COALESCE(sum(rebuys), 0),
    COALESCE(sum(add_ons), 0),
    COALESCE(sum(chips) FILTER (WHERE status = 'active'), 0)
  INTO v_playing, v_entries, v_reentries, v_total_rebuys, v_total_addons, v_total_chips
  FROM public.ops_participants
  WHERE tournament_id = p_tournament_id;

  SELECT count(*)
    INTO v_tables_open
    FROM public.ops_tables
    WHERE tournament_id = p_tournament_id AND status = 'open';

  SELECT count(s.id), count(s.id) FILTER (WHERE s.participant_id IS NULL)
    INTO v_seats_total, v_seats_free
    FROM public.ops_seats s
    JOIN public.ops_tables t ON t.id = s.table_id
    WHERE s.tournament_id = p_tournament_id AND t.status = 'open';

  v_average_stack := COALESCE(round(v_total_chips::numeric / NULLIF(v_playing, 0))::bigint, 0);

  SELECT bl.big_blind
    INTO v_big_blind
    FROM public.ops_blind_levels bl
    JOIN public.ops_clock c
      ON c.tournament_id = bl.tournament_id AND c.current_level_sort = bl.sort
    WHERE bl.tournament_id = p_tournament_id;

  v_avg_stack_bb := COALESCE(v_average_stack::numeric / NULLIF(v_big_blind, 0), 0);

  -- [1f] 총 바이인 수 = entries + Σreentries (재진입 = 바이인 재지불, 1d 스펙이 1f 로 명시 이관)
  v_total_buyins := v_entries::bigint + v_reentries;
  v_prize_pool := v_total_buyins * COALESCE(v_buy_in_cost, 0)
                + v_total_rebuys * COALESCE(v_rebuy_cost, 0)
                + v_total_addons * COALESCE(v_addon_cost, 0);
  -- [1f] KO 풀: NULL = 비-바운티 대회(클라 카드 숨김 신호). fee_cost 는 계속 미포함(하우스 몫).
  -- [후속] ::int 다운캐스트 제거 — v_total_buyins(bigint) × v_bounty_cost(int) 는 이미 bigint.
  v_knockout_pool := CASE WHEN v_bounty_cost IS NULL THEN NULL
                          ELSE (v_total_buyins * v_bounty_cost) END;

  INSERT INTO public.ops_live_stats AS ls (
    tournament_id, playing, entries, unique_players, reentries_total,
    tables_open, seats_total, seats_free,
    total_chips, average_stack, avg_stack_bb, prize_pool, knockout_pool, updated_at
  ) VALUES (
    p_tournament_id, v_playing, v_entries, v_entries, v_reentries,
    v_tables_open, v_seats_total, v_seats_free,
    v_total_chips, v_average_stack, v_avg_stack_bb, v_prize_pool, v_knockout_pool, now()
  )
  ON CONFLICT (tournament_id) DO UPDATE SET
    playing         = EXCLUDED.playing,
    entries         = EXCLUDED.entries,
    unique_players  = EXCLUDED.unique_players,
    reentries_total = EXCLUDED.reentries_total,
    tables_open     = EXCLUDED.tables_open,
    seats_total     = EXCLUDED.seats_total,
    seats_free      = EXCLUDED.seats_free,
    total_chips     = EXCLUDED.total_chips,
    average_stack   = EXCLUDED.average_stack,
    avg_stack_bb    = EXCLUDED.avg_stack_bb,
    prize_pool      = EXCLUDED.prize_pool,
    knockout_pool   = EXCLUDED.knockout_pool,
    updated_at      = now();
END;
$function$;
