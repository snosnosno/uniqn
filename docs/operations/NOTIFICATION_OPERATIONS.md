# 알림 시스템 운영 가이드

> 최종 검증: 2026-07-05 (Supabase 현행화 재작성 — 구 Firebase 시절 문서 대체)

기준 코드: `uniqn-mobile/supabase/functions/`, `uniqn-mobile/supabase/migrations/`, `docs/reference/API_REFERENCE.md`
검증 방식: Edge Function 디렉터리 실측(`ls`) + 마이그레이션 원문 확인 + `npx supabase --help` CLI 서브커맨드 실측(구 문서의 `functions logs` 명령이 **현재 CLI에 없음**을 확인 후 대체 경로로 교체).

## 1. 아키텍처 한눈에

알림은 전부 `public.notifications` 테이블 INSERT를 단일 관문으로 흐른다. `notification_outbox` 같은 별도 아웃박스 테이블은 **존재하지 않는다**.

```
[이벤트 발생]
  applications / work_logs / job_postings / reviews / reports /
  inquiries / workspace_invitations 등 테이블 변경
        │  (테이블별 AFTER trigger, notify_on_* 함수)
        ▼
  public.notifications  INSERT  ◀── send-system-announcement /
        │                            send-job-posting-announcement
        │                            (관리자가 공지 발송 시 직접 대량 INSERT)
        │
        ├─▶ notification_counter_triggers (INSERT/UPDATE/DELETE)
        │     → notification_counters 미읽음 카운터 동기화
        │
        ▼  AFTER INSERT, FOR EACH STATEMENT (REFERENCING NEW TABLE)
  트리거 on_notification_created_send_push
    (함수 trigger_send_push_notification, 1 INSERT문 = 1 HTTP 호출·배치)
        │  pg_net.http_post
        │  Authorization: Bearer <vault.service_role_key>
        ▼
  Edge Function send-push-notification
    1) notificationIds로 notifications 재조회
    2) notification_settings.push_enabled/enabled = false → 스킵
    3) fcm_tokens에서 수신자 토큰 조회 (type='expo'만 발송, 'fcm'은 스킵)
    4) expo-server-sdk로 Expo Push API 발송
    5) DeviceNotRegistered 티켓 → fcm_tokens에서 토큰 자동 삭제
```

- fire-and-forget: 트리거 내부는 `EXCEPTION WHEN OTHERS`로 감싸 push 실패가 notifications INSERT 자체를 막지 않는다.
- `initialize-unread-counter` / `decrement-unread-counter` / `reset-unread-counter`는 위 흐름과 별개로 **앱이 직접 invoke**하는 카운터 보정용 Edge Function이다(트리거 경유 아님).

## 2. 실존 Edge Function (알림 관련, kebab-case)

| 함수명 | 경로 | 역할 |
|---|---|---|
| `send-push-notification` | `supabase/functions/send-push-notification/` | notifications INSERT 트리거가 호출. Expo Push 실제 발송 |
| `send-system-announcement` | `supabase/functions/send-system-announcement/` | admin 전용. `announcements` 테이블 row 기준 전체(또는 role 필터) 대상 notifications 대량 INSERT |
| `send-job-posting-announcement` | `supabase/functions/send-job-posting-announcement/` | 특정 공고 대상 인원에게 notifications 대량 INSERT |
| `initialize-unread-counter` | `supabase/functions/initialize-unread-counter/` | `notification_counters` 초기화 |
| `decrement-unread-counter` | `supabase/functions/decrement-unread-counter/` | `notification_counters` 감소 |
| `reset-unread-counter` | `supabase/functions/reset-unread-counter/` | `notification_counters` 재설정 |

위 6개 외 `supabase/functions/`에 실존하는 함수(참고용, 알림과 무관): `approve-job-posting`, `reject-job-posting`, `resubmit-job-posting`, `cleanup-orphan-accounts`, `process-scheduled-deletions`, `sync-schedule-board-outbox`, `verify-portone-identity`, `verify-and-save-portone-profile`, `revoke-apple-token`. **`sendSystemAnnouncement` 등 camelCase 이름은 존재하지 않는다** — 전부 kebab-case.

## 3. 운영 명령

