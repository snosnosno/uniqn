# 앱 내 채팅(메시지) 설계 — 출시 과제 #2

> 상태: **설계 초안 — 사용자 승인 대기** (코드 0줄). 출처: `docs/planning/2026-09-23-launch-readiness-handoff.md` §4-2.
> 작성: 2026-09-24 · 워크트리 `T-HOLDEM-chat` / 브랜치 `docs/in-app-chat-design` (base `89eff192b`)
> 설계 판정: architect(fable) 위임 → 메인 세션이 미확인 항목 4건 직접 검증(§0-2).

## 한 줄 결론

**공고 × 스태프 1:1 방**을 만들고, 구인자 측 참여자는 **방에 명부를 두지 않고 매번 기존 권한 헬퍼로 판정**하며, 알림은 **기존 `notifications` 파이프라인에 방 단위로 묶어** 태운다. 새 탭·새 enum 값·새 네이티브 모듈 없이 **runtime 1.0.7 OTA** 로 나간다.

비유: 방마다 출입 명부를 따로 적는 대신, **공고라는 건물의 출입증(기존 협업자·워크스페이스 권한)을 문 앞에서 매번 확인**한다. 협업자를 해제하면 출입증이 사라지므로 다음 조회부터 바로 못 들어온다 — 명부를 고치는 걸 잊어 해제된 사람이 계속 읽는 사고가 구조적으로 생기지 않는다.

---

## 0. 전제와 검증

### 0-1. 실측 기준값 (2026-09-24)

| 항목 | 값 | 근거 |
|---|---|---|
| prod public 함수 / 정책 | **226 / 102** | `execute_sql` 11:37 UTC · `parity_baseline_guard.test.sql:263-264` 마커 일치 |
| 채팅·차단 류 테이블 | 0 | prod `pg_tables` ILIKE chat/conversation/message/block |
| realtime publication | 17 테이블 | prod `pg_publication_tables` |
| prod 공고 수 | 45 (regular 30 · urgent 14 · tournament 1) | prod `job_postings` 집계 |
| 계측 CHECK 값 | **17종** (증거 초안의 16 은 오기) | `20260923100000…sql:72-90` |
| 탈퇴 유예 | 30일 | `src/services/auth/accountDeletionService.ts:24` |

### 0-2. architect 미확인 항목 — 메인 세션 직접 검증 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| 1.0.6 이 미등록 알림 타입 푸시를 탭하면 크래시? | **안 난다.** `routeGenerator ? … : null` 가드 존재 → 매핑 없으면 `link` 로 이동 | `git show ota/1.0.6-production:…/deepLinkNavigationExecutor.ts:165-166` · 탭 핸들러는 원본 type 문자열 전달 `usePushNotificationSetup.ts:187,201` |
| 1.0.6 포그라운드 수신 시 미등록 타입 | `ANNOUNCEMENT` 로 정규화됨 → 그 라우트는 `announcementId` 없으면 `notices`(파라미터 0) → **link(파라미터 1)가 이긴다** | 1.0.6 `notificationMessageNormalizer.ts:293-296` · `NotificationRouteMap.ts:92-95` · 파라미터 수 비교 규칙 |
| 고정 공고의 `last_work_date` NULL? | prod 에 NULL 은 **`container` 4건뿐**, 고정 공고 0건. 그래도 NULL 분기 규칙을 둔다(§2) | prod 집계 |
| `send_job_posting_announcement` 최신 정의 | `20260813140000` **단 1개** — 재정의 베이스 확정 | `grep -l` migrations |

### 0-3. 새로 드러난 계약 (구현이 놓치면 CI red)

- **`dbNotificationTypeDrift.test.ts`**: DB(마이그)가 발송하는 알림 type 은 전부 클라 `NotificationType` enum 에 있어야 한다. → **서버 PR(S1)이 `chat_message` 를 발송하면 같은 PR 에서 클라 enum·`typeCategoryMap` 사본을 함께 등록**해야 한다.
- **`typeCategoryMapDrift`**: 클라 SSOT ↔ EF `typeCategoryMap.ts` 1:1.
- 기존 **확정자 일괄 공지 RPC** `send_job_posting_announcement` 가 이미 있다(`20260813140000:73-186`, 단일 INSERT 팬아웃 · 60초 연타 방어 · manager 협업자까지) → "D-7 변경 공지" 수요는 이미 흡수되어 있다.
- 구인자 측 "처리 요구 알림" 수신자 선례 = 공고 owner ∪ 워크스페이스 owner·editor ∪ **manager** 협업자(viewer 제외) — `20260813170000:52-67,111-122`.
- EF 카테고리 게이트는 **DB enum 이 아니라 `TYPE_CATEGORY_MAP` 문자열**로 판정, 미매핑=허용(`send-push-notification/index.ts:130-131`) → enum `ADD VALUE`(불가역) 불필요.

---

## 1. 범위 · MVP 경계

| 선택지 | 장점 | 단점 |
|---|---|---|
| **A. 1:1 만 (공고 × 스태프)** ✅추천 | 권한·RLS 단순, 스태프 간 개인정보(이름·번호) 상호 노출 0 | 공지 수요는 기존 공지 RPC 에 의존 |
| B. 1:1 + 공고 단체방 | 공지+질의응답 한 곳 | 스태프끼리 서로 보임(개인정보·잡담·분쟁) · 수십 명 RLS·푸시 폭증 · 방 수명 관리 |
| C. 1:1 + 일괄 공지를 각 1:1 방에 팬아웃 | 공지에 스태프가 맥락 그대로 답장 | 공지 RPC 재정의 필요, 방이 확정자 수만큼 생성 |

**추천: MVP=A, 2단계(S4)에 C.** C 는 `send_job_posting_announcement` 를 `20260813140000` 기준으로 재정의해 같은 트랜잭션에서 각 확정자 1:1 방에 `kind='announcement'` 메시지를 **한 문장 `INSERT…SELECT`** 로 추가한다. 알림은 기존 `posting_announcement` 1건만(채팅 알림 이중 발송 금지).

> 🧑 **결정 D1**: 스태프 간 노출 단체방을 **영구 비채택**할지 · C 를 MVP 에 넣을지(추천: 넣지 않음).

---

## 2. 대화 개설 조건 · 수명

| 축 | 추천 | 이유 |
|---|---|---|
| 개설 가능 시점 | **지원서(applications 행)가 있으면** (applied 포함) | 확정 전 조율("주차 되나요") 수요. `applications UNIQUE(job_posting_id, applicant_id)` 라 대화 키와 1:1 |
| 먼저 말 걸기 | **구인자 측: applied 부터 · 스태프: confirmed 부터.** applied 스태프는 구인자가 연 방에서 답장만 | D-7 대회 지원자 100명이 사장에게 선제 메시지를 쏟는 것 방지 |
| 거절·취소 | `rejected`·`cancelled` → **즉시 읽기 전용**(이력 보존) · `cancellation_pending` → 쓰기 허용 | 취소 협의에 대화가 필요 |
| 근무 후 | **공고 status 와 분리, 날짜 창**: `last_work_date + 14일` 까지 쓰기 | closed 크론(+2일)에 묶으면 정산 문의가 막힌다 |
| `last_work_date` NULL | 지원 상태가 활성(applied/confirmed/cancellation_pending)인 동안 쓰기 | 현재 prod 고정 공고 0건이지만 fail-closed 분기 필요 |
| 공고 `cancelled` | 읽기 전용 | |
| 공고 `container` | **개설 거부** | 운영처용 숨김 공고(`statusValues.ts:47-48`) |

