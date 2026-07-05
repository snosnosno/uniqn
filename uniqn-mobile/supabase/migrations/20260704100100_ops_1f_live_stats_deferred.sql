-- OPS 1f M2 — live_stats 재계산 산식 확장(재진입 가산·knockout_pool) + AFTER ROW → CONSTRAINT TRIGGER
--   DEFERRABLE INITIALLY DEFERRED 전환(D6 — TODOS [MED] LS-매개 데드락 해소) + ops_tournaments 비용 트리거 신설.
-- 데드락 해소 논증: DEFERRED 로 LS 행 락 획득이 항상 커밋 직전 최후 → 모든 txn 에서
--   {advisory, 대회, 참가자, 좌석} < LS 전역 순서 성립 → bust 의 LS<{S,P_winner} 역전 및
--   (P,S)→LS(rebuy/addon/좌석/claim/redraw) ABBA 순환 근원 제거 (1d 스펙 §14).
-- ⚠️ CREATE OR REPLACE TRIGGER 는 constraint trigger 미지원 → DROP 후 CREATE 필수.
-- ⚠️ 기존 래퍼 fn_ops_live_stats_recompute_trigger() 는 NEW.tournament_id 참조 →
--   ops_tournaments(PK=id) 에는 전용 래퍼 신설(fn_..._tournaments, NEW.id 사용).

-- ═══ A. 재계산 본체 교체 (CREATE OR REPLACE — 시그니처 불변, 기존 REVOKE 보존) ═══
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
  v_knockout_pool int;
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
  v_knockout_pool := CASE WHEN v_bounty_cost IS NULL THEN NULL
                          ELSE (v_total_buyins * v_bounty_cost)::int END;

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

-- ═══ B. ops_tournaments 전용 트리거 래퍼 (기존 래퍼는 NEW.tournament_id 참조 → PK=id 인 이 테이블 불가) ═══
CREATE OR REPLACE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  PERFORM public.fn_ops_recompute_live_stats(NEW.id);
  RETURN NEW;
END;
$function$;

-- 신규 트리거 함수 즉시 REVOKE (1a 교훈: SECDEF trigger fn 미회수 시 advisor WARN)
REVOKE EXECUTE ON FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments() FROM PUBLIC, anon, authenticated;

-- ═══ C. 기존 5종 AFTER ROW → CONSTRAINT TRIGGER DEFERRED 재생성 (동일 이벤트·WHEN 보존) ═══
DROP TRIGGER IF EXISTS trg_ops_participants_recompute_stats ON public.ops_participants;
CREATE CONSTRAINT TRIGGER trg_ops_participants_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_participants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_seats_recompute_stats ON public.ops_seats;
CREATE CONSTRAINT TRIGGER trg_ops_seats_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_seats
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_tables_recompute_stats ON public.ops_tables;
CREATE CONSTRAINT TRIGGER trg_ops_tables_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_tables
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_blind_levels_recompute_stats ON public.ops_blind_levels;
CREATE CONSTRAINT TRIGGER trg_ops_blind_levels_recompute_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ops_blind_levels
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

DROP TRIGGER IF EXISTS trg_ops_clock_recompute_stats ON public.ops_clock;
CREATE CONSTRAINT TRIGGER trg_ops_clock_recompute_stats
  AFTER UPDATE ON public.ops_clock
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.current_level_sort IS DISTINCT FROM NEW.current_level_sort)
  EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger();

-- ═══ D. ops_tournaments 비용 트리거 신설 — 비용 config 변경 시 prize_pool/knockout_pool stale 창 해소.
--       WHEN 은 산식 사용 4컬럼만(fee_cost 는 recompute 미사용이라 제외 — 불필요 발화 방지). ═══
DROP TRIGGER IF EXISTS trg_ops_tournaments_recompute_stats ON public.ops_tournaments;
CREATE CONSTRAINT TRIGGER trg_ops_tournaments_recompute_stats
  AFTER UPDATE ON public.ops_tournaments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.buy_in_cost IS DISTINCT FROM NEW.buy_in_cost
     OR OLD.rebuy_cost  IS DISTINCT FROM NEW.rebuy_cost
     OR OLD.addon_cost  IS DISTINCT FROM NEW.addon_cost
     OR OLD.bounty_cost IS DISTINCT FROM NEW.bounty_cost)
  EXECUTE FUNCTION public.fn_ops_live_stats_recompute_trigger_tournaments();

-- ═══ E. backfill — 신산식 반영(멱등. prod 0행이지만 로컬 기존 데이터 정합) ═══
SELECT public.fn_ops_recompute_live_stats(id) FROM public.ops_tournaments;
