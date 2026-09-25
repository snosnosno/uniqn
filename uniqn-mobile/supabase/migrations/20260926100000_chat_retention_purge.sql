-- ============================================================================
-- 앱 내 채팅 S5-b — 보존 purge(마지막 메시지 후 1년) + 고아 사진 정리 + 신고 증거 만료
-- ============================================================================
-- 설계: docs/planning/2026-09-24-in-app-chat-design.md §14-6 S5-b · §15 D5 · D12
-- 방침: 개인정보처리방침 v1.3 제3조 4.(S5-a) — 이 크론이 그 문장을 참으로 만든다.
--
-- 한 줄: 매일 새벽 한 번, 마지막 메시지 후 1년 지난 방을 지우고(메시지·읽음·차단은 FK CASCADE),
--        그 방의 사진·어느 메시지도 가리키지 않는 24시간 지난 사진·정화 안 된 채 남은 접수함 사진을
--        삭제 큐에 넣는다. 파일 삭제는 20분 뒤 도는 EF process-scheduled-deletions 가 Storage API 로 한다.
--
--   비유: 1년 넘게 아무도 들르지 않은 방은 비우고, 주인 없는 짐(보내지 않은 사진)은 하루 지나면
--         회수 목록에 적는다. 분쟁 증거로 봉인한 짐(신고 스냅샷 사진)은 봉인이 풀릴 때까지 둔다.
--
-- 🚨 prod 데이터를 지운다 — 적용 전 dry-run 카운트를 사용자에게 보고했다(PR 본문).
--    chat_purge_expired(true) 는 아무것도 바꾸지 않고 건수만 돌려준다.
-- ⚠️ storage.objects 는 SQL DELETE 가 트리거로 금지돼 있다(Storage API 전용) → 큐 적재만 한다.
-- ⚠️ 경계는 clock_timestamp() 기준(now() = 트랜잭션 시작 시각이라 긴 트랜잭션에서 경계가 흐려진다).
--
-- 신고 증거(D12): 처리 완료(resolved·dismissed) 후 1년 또는 (미처리라도) 생성 후 2년이 지나면 chat_report_evidence 행을 지우고,
--                 그 사진이 다른 곳에서 참조되지 않으면 같은 실행에서 고아로 큐에 들어간다.
--
-- 파리티: 함수 +1(chat_purge_expired) → 245 / 106
-- ============================================================================