**"읽기 전용"은 저장하지 않고 매번 계산**한다 — 전송 RPC 와 목록 RPC 가 같은 내부 헬퍼 `chat_write_state()` 로 판정. 거절은 클라 직접 update 경로라 저장형이면 별도 트리거가 필요하지만 계산형이면 필요 없다.

> 🧑 **결정 D2**: 쓰기 창 N=14일 · applied 스태프 선제 발신 금지 여부.

---

## 3. 권한 (핵심)

### 3-1. 구인자 측 참여자 표현

| 선택지 | 장점 | 단점 |
|---|---|---|
| P. 사람마다 participant 행 | 행에 unread·뮤트를 바로 둘 수 있음, RLS 한 줄 | jpc·workspace_members·workspaces.owner 변경마다 **동기화 트리거 3종+** — 하나 빠지면 **해제된 사람이 계속 읽는 fail-open** |
| **D. 방은 `job_posting_id` 만, 매번 동적 판정** ✅추천 | 해제 즉시 반영 · fail-closed · 기존 헬퍼 재사용(S3-4 가 헬퍼 의미를 좁혀 19곳을 한 번에 닫은 방식, `20260813150000:16-31`) | 행당 헬퍼 호출 비용(현 규모 무시 가능) · 구인자 측 unread 는 커서로 계산 |

### 3-2. 누가 구인자 측인가

| 범위 | 읽기 | 쓰기 |
|---|---|---|
| 공고 owner · 워크스페이스 owner/editor · **manager** 협업자 | ✅ | ✅ |
| **viewer** 협업자 | ❌ (MVP) | ❌ |
| admin | ❌ — **신고된 메시지 스냅샷만** | ❌ |

viewer 를 제외하는 이유: 1:1 자유 텍스트는 노쇼 횟수보다 민감하다(번호·사정이 섞인다). 좁게 시작하면 넓히기 쉽고 반대는 어렵다. 넓힐 때는 S3-4 방식 그대로 **읽기 헬퍼만** `_any` 로 바꾼다.

### 3-3. 스태프에게 보이는 발신자

방 제목 = **업장명**, 말풍선마다 **보낸 사람 이름**(작게). 구인자 측이 여러 명이라 "누가 말했나"가 필요하다. `users` RLS 가 본인 전용이라 **전송 시점 스냅샷**으로 저장(`applications.applicant_name` 선례).
⚠️ 업장명 필드는 **S2 착수 시 확정**: 스태프 공고 상세가 쓰는 필드(`workspaces.name` vs `job_postings.owner_name`)와 같은 값을 쓴다.

### 3-4. 헬퍼 · RLS 스케치 (재귀 없음)

```sql
-- 구인자 측 판정. NULL fail-open 차단: owner_id 는 탈퇴 시 NULL 이 된다(20260807150000)
CREATE FUNCTION public.chat_is_employer_side(p_posting_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_owner uuid; v_ws uuid;
BEGIN
  IF p_posting_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  SELECT owner_id, workspace_id INTO v_owner, v_ws FROM public.job_postings WHERE id = p_posting_id;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN (v_owner IS NOT NULL AND v_owner = p_user_id)
      OR public.is_workspace_member(v_ws, p_user_id)          -- ws owner OR editor
      OR public.is_posting_collaborator(p_posting_id, p_user_id); -- manager 전용(좁은 헬퍼)
END $$;

CREATE FUNCTION public.chat_is_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_posting uuid; v_staff uuid;
BEGIN
  IF p_conversation_id IS NULL OR p_user_id IS NULL THEN RETURN false; END IF;
  SELECT job_posting_id, staff_id INTO v_posting, v_staff
    FROM public.chat_conversations WHERE id = p_conversation_id;  -- SECDEF → RLS 우회, 재귀 없음
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN (v_staff IS NOT NULL AND v_staff = p_user_id)
      OR public.chat_is_employer_side(v_posting, p_user_id);
END $$;
-- 둘 다: REVOKE ALL ON FUNCTION … FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role;
```

### 3-5. RLS 매트릭스

| 테이블 | anon | staff 당사자 | 구인자 측(owner/ws/manager) | viewer 협업자 | 제3자 authenticated | admin | service_role |
|---|---|---|---|---|---|---|---|
| `chat_conversations` SELECT | ❌ GRANT 없음 | ✅ `staff_id = uid` | ✅ `chat_is_employer_side` | ❌ | ❌ | ❌ | ✅ |
| `chat_messages` SELECT | ❌ | ✅ `chat_is_member` | ✅ `chat_is_member` | ❌ | ❌ | ❌(신고 스냅샷만) | ✅ |
| `chat_read_states` SELECT | ❌ | 본인 행 | 본인 행 | ❌ | ❌ | ❌ | ✅ |
| `chat_blocks` SELECT (S4) | ❌ | 자기 방 | 자기 공고 | ❌ | ❌ | ❌ | ✅ |
| 모든 테이블 INSERT/UPDATE/DELETE | ❌ | ❌ **정책 없음 = RPC 전용** | ❌ | ❌ | ❌ | ❌ | ✅ |

- 정책 전부 **`TO authenticated`** (PUBLIC 이면 anon 42501 poison — wiki rls-model 함정 1).
- `auth.uid()` 는 `(SELECT auth.uid())` 로 감싼다(initPlan, `20260813140000:58-59` 선례).
- 테이블 GRANT 는 `SELECT` 만 `authenticated` 에 **명시**(wiki test-db-grants).
- 재귀 방지: 정책은 자기 테이블을 inline SELECT 하지 않는다 — 멤버십은 전부 plpgsql SECDEF 헬퍼 경유(함정 2·3).

> 🧑 **결정 D3**: viewer 제외 · admin 원문 열람 불가(신고 스냅샷만) · 발신자 표시(업장명+보낸 사람 이름).

---

## 4. 스키마 초안

```sql
CREATE TABLE public.chat_conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id        uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  staff_id              uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- 탈퇴 시 NULL
  staff_display_name    text NOT NULL,   -- applications.applicant_name 스냅샷
  employer_display_name text NOT NULL,   -- 업장명 스냅샷(§3-3)
  created_by            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at       timestamptz,
  last_message_id       uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conv_posting_staff_uq UNIQUE (job_posting_id, staff_id)
);
CREATE INDEX chat_conv_staff_idx   ON public.chat_conversations (staff_id, last_message_at DESC);
CREATE INDEX chat_conv_posting_idx ON public.chat_conversations (job_posting_id, last_message_at DESC);

CREATE TABLE public.chat_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_side         text NOT NULL CHECK (sender_side IN ('staff','employer','system')),
  sender_display_name text NOT NULL,
  kind                text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','announcement','system')),
  body                text NOT NULL,
  client_message_id   uuid NOT NULL,                  -- 재전송 멱등키
  created_at          timestamptz NOT NULL,           -- RPC 가 잠금 획득 후 clock_timestamp()
  deleted_at          timestamptz,
  CONSTRAINT chat_msg_body_chk CHECK (
    (deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 1000)
    OR (deleted_at IS NOT NULL AND body = ''))
);
CREATE UNIQUE INDEX chat_msg_idem_uq ON public.chat_messages (conversation_id, client_message_id);
CREATE INDEX chat_msg_conv_time_idx  ON public.chat_messages (conversation_id, created_at DESC, id DESC);
CREATE INDEX chat_msg_sender_idx     ON public.chat_messages (sender_id);   -- 탈퇴 익명화 스캔
CREATE TRIGGER chat_messages_xss_check BEFORE INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_xss_fields('body');         -- 범용 함수 재사용, 함수 +0

CREATE TABLE public.chat_read_states (
  conversation_id      uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at         timestamptz NOT NULL DEFAULT '-infinity',
  last_read_message_id uuid,
  muted_until          timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 푸시 묶기(§6): 방 단위 미읽음 알림 1행
CREATE UNIQUE INDEX notifications_chat_unread_collapse
  ON public.notifications (recipient_id, ((data->>'conversationId')))
  WHERE type = 'chat_message' AND is_read = false;

-- S4
CREATE TABLE public.chat_blocks (
  job_posting_id  uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  staff_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_by_side text NOT NULL CHECK (blocked_by_side IN ('staff','employer')),
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_posting_id, staff_id)
);
```