배포는 GitHub Actions `deploy-edge-functions.yml`가 **master 브랜치에 `supabase/functions/**` 변경 push 시 자동 실행**한다(project-ref `ygfxukhktpqymahfrvbz`). 로컬 수동 배포/조회는 아래로 검증됨(`npx supabase --help`, `npx supabase functions deploy --help` 실행 결과 기준):

```bash
cd uniqn-mobile

# 배포 목록 조회
npx supabase functions list --project-ref ygfxukhktpqymahfrvbz

# 수동 재배포(단일 함수)
npx supabase functions deploy send-push-notification --project-ref ygfxukhktpqymahfrvbz

# 전체 함수 강제 재배포는 GitHub Actions 수동 트리거 사용
gh workflow run deploy-edge-functions.yml -f function_name=all
```

**주의(중요 정정)**: 구 문서·`TROUBLESHOOTING.md`에 있던 `supabase functions logs <함수명>` 명령은 **현재 Supabase CLI(2.109.0)에 `logs` 서브커맨드 자체가 없어 실행 시 실패한다**(`supabase functions --help` 서브커맨드: `list`/`delete`/`download`/`deploy`/`new`/`serve`뿐). 로그 확인은 다음 경로만 유효하다:
- Supabase Dashboard → Edge Functions → 함수 선택 → Logs 탭
- Claude 세션 내에서는 `mcp__supabase__get_logs` (service: `edge-function`)

## 4. 장애 대응 — 푸시가 안 갈 때 점검 순서

1. `public.notifications`에 레코드가 실제 INSERT됐는지 확인 (Dashboard Table Editor 또는 SQL).
2. 수신자 `notification_settings.push_enabled` / `enabled`가 `false`가 아닌지 확인 — 둘 중 하나라도 false면 `send-push-notification`이 의도적으로 스킵.
3. 수신자 `fcm_tokens`에 `type='expo'` 토큰이 살아있는지 확인. `type='fcm'` 토큰은 Phase 1에서 발송 대상이 아니다(스킵 후 warning 로그만 남김).
4. 트리거 실존 여부는 **마이그레이션 파일이 아니라 실측**으로 확인:
   ```sql
   SELECT pg_get_triggerdef(oid) FROM pg_trigger
   WHERE tgrelid = 'public.notifications'::regclass AND NOT tgisinternal;

   SELECT pg_get_functiondef('public.trigger_send_push_notification'::regprocedure);
   ```
5. pg_net 호출 결과 확인: `SELECT id, status_code, content::text FROM net._http_response ORDER BY created DESC LIMIT 5;` — `status_code=401`이면 vault의 `service_role_key`가 Edge Function 환경변수와 불일치(형식: `sb_secret_`로 시작하는 41자 — 과거 legacy JWT `eyJ...` 219자를 잘못 넣어 전체 발송이 401로 폐기된 사고 이력 있음).
6. `send-push-notification` 자체는 `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` 불일치 시 401 반환 — service_role 키가 아닌 호출(anon 등)은 차단이 정상 동작이다.

## 5. 알려진 함정 — 트리거 중복으로 인한 2배 발송 (2026-06, PR #186)

`work_logs` UPDATE에 대해 **같은 함수** `notify_on_work_log_checkinout_update()`를 호출하는 트리거가 두 개 공존한 적이 있다:
- `tr_notify_work_log_checkinout` (신, `AFTER UPDATE OF check_in_ts, check_out_ts`)
- `work_log_notify_checkinout_update` (구, `AFTER UPDATE` 전체 — 신규 마이그레이션이 **DROP을 누락**)

신규 마이그레이션이 함수를 `CREATE OR REPLACE`하며 새 트리거를 추가했지만 구 트리거를 지우지 않아 같은 함수가 2번 실행 → notifications 2배 INSERT → 푸시 2건 발송. 트리거를 새 이름으로 재작성할 때는 **반드시 구 이름 `DROP TRIGGER IF EXISTS`를 동반**해야 한다. 발송 경로 의심 시 `pg_get_triggerdef` / `pg_get_functiondef` 실측이 마이그레이션 파일을 읽는 것보다 정확하다(파일은 누적되므로 최신 트리거가 뭔지 파일만으로 판단 불가).

## 6. 관련 문서

- `docs/reference/API_REFERENCE.md`
- `docs/operations/TROUBLESHOOTING.md`
- `uniqn-mobile/docs/PUSH_NOTIFICATION_TEST_CHECKLIST.md`
- `.github/workflows/deploy-edge-functions.yml`