CREATE FUNCTION public.chat_purge_expired(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now           timestamptz := clock_timestamp();
  -- 일 수가 아니라 '1 year' — 윤년에도 방침 문구 '1년'과 같게(DB 리뷰 L3)
  v_cutoff        timestamptz := v_now - interval '1 year';   -- D5 · D12
  v_orphan_cutoff timestamptz := v_now - interval '24 hours';
  v_convs         uuid[];
  v_messages      int;
  v_evidence      int;
  v_notifs        int;
  v_media         jsonb;
BEGIN
  -- 1. 보존 만료 방 — 메시지가 한 번도 없던 방은 만든 시각 기준
  SELECT coalesce(array_agg(c.id), ARRAY[]::uuid[]) INTO v_convs
    FROM public.chat_conversations c
   WHERE coalesce(c.last_message_at, c.created_at) < v_cutoff;
  SELECT count(*)::int INTO v_messages
    FROM public.chat_messages m WHERE m.conversation_id = ANY (v_convs);

  -- 2. 신고 증거 만료 — 처리 완료 후 1년
  SELECT count(*)::int INTO v_evidence
    FROM public.chat_report_evidence e
    JOIN public.reports r ON r.id = e.report_id
   WHERE (   (r.status IN ('resolved', 'dismissed') AND coalesce(r.reviewed_at, r.updated_at) < v_cutoff)
          -- 처리되지 않은 신고도 영구 보존하지 않는다(보안 리뷰 H1·LOW-6) — 생성 후 2년 상한
          OR r.created_at < v_now - interval '2 years');

  IF NOT p_dry_run AND v_evidence > 0 THEN
    DELETE FROM public.chat_report_evidence e
     USING public.reports r
     WHERE r.id = e.report_id
       AND (   (r.status IN ('resolved', 'dismissed') AND coalesce(r.reviewed_at, r.updated_at) < v_cutoff)
            OR r.created_at < v_now - interval '2 years');
  END IF;

  -- 3. 사진 후보 — 만료 방의 사진 · 참조 없는 24시간 지난 사진 · 24시간 지난 접수함 사진.
  --    아직 봉인 중인 신고 증거 사진은 어떤 경우에도 제외(D12). dry-run 이면 2 의 만료분도
  --    아직 봉인으로 보이므로 실제 실행보다 적게 셀 수 있다(보수적).
  CREATE TEMP TABLE IF NOT EXISTS pg_temp.chat_purge_candidates (
    bucket_id text, object_name text, reason text
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.chat_purge_candidates;

  INSERT INTO pg_temp.chat_purge_candidates (bucket_id, object_name, reason)
  SELECT o.bucket_id, o.name,
         CASE WHEN split_part(o.name, '/', 1) = ANY (SELECT unnest(v_convs)::text) THEN 'retention_purge'
              ELSE 'orphan' END
    FROM storage.objects o
   WHERE o.bucket_id IN ('chat-media', 'chat-media-inbox')
     AND (
          split_part(o.name, '/', 1) = ANY (SELECT unnest(v_convs)::text)
       OR (o.created_at < v_orphan_cutoff
           AND (o.bucket_id = 'chat-media-inbox'
                OR NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.image_path = o.name)))
     )
     AND NOT EXISTS (SELECT 1 FROM public.chat_report_evidence e
                      WHERE e.snapshot -> 'imagePaths' ? o.name);

  SELECT jsonb_build_object(
           'retentionPurge', count(*) FILTER (WHERE reason = 'retention_purge'),
           'orphan', count(*) FILTER (WHERE reason = 'orphan'))
    INTO v_media FROM pg_temp.chat_purge_candidates;

  IF p_dry_run THEN
    SELECT count(*)::int INTO v_notifs FROM public.notifications n
     WHERE n.type = 'chat_message' AND n.data ->> 'conversationId' = ANY (SELECT unnest(v_convs)::text);
    RETURN jsonb_build_object('dryRun', true, 'conversations', cardinality(v_convs),
      'messages', v_messages, 'notifications', v_notifs, 'evidenceSnapshots', v_evidence, 'media', v_media);
  END IF;

  INSERT INTO public.chat_media_deletion_queue (bucket_id, object_name, reason)
  SELECT bucket_id, object_name, reason FROM pg_temp.chat_purge_candidates
  ON CONFLICT (bucket_id, object_name) DO NOTHING;

  -- 4. 만료 방 삭제 — 메시지·읽음·차단은 FK CASCADE. 방 알림(미리보기 사본)도 지운다
  --    (미읽음이면 기존 decrement 트리거가 카운터를 맞춘다).
  DELETE FROM public.notifications n
   WHERE n.type = 'chat_message' AND n.data ->> 'conversationId' = ANY (SELECT unnest(v_convs)::text);
  GET DIAGNOSTICS v_notifs = ROW_COUNT;
  -- 목록을 뽑은 뒤 그 사이에 새 메시지가 온 방은 지우지 않는다(경계 재확인 — DB 리뷰 L2)
  DELETE FROM public.chat_conversations c
   WHERE c.id = ANY (v_convs) AND coalesce(c.last_message_at, c.created_at) < v_cutoff;

  RETURN jsonb_build_object('dryRun', false, 'conversations', cardinality(v_convs),
    'messages', v_messages, 'notifications', v_notifs, 'evidenceSnapshots', v_evidence, 'media', v_media);
END;
$$;

COMMENT ON FUNCTION public.chat_purge_expired(boolean) IS
  '채팅 보존 purge(D5 — 마지막 메시지 후 1년) · 고아 사진(24시간) · 신고 증거 만료(D12). '
  '사진은 chat_media_deletion_queue 에 적재만 하고 EF 가 Storage API 로 지운다. '
  'p_dry_run=true 면 아무것도 바꾸지 않고 건수만 돌려준다. 크론(postgres) 전용.';

-- SECDEF 하드닝 — 크론(postgres)과 service_role 만. 클라이언트 롤은 실행 불가
REVOKE ALL ON FUNCTION public.chat_purge_expired(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_purge_expired(boolean) TO service_role;

-- ----------------------------------------------------------------------------
-- 크론 — 매일 KST 01:53(UTC 16:53). 20분 뒤 process-scheduled-deletions(UTC 17:13)가 큐를 비운다.
-- ----------------------------------------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chat-retention-purge') THEN
    PERFORM cron.unschedule('chat-retention-purge');
  END IF;

  PERFORM cron.schedule(
    'chat-retention-purge',
    '53 16 * * *',
    $cron$ SELECT public.chat_purge_expired(); $cron$
  );
EXCEPTION
  -- 로컬 Docker 에 pg_cron 이 없을 때 db:reset 이 통째로 실패하지 않게(20260813110000 선례)
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[chat S5-b] pg_cron 미설치 — 보존 purge 크론 skip (함수는 생성됨)';
END $do$;