**FK ON DELETE 가 탈퇴 크론의 생사를 가른다.** `permanently_delete_user` 는 `DELETE FROM public.users` 를 한다(`20260807150000:132`). 채팅 FK 하나라도 NO ACTION 이면 **채팅 이력 있는 사용자는 영원히 탈퇴 실패** — EF 가 행 단위 예외를 삼켜 "매일 돌지만 처리 0" 이 재현된다. 그래서 발신자·스태프 쪽은 `SET NULL`, 읽음 상태는 `CASCADE`.

**시간 순서 결함 방지.** 전송 RPC 는 방 키로 `pg_advisory_xact_lock` 을 잡은 **뒤** `clock_timestamp()` 로 `created_at` 을 채운다. `now()` 는 트랜잭션 시작 시각이라, 잠금 대기 중 늦게 커밋된 메시지가 더 이른 시각을 가져 **읽음 커서가 건너뛰는 "안 읽음 누락"** 이 생긴다.

### RPC (전부 SECDEF · `search_path = public, pg_temp` · PUBLIC/anon EXECUTE 회수)

| RPC | 시그니처 | 게이트(순서대로) |
|---|---|---|
| `chat_send_message` **VOLATILE** | `(p_job_posting_id uuid, p_staff_id uuid, p_body text, p_client_message_id uuid) → jsonb {conversationId, messageId, createdAt, deduped, created}` | ① `auth.uid() IS NULL` → 거부 ② trim 후 1~1000자, client id NOT NULL ③ 공고 존재·`container` 아님 ④ 쪽 판정: 호출자=p_staff_id → staff / `chat_is_employer_side` → employer / 둘 다·둘 다 아님 → 거부 ⑤ 지원서 존재 ⑥ `chat_write_state` ≠ ok → `CHAT_READ_ONLY:<사유>` ⑦ (S4) 차단 ⑧ `check_user_rate_limit(uid,'chat_send',30,60)` → `CHAT_RATE_LIMITED` ⑨ advisory lock ⑩ 방 upsert(첫 메시지와 원자) ⑪ 멱등 충돌 시 기존 행의 sender 가 호출자인지 확인 후 반환, 알림 생략 ⑫ INSERT(`clock_timestamp()`) ⑬ 방 last_message_* · 보낸 사람 커서 전진 ⑭ 알림(§6) |
| `chat_mark_read` | `(p_conversation_id uuid, p_last_message_id uuid) → void` | uid NULL 선검사 → `chat_is_member` → 커서 전진만(`GREATEST`) → 이 방 `chat_message` 알림 `is_read=true`(기존 decrement 트리거가 카운터 처리) |
| `chat_list_conversations` STABLE | `(p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL) → TABLE(conversation_id, job_posting_id, posting_title, counterpart_name, my_side, last_message_at, last_message_preview, unread_count, write_state)` | uid NULL 선검사. 미리보기는 LATERAL 로 계산(사본 저장 안 함) |
| `chat_unread_total` STABLE | `() → integer` (99 캡) | uid NULL 선검사 |
| `chat_write_state` (내부) | `(p_job_posting_id uuid, p_staff_id uuid, p_side text) → text` | authenticated EXECUTE 도 회수 |
| S4: `chat_set_muted` · `chat_block` · `chat_unblock` · `chat_report_message` | `(p_conversation_id uuid, …)` | 멤버 확인 후 |

- `check_user_rate_limit` 은 service_role EXECUTE 전용이라 SECDEF 안에서만 호출 가능, 호출 RPC 는 **VOLATILE 필수**(STABLE 이면 카운트가 조용히 누락 — `20260719061931:25-27`).
- 커스텀 예외 `CHAT_READ_ONLY`·`CHAT_RATE_LIMITED`·`CHAT_BLOCKED` 는 `handleSupabaseError` 에 **개별 매핑**(wiki supabase-write-pitfalls).

---

## 5. 실시간 · 읽음 · 오프라인

| 선택지 | 장점 | 단점 |
|---|---|---|
| **postgres_changes** ✅추천 | 기존 `createRealtimeSubscription` 그대로(`supabase.ts:501-623`) · RLS 자동 적용 · 헬퍼 기반 정책 테이블(applications)이 이미 publication 에 있음 | 변경마다 구독자별 RLS 평가(대규모 병목 — 현재 공고 45건 규모에선 무관) |
| broadcast(private) | 확장성 | Realtime Authorization(`realtime.messages` 정책)+송신 트리거 필요, 사용처 0, **public 밖 정책이라 파리티 가드 사각지대** |

- 방 화면에서만 `('chat_messages', 'conversation_id=eq.<id>')` 구독. `chat_messages` 를 publication 에 **명시 등록**(17→18).
- **"콜백은 invalidateQueries 만" 규칙 유지(R1 추천)**: 쿼리를 `['chat','messages',id,'tail']`(내 최신 메시지 이후분만) 과 과거 페이지 infinite query 로 분리, 콜백은 tail 키만 무효화. R2(`setQueryData` 예외)는 규칙 개정이 필요해 비추천.
- 목록·배지: 채팅 전역 채널을 새로 열지 않는다 — 전송 RPC 가 수신자 `notifications` 행을 INSERT/UPDATE 하므로 **기존 notifications 구독**의 무효화 대상에 `['chat','list']`·`['chat','unread']` 추가.
- 안 읽은 수: **커서 방식**(`last_read_at` + `(created_at,id)` 비교). 카운터 컬럼은 §3-1 D 에서 구인자 측에 증가시킬 행이 없어 성립 불가. `notification_counters`·unread EF 3종과 **분리** — 채팅 unread 진실원은 `chat_unread_total`, 종 아이콘 배지는 방 단위로 묶인 알림 1행만 센다.
- 읽음 표시 의미: 스태프 화면의 "읽음" = **구인자 측 누군가 읽음**(동적 멤버십의 파생 의미).
- **오프라인 큐 없음**("큐잉은 존재하지 않는 기능" 원칙 유지): 실패 말풍선은 메모리 상태 + "재전송" 버튼, 재전송은 **같은 `client_message_id`** 로 중복 불가. 오프라인이면 입력창 비활성 + 기존 `OfflineStatusBar`.

> 🧑 **결정 D7**: R1(규칙 유지) 채택 확인.

---

## 6. 푸시

| 선택지 | 판단 |
|---|---|
| **① notifications 에 넣되 방 단위 collapse** ✅ | 기존 트리거·EF·설정 게이트·purge·배지 카운터 재사용 |
| ② notifications 우회, EF 직접 호출 | EF 개조 필요(현재 notifications id 만 받음), 설정 게이트 재구현 |
| ③ 메시지마다 넣고 목록에서 제외 | 메시지 수만큼 푸시, 카운터 트리거 3경로 전부 예외 처리 |

전송 RPC 안 두 문장:

```sql
-- (a) 5분 넘게 안 읽힌 행은 지워 새 푸시를 허용(decrement/increment 트리거 대칭)
DELETE FROM notifications WHERE type='chat_message' AND recipient_id = ANY(v_recipients)
   AND data->>'conversationId' = v_conv::text AND is_read = false
   AND created_at < clock_timestamp() - interval '5 minutes';
-- (b) 한 문장 팬아웃. 5분 안 연속 메시지는 UPDATE 로 흡수(푸시 없이 미리보기만 교체)
INSERT INTO notifications (recipient_id, type, category, title, body, link, data, priority)
SELECT … FROM unnest(v_recipients) …
ON CONFLICT (recipient_id, ((data->>'conversationId'))) WHERE type='chat_message' AND is_read=false
DO UPDATE SET body = EXCLUDED.body, data = EXCLUDED.data;
```

- 결과: 안 읽힌 상태면 **방·수신자당 최대 5분에 1회** 푸시, 읽은 뒤 온 메시지는 즉시.
- ⚠️ **pgTAP 으로 고정할 가정**: `INSERT … ON CONFLICT DO UPDATE` 에서 INSERT STATEMENT 트리거의 transition table(`new_rows`)에는 **실제 삽입된 행만** 들어간다(PG 문서상 갱신 행은 UPDATE 트리거 쪽). "UPDATE 경로 EF 호출 0회"를 `push_batching.test.sql` 형태로 단언.
- 수신자 = §3-2 집합 − 보낸 사람 − 뮤트. 한 문장 → EF 1회(STATEMENT 트리거).
- **category**: enum ADD VALUE 금지(불가역). 행 category=**`application`**, `TYPE_CATEGORY_MAP` 에 `chat_message → application`(클라 SSOT + EF 사본 동시). 트레이드오프: '지원/확정' 푸시를 끈 사람은 채팅 푸시도 못 받는다(`job` 은 더 나쁨).
- **라우팅**: `NOTIFICATION_ROUTE_MAP` 에 `chat_message → { name: 'chat', params: { conversationId } }` 추가 + **`ROUTE_MAP_PRIORITY_TYPES` 에 등록**(link 와 파라미터 수가 같으면 link 가 이긴다, `deepLinkNavigationExecutor.ts:190`). `link` 는 `/chat/{conversationId}` 로 두고 `deepLinkRouteParser` 에 `chat` 세그먼트를 추가한다(웹 URL·외부 딥링크 겸용).
- 조용한 시간: 죽은 회로(`quiet_hours`)는 살리지 않는다. 방별 뮤트(`muted_until`)를 RPC 가 **INSERT 단계에서 거른다**(EF 무수정).
- 보고 있는 방 억제: `resolveForegroundPresentation` 에 `activeConversationId` 입력 추가 → SUPPRESSED(`foregroundPresentationGate.ts:40-68`, 순수 함수).

> 🧑 **결정 D4**: 묶음 창 5분 · 푸시 본문 = **미리보기 60자** vs **중립 문구**("새 메시지가 있어요") · category=`application`.
> 트레이드오프: 미리보기는 잠금화면에서 바로 내용을 볼 수 있어 조율 속도가 빠르다. 중립 문구는 notifications 에 PII 사본이 안 남고 탈퇴 후 잔존도 없다.

---

## 7. 안전 · 운영

| 항목 | 추천 | 단계 |
|---|---|---|
| 신고 | 범용 `reports` 재사용(target=상대, job_posting_id=방의 공고, type=`inappropriate_behavior`) + `evidence_snapshot jsonb` 컬럼 추가(메시지 id·본문·시각·표시명). `chat_report_message` RPC 작성. 관리자는 **스냅샷만** | S4 |
| 차단 | **(공고, 스태프) 단위**(사람 단위는 구인자 측 다인이라 우회됨). 효과=양방향 읽기 전용 + 중립 문구 "대화할 수 없는 상태예요". **근무·지원 상태 무영향**(tel 유지) | S4 |
| 개인정보 경고 | 클라 정규식 **경고만**(휴대폰 `01[016-9]-?\d{3,4}-?\d{4}`, 은행명+계좌 자릿수). 전송은 막지 않음 — 근무 조율에 번호 교환은 정당하고 `contact_phone` 은 이미 노출. 목적은 사기 경고 | S2 |
| XSS | zod `xssValidation` + 서버 트리거 `check_xss_fields('body')`. `on\w+\s*=` 패턴이 "phone=" 류에 오탐 가능 → zod 에러 문구로 안내 | S1·S2 |
| 속도 제한 | `check_user_rate_limit(uid,'chat_send',30,60)` | S1 |
| 길이 | 1000자(공지 500자 선례) | S1 |
| 첨부(이미지) | **MVP 제외** — storage RLS·EXIF 제거·모더레이션 필요. expo-image-picker 기설치라 후속 OTA 가능 | 후속 |
| 탈퇴 | `permanently_delete_user` 를 **`20260807150000` 정의 베이스로** CREATE OR REPLACE, [5] 에 추가: 해당 사용자 발신 메시지 → `sender_id` NULL · `sender_display_name='[탈퇴한 사용자]'` · (D5) 본문 처리. **DROP+CREATE 금지**(anon EXECUTE 부활, `:46-48`) · search_path 재선언 · 가드 문구 불변(`anon_rpc_security_hardening.test.sql:38-57` 정확 비교) | S4 |
| 보존 | 쓰기 창 종료 후 **180일** 뒤 방 단위 purge 크론 · **개인정보처리방침 개정 필수**(단일소스 `src/constants/legal/`) | S5 |

> 🧑 **결정 D5**: 탈퇴자 메시지 **본문 삭제 vs 보존**(게시판 선례는 보존, author 만 NULL) · 보존 180일 · 방침 문구.

---

## 8. UI

| 결정 | 추천 | 이유 |
|---|---|---|
| 목록 진입 | **헤더 메시지 아이콘 + 배지**(새 탭 ❌) | 탭 5개(`home-jobs, employer, schedule, profile, board`)에 6번째는 폭 축소. 구인자 탭 고정영역이 이미 291px > 예산 210px — **높이를 쓰는 추가 금지**, 헤더 아이콘은 높이 0 |
| 스태프 진입 | 스케줄 `WorkTab` 확정 카드 tel 버튼 옆 "메시지"(`WorkTab.tsx:221`) · 지원 내역 카드 · 공고 상세(지원서 있을 때만) | |
| 구인자 진입 | 지원자 관리 행(`my-postings/[id]/applicants.tsx`) · 확정 스태프 카드 · 공고 관리 타일 "메시지 N" | |
| 라우트 | `app/(app)/chat/index.tsx` · `app/(app)/chat/[conversationId].tsx` · 방 없으면 `chat/new?postingId&staffId`(첫 전송 때 RPC 가 생성) | `(app)` 게이트=staff 이상이라 employer 통과 |
| 목록 | FlashList · 다크모드 `dark:` 필수 · expo-image | CLAUDE.md |
| 방 | FlashList 2.0.2 하단 시작 · 입력창 keyboard-controller(`KeyboardProvider` 세 플래그 규칙) | ⚠️ v2 의 역방향 API(`inverted` 폐지 → `maintainVisibleContentPosition.startRenderingFromBottom`?) 는 **S2 착수 시 context7 확인** |
| 웹 | 실시간만, 푸시 없음 | |

S2 착수 전 `/emil-design-eng`·`lazyweb` 레퍼런스(1건씩 — rate limit)로 말풍선·입력창 디테일 확정.

---

## 9. 배포 제약

**판정: runtime 1.0.7 OTA 로 가능.** 필요한 모듈(flash-list, keyboard-controller, expo-notifications, mmkv)이 모두 설치돼 있고 권한·엔타이틀먼트 변경 없음 → version bump 불필요.

배포 순서(단계마다): **① 서버 마이그(prod-migrate 1건씩) → ② EF(`typeCategoryMap` 사본, master push 자동배포) → ③ OTA 1.0.7 + 웹 → ④ `app_config.chat_enabled = {"enabled": true}` ON.** ②가 늦어도 미매핑=허용이라 푸시가 막히진 않는다.

> 🔑 플래그 값 형식은 기능 플래그 선례(`ops_hub_enabled`)대로 **`{"enabled": boolean}`** 이다(`src/domains/ops/opsHubFlag.ts:4`). `{ios,android,web}` 은 **버전 게이트 키**(`force_update_version` 등, `src/services/versionService.ts`) 형식이다 — 섞으면 zod 파서가 조용히 fallback(false)으로 빠진다.

**1.0.6 함대는 설계 제약에서 제외한다**(2026-09-24 사용자 결정). 역호환 폴백·최소 버전 강제·"상대가 채팅 불가 버전" 표시를 만들지 않는다. 참고로 1.0.6 이 채팅 푸시를 받아도 크래시는 없다는 것은 확인해 두었다(§0-2 — 매핑 없음 → link, `/chat/…` 은 1.0.6 파서가 모르므로 알림함으로 폴백). 별도 대응은 하지 않는다.

- **킬스위치 2단**: ① 클라 플래그 `chat_enabled`(fallback **false**)로 UI 를 숨긴다. ② 서버측은 **`chat_send_message` EXECUTE 회수 마이그 1줄**(GRANT 전용 → `verify_function` 비움). plpgsql 이 `app_config` 를 읽는 선례는 archive 제외 마이그에 0건이라 채택하지 않는다(planner 실측, §14-0 A4).

> ✅ **결정 D6 (확정)**: 1.0.6 은 고려하지 않는다 · 서버 킬스위치는 EXECUTE 회수 방식.

---

## 10. 파리티 (226 / 102 → 목표)

| 단계 | 함수 | 정책 | 누적 |
|---|---|---|---|
| S1 스키마+RPC | +7: `chat_is_employer_side` · `chat_is_member` · `chat_write_state` · `chat_send_message` · `chat_mark_read` · `chat_list_conversations` · `chat_unread_total` | +3 (conv·msg·read_states SELECT) | **233 / 105** |
| S4 안전 | +4: `chat_set_muted` · `chat_block` · `chat_unblock` · `chat_report_message` (`permanently_delete_user`·`send_job_posting_announcement` 재정의는 0) | +1 (`chat_blocks` SELECT) | **237 / 106** |
| S5 보존 | +1 purge | 0 | **238 / 106** |

- XSS 트리거는 범용 함수 재사용이라 +0. read_states 를 목록 RPC 로만 읽으면 정책 −1(deny-all, push_tickets 선례) 가능.
- 규율: `PARITY_EXPECT_FUNCS`/`_POLICIES` 마커 + 단언 리터럴 + 설명 문구 **3곳 동시** · 병렬 레인이 둘 다 +N 을 적으면 git 이 조용히 병합하므로 **머지 직전 master 기준 재계산** · 마이그마다 prod `list_migrations` + `pg_proc` 실측(관측 시각 기록).

---

## 11. 계측

| 선택지 | 판단 |
|---|---|
| 메시지마다 이벤트 | ❌ 시간당 240 캡에 무음 절단 · PII 위험 |
| **`chat_open` 1종** (props `job_id`, `method`=진입점) | ✅ §8 진입점 결정(헤더 아이콘 vs 탭)의 근거는 진입점 분포뿐 |
| 전송량·개설 수 | 이벤트 대신 **서버 테이블 직접 집계**(`chat_messages`·`chat_conversations.created_at`) |

`chat_open` 추가 시 **CHECK(17→18) · `PersistedAnalyticsEvent`(`AnalyticsEventRepository.ts:40`) · `CORE_FUNNEL_EVENTS`(`analyticsService.ts:161`) 3곳 1:1** + 테스트 2개(`analyticsService.productionRail.test.ts:181-194`, `analytics_core_funnel_dau.test.sql`). props 화이트리스트는 기존 `method`·`job_id` 재사용(키 확장 없음).

---

## 12. 결정 간 의존관계 · 되돌리기 어려운 결정

```
3-1 동적 권한(D) ──► 4 participants 테이블 없음 ──► 5 커서 unread(카운터 불가)
        └──► 6 수신자 = 전송 시 계산
1 1:1 + 기존 공지 ──► 4 kind='announcement' 예약 ──► S4 공지 팬아웃(C)
6 ① notifications collapse ──► 5 목록·배지 갱신을 기존 notifications 구독에 편승
2 쓰기창 계산형 ──► 4 chat_write_state ──► 8 읽기 전용 배너
7 탈퇴 ──► 4 FK SET NULL (어기면 탈퇴 크론 영구 실패)
```

**되돌리기 가장 어려운 Top 3**
1. **대화 키 = (job_posting_id, staff_id).** 대안 (워크스페이스, 스태프) 평생 방은 단골 알바에 자연스럽지만, 협업자 권한이 **공고 단위**라 공고 A 협업자가 공고 B 대화를 보게 된다. 이력 병합·분할 마이그는 사실상 불가 → UI 에서 상대별 그룹핑으로 보완.
2. **구인자 측 동적 멤버십.** RLS·unread·읽음 의미·푸시 수신자가 전부 여기서 파생.
3. **알림 형식(`chat_message` · category `application` · 본문 노출 여부).** 1.0.x 번들에 박히고, 발송된 푸시·notifications 행(보존 365일)은 회수 불가.

## 13. 위협 모델 (STRIDE 요약)

- **S 사칭**: 발신자 id·side·표시명은 RPC 가 `auth.uid()` 로만 채움, INSERT 정책 없음. 지원서 없는 (공고, 스태프) 쌍은 개설 거부.
- **I 비참여자·해제된 협업자 열람**: 동적 헬퍼 → 즉시 반영, Realtime 도 변경마다 RLS 재평가. **잔여 위험: 이미 받은 푸시·기기 캐시는 회수 불가.**
- **I 탈퇴 후 잔존**: 메시지 익명화. 상대 notifications 의 미리보기 사본은 남음 → D4 중립 문구의 근거.
- **D 스팸**: 분당 30 · 스태프 선제 발신 제한 · 1000자 · S4 차단.
- **E 권한상승**: viewer 는 좁은 헬퍼로 읽기·쓰기 불가, 쓰기 경로는 RPC 뿐, SECDEF 4규칙 + 축별 pgTAP.

---

## 14. 단계별 PR 분할 · 검증 · 사람 게이트

> 한 줄: **PR 5개(S1~S5) · 마이그 7건.** S1~S3 은 플래그 OFF 로 prod 에 조용히 착지시키고, **공개 ON 은 S4(신고·차단·탈퇴 익명화)와 S5-a(처리방침 개정)가 prod 에 반영된 뒤 한 번만** 켠다.
> 비유: 셔터를 내린 채 배관·전기(S1)와 인테리어(S2·S3)를 끝내고, 비상벨·출입 통제(S4)와 벽 안내문(S5-a)까지 갖춘 뒤에 셔터를 올린다(플래그 ON). 셔터는 언제든 다시 내릴 수 있다.
> (planner·fable 산출 — 메인 세션이 A3 를 코드로 재확인)

### 14-0. 설계 대비 조정 4건

| # | 조정 | 근거 |
|---|---|---|
| A1 | **S1 에 클라 enum 파일 + EF 사본이 반드시 들어간다** | `dbNotificationTypeDrift.test.ts`·`typeCategoryMapDrift.test.ts` 가 red. `Record<NotificationType,…>` 3곳(`src/types/notification.ts:236,328,520`)과 `NotificationTemplates`(`src/constants/notificationTemplates.ts:35`)는 tsc 가 망라성 강제 |
| A2 | **공개 ON 은 S4·S5-a prod 반영 후** | ① 사용자 간 콘텐츠(UGC)라 App Store 심사지침 1.2 의 신고·차단 요건 대상(OTA 는 심사를 안 거치지만 다음 스토어 심사에서 걸림) ② 탈퇴 익명화(D5)가 S4 ③ 방침에 없는 개인정보 수집 |
| A3 | 플래그 값 = **`{"enabled": boolean}`** (§9 반영) | `opsHubFlag.ts:4` — ✅ 메인 세션 재확인 |
| A4 | 서버 킬스위치 = **EXECUTE 회수 마이그** | plpgsql 의 `app_config` 읽기 선례 0건 |

### 14-1. 로드맵

| PR | 내용 | 마이그 | 파리티 | 배포 | 플래그 | 규모 |
|---|---|---|---|---|---|---|
| **S1** | 스키마·헬퍼·RPC 7종·RLS·알림 collapse + 클라 enum + EF 맵 | 1 | 226/102 → **233/105** | prod-migrate + EF 자동 | — | L |
| **S2** | 목록·방 UI · 진입점 · 오류 매핑 · 개인정보 경고 · `chat_open` 계측 | 1 (CHECK 17→18) | 불변 | OTA 1.0.7 + 웹 | OFF(다크 착지) | L |
| **S3** | 푸시 라우팅 · 읽음 · 포그라운드 억제 · 배지 | 0 | 불변 | OTA + 웹 | OFF | M |
| **S4** | 차단 · 뮤트 · 신고 스냅샷 · 탈퇴 익명화 · (D1-C) 공지 팬아웃 | 3 | → **237/106** | prod-migrate ×3 + OTA + 웹 | OFF → **공개 ON 게이트** | L |
| **S5-a** | 개인정보처리방침 개정(`src/constants/legal/`) | 0 | 불변 | OTA + 웹 | ON 선행조건 | S |
| **S5-b** | 180일 보존 purge 크론 | 1 | → **238/106** | prod-migrate | — | M |

의존: `S1 prod → S2 → S3 → S4 prod → S5-a → 공개 ON`. S5-b 는 ON 이후여도 되지만 **마감**이 있다 — 첫 purge 대상 발생(출시일 + 14일 + 180일, 날짜는 `date` 로 계산) 전.

### 14-2. S1 — 스키마 + RPC + pgTAP (+ 클라 enum)

**범위**
- 마이그 `supabase/migrations/<YYYYMMDDHHMMSS>_chat_schema_and_rpcs.sql` 1건: 테이블 3(`chat_blocks` 는 S4) · 헬퍼 3 · RPC 4 · SELECT 정책 3 · `notifications_chat_unread_collapse` · XSS 트리거 · `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages` · REVOKE/GRANT.
- pgTAP: `chat_security_grants` · `chat_rls_matrix` · `chat_send_message_gates` · `chat_notification_collapse` · `chat_account_deletion_fk` (`.test.sql`) + `parity_baseline_guard.test.sql` 3곳.
- 클라: `src/types/notification.ts`(enum + Record 3곳) · `notificationTemplates.ts` · 클라 `typeCategoryMap` 진실원(**경로 미확인** — drift 테스트가 읽는 파일을 따른다).
- EF: `send-push-notification/typeCategoryMap.ts` 에 `chat_message → application`.

**선행**: D1·D2·D3·D4·D7 확정 — 전부 S1 SQL 에 들어가는 값이다.

**pgTAP 단언 (Red-Green = 고의로 깨뜨려 실패 확인)**

| 축 | 단언 | Red-Green |
|---|---|---|
| 함수 권한 | 7개 각각 `has_function_privilege` anon=false · authenticated=true(**`chat_write_state` 만 false**) · service_role=true · `prosecdef` · `proconfig` 에 `pg_temp` · `provolatile`(send=`v`, list/unread=`s`) | anon REVOKE 한 줄 제거 → 실패 |
| 테이블 GRANT | authenticated SELECT 만 · anon 없음 — **`relacl` 로 단언**(픽스처 일괄 GRANT 가 `has_table_privilege` 를 덮는 함정) | GRANT INSERT 추가 → 실패 |
| RLS 매트릭스 | 3 테이블 × 주체(anon · 스태프 · 공고 owner · ws owner · ws editor · manager · viewer · 제3자 · admin) 가시 행 수, anon 42501 | viewer 판정을 `_any` 로 → 0→1 실패 |
| 동적 해제 | manager 협업자 행 삭제 **직후** 같은 트랜잭션에서 0행 | — |
| NULL fail-open | owner_id NULL(탈퇴 owner)에서 제3자·NULL uid → false, 헬퍼 NULL 인자 → false | `v_owner IS NOT NULL AND` 제거 → 실패 |
| 재귀 | 3 테이블 authenticated `lives_ok` SELECT, 42P17 없음 | — |
| 전송 게이트 | uid NULL · trim 빈값 · 1001자 · client id NULL · container · 쪽 0개/2개 · 지원서 없음 · applied 스태프 선제 발신 거부/답장 허용 · rejected·cancelled → `CHAT_READ_ONLY:<사유>` · cancellation_pending 허용 · 공고 cancelled 읽기 전용 · viewer 거부 | — |
| 쓰기 창 경계 | `clock_timestamp()` 기준 상대값으로 N−1일 ok / N+1일 읽기 전용 · NULL+활성 ok / NULL+비활성 읽기 전용 | 고정 과거 상수 금지(느슨한 경계 통과 함정) |
| 멱등 | 같은 client id 2회 → 1행 · `deduped=true` · 알림 불변 · **다른 발신자**의 같은 client id → 거부 | sender 확인 제거 → 실패 |
| 시간 순서 | 한 트랜잭션 연속 2회 `created_at` 엄격 증가 · `prosrc` 에서 advisory lock 이 `clock_timestamp` 앞 | `now()` 로 바꾸면 동일값 → 실패 |
| rate limit | 60초 내 31번째 → `CHAT_RATE_LIMITED` | STABLE 로 바꾸면 카운트 누락 → 실패 |
| 알림 수신자 | 구인자 측 − 보낸 사람 − 뮤트 · viewer 제외 · category=`application` · 쪽별 link · D4 본문 | — |
| collapse | 5분 내 2번째 → 미읽음 1행 유지 + body 교체 · `notification_counters` +1 한 번 · 행을 6분 전으로 옮긴 뒤 전송 → 옛 행 삭제+새 행, 카운터 순증 0 | — |
| **transition table 가정** | 테스트 안에 **스파이 STATEMENT 트리거**(`REFERENCING NEW TABLE`, 행 수 기록): 첫 전송=수신자 수(대조군) · collapse 전송=**0행** | 대조군 0이면 테스트 무효. ⚠️ 로컬엔 vault 시크릿이 없어 `trigger_send_push_notification` 이 `net.http_post` **전에 반환**(`baseline:9504`) → `net` 큐로 세면 **항상 0 = 공허한 검증** |
| 읽음 | 비멤버 거부 · 과거 id 로 커서 역행 없음 · 방 알림 `is_read=true` · 카운터 감소 · 99 캡 | — |
| 탈퇴 FK | 채팅 이력 스태프·구인자 `DELETE FROM users` 성공 · `sender_id`/`staff_id` NULL · read_states CASCADE | FK 하나 NO ACTION → 23503 실패 |
| 기타 | XSS 트리거 `<script>` 거부 · publication 18 · 파리티 233/105 | — |

⚠️ `jpc_test_set_user` 뒤 role=authenticated — `notifications` 를 세기 전 **`RESET ROLE`**(안 하면 RLS 로 항상 0 = 거짓 실패).

**클라 검증**: `npx jest src/services/notifications`(**디렉터리 단위**) → `npm run quality` → `npm test`.

**prod 배포**
1. 머지 후 사람 실행: `gh workflow run prod-migrate.yml --ref master -f migration=<파일> -f confirm=<파일> -f verify_function=chat_send_message` (신규 함수라 md5 `(none)`→해시로 통과).
2. 실측(관측 시각 기록): `list_migrations` · `pg_proc` chat_ 7개 · 파리티 **233/105** · 인덱스·publication.
3. EF 자동배포(순서 어긋나도 미매핑=허용). OTA 불필요(UI 없음).

**롤백**: prod-migrate 는 재적용 거부 → **정방향 마이그**. 긴급: ① `REVOKE EXECUTE ON chat_send_message FROM authenticated`(`verify_function` 비움) ② 데이터 0건 시점이면 DROP 마이그. 롤백 SQL 초안을 PR 본문에 첨부.

**사람 게이트**: D1~D4·D7 승인 · PR 머지 · prod-migrate 실행 승인 · 리뷰 = database-reviewer + security-reviewer(fable) · RLS 작성 전 `/guard`.

### 14-3. S2 — 클라 목록·방 (+ `chat_open`)

**범위**: `app/(app)/chat/{index,[conversationId],new}.tsx` · `src/repositories/…/ChatRepository.ts` · `src/services/chat/` · `src/hooks/chat/` · `src/components/chat/` · `src/domains/chat/chatFlag.ts`(fail-closed 파서) · `appConfigService` 키 · `featureFlags.chat_enabled=false` · `handleSupabaseError` 에 `CHAT_*` 3종 · zod(`xssValidation`, 1000자) · 개인정보 경고 정규식 · 진입점(`WorkTab.tsx:221`, 지원자 관리, 공고 관리 타일, 헤더 아이콘) · 업장명 필드 확정(§3-3).
**S2-b 마이그** `<ts>_analytics_chat_open_event.sql`: CHECK 17→18, `PersistedAnalyticsEvent`·`CORE_FUNNEL_EVENTS` 1:1, 파리티 불변 → `verify_function` 비움.

**선행**: S1 prod 실측(`check:rpc-migrations` 는 레포만 대조해 prod 부재 PGRST202 는 못 막는다). context7: FlashList 2.0.2 하단 시작 API(미확인) · keyboard-controller · supabase-js realtime filter. `/emil-design-eng` + `lazyweb` 1건씩.

| 검증 | 내용 |
|---|---|
| jest(디렉터리) | `src/services/chat` · `src/repositories` · `src/hooks/chat` · `src/components/chat` · `src/domains/chat` · analytics · `src/errors`. 플래그 파서: `null`·`{}`·`{"enabled":"true"}`·`{ios:…}` → 전부 false · 쓰기 상태 배너 · 재전송 client id 유지 · 오류 매핑 |
| Red-Green | fallback true 로 → 실패 · `CHAT_READ_ONLY` 매핑 삭제 → E7 로 떨어져 실패 |
| pgTAP | `analytics_core_funnel_dau.test.sql` 18종 |
| e2e | `e2e/tests/p1-important/chat-basic.spec.ts`(구인자 개설 → 스태프 답장 → 읽기 전용 배너). CI 는 로컬 Supabase 겨냥(`e2e.yml`) |
| 🚨 로컬 e2e | `e2e/.env.test` 기본값이 **prod** → 쓰기 스펙 그대로 돌리면 prod 오염. `npm run db:start` → `npx supabase status -o env` 의 URL/ANON/SERVICE_ROLE 을 **셸 env 로 export**(dotenv 는 기존 env 를 안 덮음) → storageState JWT `iss` 가 `127.0.0.1` 인지 확인 후 실행 |
| 실기기(**iOS 먼저**) | 키보드 가림 · 최신부터 표시 · 과거 로드 시 스크롤 튐 · 다크모드 · 오프라인 입력 비활성+재전송 · 1000자 · **한글/이모지 이름 계정** · Android 백버튼 |

**배포**: OTA production(1.0.7) + 웹(`--branch=master`). 플래그 OFF 라 비노출. 번들 검증은 **ASCII 식별자**(`chat_send_message`) grep. 긴 명령 전후 `git rev-parse HEAD` 대조.
**롤백**: 직전 OTA 그룹 재발행 · CF Pages 이전 배포 롤백. **게이트**: 디자인 확정 · OTA/웹 승인 · 실기기 QA(기기 2대).

### 14-4. S3 — 푸시 · 읽음 · 포그라운드

**범위**: `NOTIFICATION_ROUTE_MAP` 채팅방 라우트 + **`ROUTE_MAP_PRIORITY_TYPES` 등록** · `foregroundPresentationGate` 에 `activeConversationId` · notifications 구독 무효화에 `['chat','list']`·`['chat','unread']` · 헤더 배지(`chat_unread_total`) · 방 진입 시 `chat_mark_read` · 채팅 구독 콜백은 **tail 키 무효화만**(R1).
**jest**: `src/shared/deeplink` · `src/services/notifications` · `src/hooks`. **Red-Green**: PRIORITY 등록 제거 → "공고 상세로 감" 실패 · `activeConversationId` 비교 제거 → SUPPRESSED 단언 실패.
**실기기(iOS 먼저, Android 반복)**: 탭 → 방 이동 · 5분 내 두 번째 메시지는 **푸시 없이** 알림함 미리보기만 교체 · 읽은 후 메시지 즉시 푸시 · 보고 있는 방 억제 · 앱 종료 상태(cold start)에서 탭 → 방 착지 · 웹 `/chat/{id}` 직접 진입. ⚠️ 푸시 도달은 e2e 로 검증 불가 — 실기기 전용.

### 14-5. S4 — 안전 (마이그 3건, 각각 prod-migrate)

| 마이그 | 내용 | `verify_function` |
|---|---|---|
| `<ts1>_chat_blocks_mute_report.sql` | `chat_blocks`+정책 · RPC 4 · `reports.evidence_snapshot` · `chat_send_message` 재정의(차단 게이트) | `chat_send_message` |
| `<ts2>_chat_permanently_delete_user_anonymize.sql` | CREATE OR REPLACE 로 [5] 에 익명화(D5). **DROP+CREATE 금지** | `permanently_delete_user` |
| `<ts3>_chat_announcement_fanout.sql` (D1-C 시) | `send_job_posting_announcement` 재정의 · 확정자 방마다 한 문장 INSERT…SELECT | `send_job_posting_announcement` |

**선행**: D5 확정 · 착수 시 `permanently_delete_user` 최신 정의가 여전히 `20260807150000` 인지 재확인(`20260915133500` GRANT 복구가 본문을 건드렸는지 미확인). 파리티 237/106.
**pgTAP**: 차단 양방향 읽기 전용 + 지원·근무 무영향 · 해제 · 뮤트 수신자 알림 0 · 신고 스냅샷은 **RPC 가 채움**(클라 본문 무시) · admin 은 스냅샷만, `chat_messages` 0행 · 익명화(`'[탈퇴한 사용자]'`·`body=''`·`deleted_at`, CHECK 통과) · `anon_rpc_security_hardening.test.sql` 가드 문구 정확 비교 유지 · anon EXECUTE 비부활 · 팬아웃: 확정자 수만큼 `kind='announcement'`, `chat_message` 알림 **0건**(`posting_announcement` 1건만) · 60초 연타 방어·manager 포함 유지.
**Red-Green**: 익명화 UPDATE 제거 → 실패 · 팬아웃에 알림 INSERT 섞기 → 0건 단언 실패.
**클라**: 차단·신고·뮤트 UI, 관리자 신고 상세 스냅샷. e2e `admin-report-resolution.spec.ts` 확장(로컬 겨냥 규칙 동일). **게이트**: D5 · security-reviewer · `/guard`.

### 14-6. S5 — 방침 · 보존

- **S5-a (ON 선행)**: 처리방침에 채팅 수집 항목·보존 180일·탈퇴 처리 추가 — `src/constants/legal/` 만 수정. 문구 사용자 승인. 개정 고지 기간 법적 요건 **미확인 → 법무 확인**.
- **S5-b**: purge 함수 +1(238/106) + pg_cron 등록. 경계 테스트는 `clock_timestamp()` 기준, Red-Green 경계 하루 이동. `cron.job` 실측.

### 14-7. 공개 ON 절차 (사람 실행)

1. `app_config.chat_enabled = {"enabled": true}` — 사용자 콘솔 또는 승인 후 MCP.
2. 1시간 관찰: Sentry `CHAT_*` · 전송량 · `push_tickets` 오류.
3. 되돌리기: 플래그 OFF → 필요 시 EXECUTE 회수 마이그.

### 14-8. 위험 레지스터

| # | 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|---|
| R1 | 병렬 세션 마이그 타임스탬프 충돌 | 중 | 고(DB Tests·E2E 동시 red) | **머지 직전** 재확인: origin/master 마이그 + 미푸시 워크트리(`-w1`·`-w2`) + prod `list_migrations` |
| R2 | 파리티 +N 무음 병합 | 중 | 중 | 3곳 동시 · rebase 후 master 기준 재계산 · 설명에 기준 커밋 명시 · prod 실측 대조 |
| R3 | ON CONFLICT transition table 가정 오류 | 저 | 고(메시지마다 푸시) | S1 스파이 트리거 pgTAP. 틀리면 "UPDATE 한 문장 → `INSERT … ON CONFLICT DO NOTHING` 한 문장"(여전히 EF 1회) |
| R4 | 로컬 vault 부재로 EF 검증 공허 | 고(방치 시) | 고 | `net` 큐 대신 스파이 트리거 · 모든 "0건" 단언에 "≥1건" 대조군 |
| R5 | 탈퇴 크론 FK 영구 실패 | 저 | 고(무음) | FK 단언을 **S1** 에 · S4 는 CREATE OR REPLACE 만 · ON 후 첫 크론 결과 실측 |
| R7 | FlashList v2 역방향 API 불확실 | 중 | 중(S2 지연) | S2 첫날 context7 + 실기기 스파이크 |
| R8 | 플래그 형식 혼동 | 중 | 중(ON 해도 안 보이거나 OFF 가 안 먹음) | `{"enabled":bool}` 통일 · 파서 fail-closed 테스트 · ON 직후 웹 즉시 확인 |

그 외 감시: `check_xss_fields` 의 `phone=` 오탐 · UGC 심사(A2) · 구 `chat` 스토리지 버킷(`storage_chat_owner_scope.test.sql`) — 첨부는 후속이라 이번 범위와 겹치지 않음.

### 14-9. S1 착수 체크리스트 (순서대로)

1. `git status`·`git worktree list` **재실측**, 이 설계 문서 PR 머지 여부 확인.
2. `origin/master` 기준 새 워크트리 + `feat/chat-s1-schema`. `mklink /J uniqn-mobile\node_modules <메인>\uniqn-mobile\node_modules` · **워크트리 `npm install` 금지**.
3. D1~D4·D7 확정 기록 확인 — 없으면 착수 금지.
4. 마이그 슬롯: master 최신(`20260923100000` 이후 변동) · 타 워크트리 미푸시 마이그 · prod `list_migrations`.
5. prod 파리티 실측(시각 기록). 로컬 Docker 스택은 공유 — `db:reset` 전 타 세션 사용 여부 확인.
6. 베이스 정의 Read: `is_workspace_member` · `is_posting_collaborator`(`20260813150000`) · `check_user_rate_limit`(`20260719061931`) · `check_xss_fields` · `send_job_posting_announcement`(`20260813140000`) · `permanently_delete_user`(`20260807150000`) · notifications 컬럼·카운터 트리거 4종(`baseline:12170-12268`) · 지원 상태 · `last_work_date`.
7. context7: Supabase realtime `postgres_changes`+RLS 조건 · publication. transition table 은 문서가 아니라 pgTAP 으로 확정.
8. **pgTAP 먼저(RED)** → `npm run db:reset` → `npm run test:db` 실패 확인.
9. 마이그 구현(GREEN) → 14-2 표 Red-Green 을 **하나씩 고의로 깨뜨려** 확인 후 복원.
10. 클라 enum + EF 맵 → `npx jest src/services/notifications` → `npm run quality`.
11. 파리티 3곳, 머지 직전 master 재수신 후 재계산.
12. database-reviewer · security-reviewer(fable) + `/guard` → PR → 머지 → 사용자에게 prod-migrate 요청.

### 14-10. Exit criteria — "채팅 출시 완료"

- [ ] 마이그 7건 prod 기록 · `pg_proc`/정책 **238/106** · parity-smoke green(관측 시각)
- [ ] master DB Tests·E2E Gate·CI green · 채팅 pgTAP 전부 Red-Green 기록이 PR 본문에
- [ ] OTA(1.0.7)·웹 배포 ID 기록 + 번들 grep 확인
- [ ] 실기기 QA(iOS·Android) 전 항목 통과 — 한글/이모지 계정, 기기 2대
- [ ] 개정 방침 게시 · `chat_enabled={"enabled":true}` 후 24시간 Sentry 신규 `CHAT_*` 0 · 탈퇴 크론 처리 건수 정상
- [ ] purge 크론 `cron.job` 등록(첫 대상 발생 전)
- [ ] 킬스위치 2단(플래그 OFF / EXECUTE 회수) 리허설 또는 절차 문서화
- [ ] wiki 졸업: 동적 멤버십·collapse·FK 결정을 `wiki/decisions/` 에

**미확인 모음**: FlashList v2 하단 시작 API · 클라 `typeCategoryMap` 진실원 경로 · `permanently_delete_user` 최신 본문 · 방침 개정 고지 기간 법적 요건.

---

## 15. 사람이 결정할 것 (모음)

| # | 결정 | 추천 |
|---|---|---|
| D1 | 단체방 영구 비채택 · 공지 팬아웃(C) MVP 포함 여부 | 비채택 · C 는 S4 |
| D2 | 쓰기 창 N일 · applied 스태프 선제 발신 | 14일 · 금지(답장만) |
| D3 | viewer 제외 · admin 원문 열람 불가 · 발신자 표시 | 제외 · 불가(신고 스냅샷만) · 업장명+보낸 사람 |
| D4 | 푸시 묶음 창 · 본문 미리보기 vs 중립 문구 · category | 5분 · (사용자 판단) · `application` |
| D5 | 탈퇴자 메시지 본문 삭제 vs 보존 · 보존 기간 · 방침 개정 | 삭제 · 180일 · 개정 |
| D6 ✅ | 1.0.6 고려 여부 · 서버 킬스위치 | **확정: 1.0.6 은 고려하지 않음**(09-24) · EXECUTE 회수 마이그 방식(§14-0 A4) |
| D8 | 공개 ON 시점 = S4·S5-a prod 반영 후 (§14-0 A2) | 채택 |
| D9 | 처리방침 개정 문구·고지 기간 | 법무 확인 |
| D7 | realtime 규칙 R1 유지 | R1 |
