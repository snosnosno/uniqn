# 앱 내 채팅 S2 — 클라 목록·방·사진 구현 계획 (S2a 텍스트 / S2b 사진)

> 상태: **계획(코드 0줄)** · 작성 2026-09-25 · 워크트리 `T-HOLDEM-chat-s2` / 브랜치 `feat/chat-s2-client` (base `f2dd06af3`)
> 정본: `docs/planning/2026-09-24-in-app-chat-design.md`(이하 **설계**) §3-3·§5·§7·§8·§11·§14-3 + `uniqn-mobile/supabase/migrations/20260925100000_chat_schema_and_rpcs.sql`(이하 **S1마이그**).
> 이 문서에서 설계와 S1 구현이 다르면 **S1마이그가 이긴다**(이미 prod 에 반영됨 — prod 최신 기록 `20260925100000`, 메인 세션 실측).
> 표기: `파일:줄` 은 이 워크트리 기준. 확인하지 못한 것은 **미확인**이라고 적는다.

## 한 줄 결론

서버는 이미 다 지어져 있고 **셔터가 내려진(서버 다크) 상태**다. S2 는 그 위에 클라이언트를 **플래그 OFF 로** 올린다.
**S2a**(텍스트 — 목록·방·진입점 5곳·에러 매핑·계측 마이그)와 **S2b**(사진 — 선택→재인코딩→업로드→전송·서명 URL·뷰어)를 PR 두 개로 나눈다.
E2E 에서만 방을 열 수 있게 하는 GRANT 는 **`seed.sql` 이 아니라 E2E 전용 fixture SQL + `e2e.yml` 스텝**으로 건다(§4, 근거 포함).

비유: 가게(서버)는 인테리어까지 끝났지만 문은 잠겨 있다. S2 는 간판·안내판·계산대(클라 UI)를 설치하는데, 불은 꺼 둔다(플래그 OFF). 리허설(E2E)을 할 때만 **리허설용 열쇠**(E2E 전용 GRANT)로 문을 열고, 그 열쇠는 매장 도면(마이그)에도 공용 열쇠함(seed)에도 넣지 않는다.

---

## ✅ 확정 결정 (2026-09-25 사용자 승인 — 아래 본문보다 우선)

| # | 결정 | 확정 내용 |
|---|---|---|
| D-a | 에러 매핑 위치 | **채팅 전용 매퍼** `src/errors/chat.ts` 를 `ChatRepository` 가 먼저 부른다. 전역 `handleSupabaseError` 무변경 |
| D-b | mark_read | **S2a 에 포함** — 방 진입·새 메시지 수신 시 `chat_mark_read` → `['chat','unread']`·`['chat','list']` 무효화. S3 에는 푸시·포그라운드 억제만 남는다 |
| D-c | 목록 진입점 | **헤더 아이콘 폐기 → '소통' 탭 안 '채팅' 칸 + 소통 탭 아이콘 배지(`tabBarBadge`)**. `BoardTabBar` 에 3번째 칸(항목이 `flex-1` 이라 높이 불변 — `BoardTabBar.tsx:37-42` 실측). 플래그 OFF 면 칸·배지 모두 없음. `TabHeader` 무변경 → R-1 해소. 설계 §8:394 와 다름(사용자 결정) |
| D-d | 공고 관리 타일 | **전체 목록 + 공고 필터** — `chat_list_conversations` 결과를 클라에서 `jobPostingId` 로 거른다(안 읽음 수 유지). 공고별 RLS 목록 쿼리는 **만들지 않는다** |
| D-e | "일정 소통 게시판 가기" 링크 | S2 범위 밖(후속) |
| D-f | E2E GRANT | §4 권고 C 채택 — fixture SQL + npm scripts + `e2e.yml` 스텝 |
| D-g | 구직자 방 카드 | `cancelled`/`expired` 구분 불가 → 둘 다 **"종료된 공고"** |
| — | 리뷰 모델 | code-reviewer·security-reviewer 는 **opus**(fable 대신 — 사용자 지시, 규칙 파일 갱신됨) |

### D-c 에 따른 라우트 조정
- 목록 = `app/(app)/(tabs)/board/chat.tsx`(정적 세그먼트가 `[boardType]` 보다 우선). 화면 본체는 `src/components/chat/ChatListScreen.tsx` 로 두고 라우트 파일은 얇게.
- `app/(app)/chat/index.tsx` = `/(app)/(tabs)/board/chat` 으로 **Redirect**(쿼리 보존 — S3 딥링크·타일 호환용).
- 방·새 방은 그대로 `app/(app)/chat/[conversationId].tsx`·`new.tsx`(탭바 밖 스택 — 컴포저가 탭바와 겹치지 않게).
- `BoardTabKey` = `CommunicationBoardType | 'chat'`. `[boardType].tsx` 의 `navigateToTab` 이 `'chat'` 이면 `/(app)/(tabs)/board/chat` 으로.
- `chat_open` 계측 `method` 값: `header` → **`board_tab`**.

---

## 0. 전제 확인 — 설계 vs S1 구현 vs 이번 지시 (어긋나는 곳)

| # | 항목 | 설계 | S1 실제 구현(근거) | 계획 반영 |
|---|---|---|---|---|
| 0-1 | RPC 시그니처 | §4 표 | `chat_open_conversation(uuid, uuid DEFAULT NULL) → uuid` S1마이그:364 · `chat_send_message(uuid,text,text,text,int,int,uuid) → jsonb {messageId,createdAt,deduped}` :479-488, :578, :707 · `chat_mark_read(uuid,uuid) → void` :712 · `chat_hide_conversation(uuid) → void` :754 · `chat_list_conversations(p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL)` → 10컬럼 :798-810 · `chat_unread_total() → integer` :857 | **지시와 전부 일치.** 어긋남 없음 |
| 0-2 | 서버 다크 | 설계 D6(회수 방식) | open·send 는 `authenticated` EXECUTE 미부여 :944-948, 적용 시 자체 검증 :1000-1003 | E2E 에서만 GRANT(§4) |
| 0-3 | 사진 버킷 한도 | 5MB (§4:237, §7:381, D11) | **1.5MB = 1572864** :964 · 10분 20장 / 24시간 60장 :349-356 | 클라 상수는 S1 값 |
| 0-4 | 서명 URL TTL | 1시간 (§4:263, §7:381) | 서버 무관(클라 결정) | 지시대로 **5분(300초)** |
| 0-5 | 경로 형식 | `[0-9a-f-]{36}` | **소문자 정규 uuid 정규식** :130, :291 · RPC 는 `format('%s/%s/%s.jpg', conv, uid, client_id)` **완전 일치** :552-555 | 클라가 만든 경로가 대문자면 `CHAT_IMAGE_INVALID`. **uuid 는 전부 `.toLowerCase()`** |
| 0-6 | 발신자 표시 | 닉네임 우선 | 구직자: 닉네임 없으면 `'구직자 ' + uuid 앞 4자` :463 · 구인자 측 발신자: 닉네임 없으면 `'<업장명> 담당자'` :611-614 · 업장명 = `workspaces.name` → `owner_name` → `'구인자'` :399-403, :464 | **클라는 이름을 만들지 않는다** — `sender_display_name`·`counterpart_name` 을 그대로 쓴다. 설계 §3-3 의 "업장명 필드 S2 착수 시 확정"은 **S1 에서 이미 해소됐다** |
| 0-7 | "읽음" 표시(§5) | 구직자 화면 "읽음" = 구인자 측 누군가 읽음 | `chat_read_states` RLS 는 **본인 행만** :905-907 → 상대 커서를 볼 방법이 없다 | **S2 에서 구현 불가 → 제외**(위험 R-7) |
| 0-8 | `blocked` 컬럼 | S4 차단 | 목록 RPC 가 항상 `false` :841 | UI 는 무시(S4) |
| 0-9 | 구인자 측의 빈 방 | — | 구인자 측 목록·RLS 에서 **메시지 없는 방은 숨김**(만든 사람이 본인일 때 제외) :272, 목록은 `last_message_at IS NOT NULL` 만 :848 | 방 개설은 **첫 전송 때**(설계 §8:399) — 빈 방이 남아도 상대에게 안 보인다 |
| 0-10 | 방 읽음 RPC 시점 | `chat_mark_read` 는 **S3** 범위(설계 §14-4:576) | — | 이번 지시는 헤더 배지를 S2 에 넣었다 → 배지가 영영 안 줄지 않게 **S2a 에 mark_read 를 넣는 안**을 권고하되 **승인 필요**(결정 D-b) |
| 0-11 | 공고 카드 상태 | "마감"/"삭제된 공고" 배지 | 구직자는 `cancelled`·`expired` 공고를 **RLS 로 읽을 수 없다**(`job_postings_select_all` = approved·active·capacity_full·closed 만, baseline:13592). 목록 RPC 는 SECDEF 조인이라 모든 status 를 준다 :827, :843 | 방 카드 status 는 목록 RPC 값을 우선, 없으면 공고 조회, **조회 불가 = "종료된 공고"**(결정 D-g) |
| 0-12 | WorkTab 줄번호 | `WorkTab.tsx:221` | 현재 `ContactActions` 는 `WorkTab.tsx:230`, 섹션 조건 `:221`(확정 **AND ownerPhone 있음**) | 채팅 버튼은 **ownerPhone 조건 밖**에 따로 둔다(전화번호 없는 확정 근무도 채팅 가능해야 함) |
| 0-13 | 에러 매핑 위치 | "`handleSupabaseError` 에 `CHAT_*` 6종"(§14-3) | 전역 핸들러의 P0001 특례는 **고유 토큰만** 다룬다(`SEARCH_RATE_LIMITED` startsWith, `src/utils/supabase.ts:169-181`). `PERMISSION_DENIED`·`INVALID_INPUT` 은 **다른 RPC 도 쓰는 범용 접두사**(`src/errors/workspace.ts:103`, `src/repositories/supabase/opsRpcError.ts:173`) | 도메인 매퍼 + Repository 경유를 권고(§5, 결정 D-a) |
| 0-14 | 명명 충돌 | 설계는 계측 마이그를 "S2-b 마이그"라 부름 | — | 이 문서의 **S2b = 사진 PR**. 계측 마이그는 **S2a PR 에 넣는다**(진입점과 같이 나가야 `method` 분포가 의미를 가짐) |

---

## 1. 요구 사항 (확정 — 재논의 없음)

- 라우트 `app/(app)/chat/{index,[conversationId],new}.tsx` — `(app)` 게이트=staff 이상이라 employer 도 통과(설계 §8:399).
- 아키텍처 `Presentation → Hooks → Service → Repository → Supabase`. **읽기 전용 조회**(목록 RPC·메시지 SELECT·배지)는 TanStack Query 에서 Repository 직접 허용.
- 플래그 `app_config.chat_enabled = {"enabled": bool}`, fallback **false**, fail-closed 파서(선례 `src/domains/ops/opsHubFlag.ts:11-26`).
- zod `xssValidation`(`src/utils/security.ts:236`) + 1000자. 개인정보 경고 정규식은 **경고만**(설계 §7:377).
- 진입점 5곳(새 탭 금지): 공고 상세 "채팅하기" · WorkTab 확정 카드 · 지원자 관리 행 · 공고 관리 타일 · 헤더 메시지 아이콘+배지.
- 방 화면에서만 `chat_messages` postgres_changes 구독, **콜백은 `['chat','messages',id,'tail']` 무효화만**(D7=R1, 설계 §5:322).
- 오프라인 큐 없음 — 실패 말풍선 + **같은 `client_message_id`** 로 재전송(설계 §5:326).
- `dark:` 필수 · FlashList 2.0.2 · expo-image · `toast`/`confirmAction` · 파일 800줄/함수 50줄 · 불변성.
- 계측 `chat_open` 1종(props `job_id`·`method`) — CHECK 17→18, `PersistedAnalyticsEvent`·`CORE_FUNNEL_EVENTS` 1:1, 파리티 불변.
- 알림 딥링크·`ROUTE_MAP_PRIORITY_TYPES`·`NotificationRouteMap` CHAT_MESSAGE 는 **건드리지 않는다**(S3 — 현재 알림함으로 보냄, `src/shared/deeplink/NotificationRouteMap.ts:41-43`).

### 라이브러리 사실 (메인 세션이 설치본 node_modules·context7 로 확인 — 계획의 전제)

| 라이브러리 | 사실 | 계획에 미치는 영향 |
|---|---|---|
| `@shopify/flash-list` 2.0.2 | `inverted` prop **없음**. 하단 시작 = `maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}` · 과거 로드 = `onStartReached`/`onStartReachedThreshold` | 타임라인 데이터는 **오래된→최신 오름차순**. 과거 페이지는 앞에 붙인다 |
| `react-native-keyboard-controller` 1.22.2 | `KeyboardChatScrollView`(FlashList `renderScrollComponent` 로 주입, `keyboardLiftBehavior`) + `KeyboardStickyView`(컴포저) | 루트 `KeyboardProvider` 세 플래그는 이미 켜져 있다(`app/_layout.tsx:333`) |
| `expo-image-manipulator` 55.0.19 | `ImageManipulator.manipulate(uri).resize({width\|height}).renderAsync()` → `ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true })` | 기존 `manipulateAsync` 선례(`src/services/auth/storageService.ts:83-116`)와 API 가 다르다 — 신규 코드는 새 API. **업로드 바이트는 base64→ArrayBuffer**(같은 파일 :7-10 — `fetch(file://)→Blob` 은 0바이트 저장 실사고) |
| `@supabase/supabase-js` 2.110.8 | postgres_changes `filter: 'conversation_id=eq.<id>'` · `storage.from(b).upload(path, body, { contentType, upsert:false })` · `createSignedUrl(path, 300)` | `createRealtimeSubscription(table, filter, cb, onError)` 그대로(`src/utils/supabase.ts:501-623`) |
| 디자인 | 새 말풍선 = 무애니메이션/짧은 opacity · 전송 버튼 press scale 0.97 · 실패 = 아이콘+색만 · reduced motion 존중 · 레퍼런스: 목록=Alibaba 인박스(미리보기·시각·안 읽음 배지), 방=Telegram(상단 고정 배너 + "여기까지 읽음" 구분선) | 컴포넌트 명세에 반영(§3) |

---

## 2. Query key 설계 · 무효화 · 페이지네이션

`src/lib/queryClient.ts` 의 `queryKeys`(현재 `appConfig` 블록 :550-554)에 추가한다.

| 키 | 모양 | 원천 | staleTime | 무효화 지점 |
|---|---|---|---|---|
| 플래그 | `['appConfig','chatEnabled']` | `getChatFlagRaw()`(appConfigService) | `stable`(선례 `useOpsHubEnabled.ts:34-38`) | 없음 |
| 목록 | `['chat','list']` (infinite) | RPC `chat_list_conversations(30, p_before)` | 30초 | 전송 성공 · 나가기 성공 · mark_read 성공 · 목록 화면 포커스(기본 `refetchOnWindowFocus`) |
| 공고별 목록 | `['chat','list','posting',postingId]` | RLS SELECT `chat_conversations` `.eq('job_posting_id')`(정책 S1마이그:897-899) | 30초 | `['chat','list']` 접두사 무효화에 함께 걸린다 |
| 배지 | `['chat','unread']` | RPC `chat_unread_total()` | 30초 | 전송·나가기·mark_read 성공 |
| 방 메타 | `['chat','conversation',id]` | RLS SELECT `chat_conversations` 1행 | 5분 | 없음(스냅샷 컬럼) |
| 기존 방 조회 | `['chat','lookup',postingId,seekerId\|'me']` | RLS SELECT `(job_posting_id, seeker_id)` | 0 | `new` 화면 진입마다 |
| 내 읽음 커서 | `['chat','readState',id]` | RLS SELECT `chat_read_states` 본인 행(:905-907) | Infinity(진입 시 1회) | 방 진입 시 refetch — "여기까지 읽음" 구분선 기준 |
| 메시지 과거 페이지 | `['chat','messages',id,'pages']` (infinite) | RLS SELECT `chat_messages`(:901-903) | **Infinity**, focus refetch 끔 | 방 재진입 · tail 이 200건 초과 시(리셋) |
| 메시지 tail | `['chat','messages',id,'tail',anchorIso]` | RLS SELECT `created_at > anchor` 오름차순 limit 200 | 0 · focus/reconnect refetch 켬 | **realtime 콜백(접두사 `['chat','messages',id,'tail']`)** · 전송 성공 · 채널 `RECOVERED` |
| 서명 URL (S2b) | `['chat','media',imagePath]` | `createSignedUrl(path, 300)` | 4분 · gcTime 5분 | 없음(만료 전 자연 갱신) |

- **메시지 읽기 방식 = RLS SELECT 직접**(RPC 없음). 정책이 `chat_my_conversation_ids()` 로 쿼리당 1회 멤버십 계산(:237-275, :901-903)이므로 Repository 가 `from('chat_messages')` 로 읽는다.
- **과거 페이지 keyset**: `(created_at, id)` 내림차순 30건, 다음 페이지 = `created_at < c OR (created_at = c AND id < i)` — 인덱스 `chat_msg_conv_time_idx (conversation_id, created_at DESC, id DESC)` :137 과 정렬이 같다. FlashList 에 넘길 때 뒤집어 오름차순으로 만든다.
- **tail anchor** = 첫 페이지에서 가장 최신 `created_at`. 같은 방 안에서 `created_at` 은 잠금 뒤 `clock_timestamp()` 라 엄격 증가한다(:587-602) → `gt(anchor)` 로 빠짐이 없다.
- **목록 커서 한계**: `p_before` 는 `last_message_at < p_before` 시각 단독 비교(:849)라 **정확히 같은 시각의 두 방이 페이지 경계에 걸리면 하나가 빠진다.** 마이크로초 해상도라 확률은 낮다 — S1 RPC 를 바꾸지 않고 위험 R-5 로 기록.
- **R1 준수**: 어떤 콜백도 `setQueryData` 를 쓰지 않는다. 낙관적 메시지는 쿼리 캐시가 아니라 **방 화면의 로컬 상태**(아래 §3-4)에 둔다.
- 사용자 격리: 로그아웃 시 `queryClient.clear()` 경로(`src/services/cacheService.ts:114`)가 실제로 로그아웃에서 호출되는지 **미확인** → 착수 시 확인. 안 불리면 chat 키에 uid 를 넣는다(선례 `blindPresets(userId)` `queryClient.ts:546`).

---

## 3. 파일 목록 · 책임 · 의존 순서

### 3-1. S2a (텍스트) — 신규

| 경로 (`uniqn-mobile/` 기준) | 책임 |
|---|---|
| `src/constants/chat.ts` | **단일 상수 출처**: `CHAT_MEDIA_BUCKET='chat-media'`(구 `'chat'` 버킷 혼동 금지 — 설계 §14-8:616) · `CHAT_MESSAGE_MAX_LENGTH=1000` · `CHAT_PAGE_SIZE=30` · `CHAT_TAIL_CAP=200` · (S2b 에서 사용) `CHAT_IMAGE_LONG_EDGE=1600` · `CHAT_JPEG_QUALITY=0.8` · `CHAT_MAX_UPLOAD_BYTES=1572864`(S1마이그:964 와 같은 값) · `CHAT_SIGNED_URL_TTL_SEC=300` |
| `src/types/chat.ts` | `ChatSide`·`ChatMessageKind`·`ChatConversationSummary`(목록 10컬럼 camelCase)·`ChatConversationMeta`·`ChatMessage`·`ChatOutboxItem`·`ChatOpenMethod` |
| `src/domains/chat/chatFlag.ts` | `parseChatFlag(raw, fallback)` — `{enabled: z.boolean()}` 만 신뢰(opsHubFlag 복제) |
| `src/domains/chat/privacyWarning.ts` | `detectPrivacyRisk(text) → 'phone'\|'account'\|null` — 휴대폰 `01[016-9]-?\d{3,4}-?\d{4}`, 은행명+계좌 자릿수(설계 §7:377). 순수 함수 |
| `src/domains/chat/timeline.ts` | `mergeChatTimeline(pages, tail, outbox)` — 오름차순 병합, `id` 중복 제거, **서버 행에 같은 `clientMessageId` 가 나타나면 outbox 항목 제거**. 순수 함수 |
| `src/domains/chat/index.ts` | 배럴 |
| `src/schemas/chat.schema.ts` | `chatTextBodySchema`(trim 1~1000 + `refine(xssValidation)`, 오탐 안내 문구 — 설계 §7:378), `chatUuidSchema`(소문자 정규화), 행 파서 `chatMessageRowSchema`·`chatConversationRowSchema`·`chatListRowSchema`(외부 경계 검증) |
| `src/errors/chat.ts` | `CHAT_ERROR_CODES`(§5) + `mapChatRpcError(error): AppError \| null` |
| `src/repositories/interfaces/IChatRepository.ts` | 인터페이스 |
| `src/repositories/supabase/ChatRepository.ts` | RPC 6종 + RLS SELECT 5종(메타·기존방 조회·공고별 목록·읽음 커서·메시지 pages/tail). 에러는 `mapChatRpcError` 먼저, 아니면 `handleSupabaseError`(선례 `opsRpcError.ts:163-181`). snake→camel 매핑은 zod 로 |
| `src/repositories/chat.ts` | 싱글톤 배럴(선례 `src/repositories/workSchedule.ts:1-18` — 중앙 배럴 비대화 회피) |
| `src/services/chat/chatService.ts` | 쓰기 오케스트레이션: `sendText({conversationId?, postingId, seekerId?, clientMessageId, body})` = zod 검증 → (방 없으면) `open` → `send`, 결과 `{conversationId, messageId, deduped}`. `markRead`·`hide`. **`clientMessageId` 는 호출자가 준다**(서비스가 만들지 않음 → 재전송 id 유지가 구조적으로 보장) |
| `src/services/chat/index.ts` | 배럴 |
| `src/hooks/chat/useChatEnabled.ts` | 플래그 훅(선례 `src/hooks/useOpsHubEnabled.ts:31-44`) |
| `src/hooks/chat/useChatConversations.ts` | 목록 infinite(`p_before` = 마지막 행 `lastMessageAt`) + 공고별 목록 |
| `src/hooks/chat/useChatUnreadTotal.ts` | 배지(플래그 ON + 로그인일 때만 enabled — uid NULL 이면 RPC 가 예외 :868-870) |
| `src/hooks/chat/useChatRoom.ts` | 방 메타·공고 카드 status·읽음 커서 |
| `src/hooks/chat/useChatMessages.ts` | pages + tail + **realtime 구독(콜백=tail 무효화만)** + `RECOVERED` 시 tail 무효화(선례 `src/hooks/ops/useOpsTables.ts:23`) |
| `src/hooks/chat/useChatOutbox.ts` | 낙관적 메시지 로컬 상태(`useReducer`, 불변) — §3-4 |
| `src/hooks/chat/useSendChatMessage.ts` | outbox + `chatService.sendText` + 성공 시 무효화(tail·list·unread) + 실패 토스트(`extractUserMessage`) + `requireOnlineForMutation`(선례 `useJobPostingCollaborators.ts:78`) |
| `src/hooks/chat/useChatRoomActions.ts` | 나가기(`confirmAction` → hide → list 무효화 → 목록으로) · mark_read(결정 D-b) |
| `src/hooks/chat/useChatEntry.ts` | 진입점 공용: 플래그 확인 · 로그인 확인 · `router.push('/(app)/chat/new?postingId=…&staffId=…&src=…')` |
| `src/hooks/chat/index.ts` | 배럴 |
| `src/components/chat/ChatListItem.tsx` | 인박스 행(상대 이름·공고 제목·미리보기·시각·안 읽음 배지) |
| `src/components/chat/ChatPostingCard.tsx` | 방 상단 **고정 배너**(제목·상태 배지 "마감"/"종료된 공고", 탭 → 공고 상세) |
| `src/components/chat/ChatMessageBubble.tsx` | 텍스트 말풍선(내/상대, 구인자 측 발신자 이름 작게 — 구직자 화면에서만, 설계 §3-3:116) · 실패 상태=아이콘+색 + "재전송" |
| `src/components/chat/ChatUnreadDivider.tsx` | "여기까지 읽었어요" 구분선(내 `last_read_at` 기준) |
| `src/components/chat/ChatComposer.tsx` | `KeyboardStickyView` · 1000자 카운터 · 개인정보 경고(비차단) · 오프라인이면 비활성(`useNetworkStatus`, `src/hooks/useNetworkStatus.ts:20`) · 전송 버튼 press scale 0.97(reduced motion 존중) |
| `src/components/chat/ChatRoomView.tsx` | FlashList(`maintainVisibleContentPosition.startRenderingFromBottom`, `onStartReached`, `renderScrollComponent=KeyboardChatScrollView`) + 배너 + 컴포저. `[conversationId]`·`new` 가 공유 |
| `src/components/chat/ChatStartButton.tsx` | 진입 버튼(공고 상세·WorkTab·지원자 행 공용, 플래그 OFF 면 `null`) |
| ~~`src/components/chat/ChatHeaderButton.tsx`~~ | **D-c 로 폐기** → 대신 `src/components/chat/ChatListScreen.tsx`(목록 본체, `?postingId=` 필터) + `app/(app)/(tabs)/board/chat.tsx` + `(tabs)/_layout.tsx` 의 board `tabBarBadge`(`useChatUnreadTotal`, 0 이면 undefined) + `BoardTabBar` 3번째 칸(플래그 ON 일 때만) |
| `src/components/chat/index.ts` | 배럴 |
| `app/(app)/chat/_layout.tsx` | 스택 + **라우트 가드**: 플래그 OFF 면 안내 화면(딥링크·웹 URL 직접 진입 차단 — ops 선례는 라우트를 열어 두지만 채팅은 서버가 다크라 열어 둘 이유가 없다) |
| `app/(app)/chat/index.tsx` | 목록(FlashList, `?postingId=` 이면 공고별 목록) |
| `app/(app)/chat/[conversationId].tsx` | 방 |
| `app/(app)/chat/new.tsx` | 방 없는 상태: 기존 방 조회 → 있으면 `router.replace`, 없으면 빈 방 + 컴포저, **첫 전송 성공 시 `replace('/chat/<id>')`** |
| `supabase/migrations/20260925200000_analytics_chat_open_event.sql` | CHECK 17→18(`chat_open` 추가). 구조는 `20260923100000…sql:45-94` 그대로(정의로 찾아 정확히 1개 DROP → ADD → COMMENT). 함수·정책 0 → **파리티 불변** |
| `supabase/fixtures/e2e_chat_enable.sql` | **E2E 전용**: open·send GRANT + `app_config.chat_enabled={"enabled":true}` upsert(§4) |
| `supabase/fixtures/e2e_chat_disable.sql` | 되돌리기(REVOKE + 플래그 삭제) — 로컬 pgTAP 전에 |
| `e2e/tests/p1-important/chat-basic.spec.ts` | §7-4 시나리오 |
| 테스트 파일 | 각 디렉터리 `__tests__/`(§6) |

### 3-2. S2a — 수정

| 경로 | 변경 |
|---|---|
| `src/config/featureFlags.ts:9-27` | `chat_enabled: false` + 주석(서버 다크·D8) |
| `src/services/appConfigService.ts` | `CHAT_FLAG_KEY='chat_enabled'` + `getChatFlagRaw()`(선례 :57-88) |
| `src/lib/queryClient.ts:550-554` 이후 | `appConfig.chatEnabled` + `chat` 키 블록(§2) |
| `src/errors/index.ts` | `chat.ts` 재노출 |
| `src/errors/__tests__/errorCodeUniqueness.test.ts:14` | `CHAT_ERROR_CODES` 를 합산 대상에 추가 |
| ~~`src/components/headers/TabHeader.tsx`~~ | **D-c 로 무변경**. 대신 `src/components/board/BoardTabBar.tsx`(칸 목록을 prop/플래그로 — `'chat'` 칸) · `app/(app)/(tabs)/board/[boardType].tsx`(`navigateToTab`) · `app/(app)/(tabs)/_layout.tsx:103-109`(board `tabBarBadge`) |
| `app/(app)/jobs/[id]/index.tsx:265-366` | 하단 CTA 영역에 `ChatStartButton`(모든 분기 공통 한 줄, `job.ownerId === uid` 면 숨김). 파일 370줄 → ~390줄 |
| `src/components/schedule/tabs/WorkTab.tsx:220-233` | 확정 상태면 ownerPhone 과 무관하게 `ChatStartButton`(`schedule.jobPostingId` — `src/types/schedule.ts:114`) |
| `src/components/employer/applicants/ApplicantCard/types.ts` · `ApplicantCard.tsx` · `ApplicantList.tsx` · `app/(employer)/my-postings/[id]/applicants.tsx:297-314` | `onChat?: (a) => void` prop 관통, 있으면 행에 채팅 버튼(`staffId = applicant.applicantId`, `src/types/application.ts:53`). 확정 스태프 카드(`ConfirmedStaffCard.tsx`)는 선택(결정 없음 — 같은 prop 패턴) |
| `app/(employer)/my-postings/[id]/index.tsx:684-767` | 타일 `{ key:'chat', title:'채팅', badge: 방 N }` → `/(app)/chat?postingId=`. 🚨 **이 파일은 이미 1118줄 이상**(`:1118` 에 `ActionTileGrid`) — 타일 항목은 `src/hooks/chat/useChatPostingTile.ts` 가 만들어 넘겨 이 파일 증가를 5줄 안팎으로 묶는다 |
| `src/repositories/supabase/AnalyticsEventRepository.ts:29-37` | `CoreFunnelEvent` 에 `'chat_open'` |
| `src/services/observability/analyticsService.ts:47-70, 161-170` | `AnalyticsEvent` 유니온 + `CORE_FUNNEL_EVENTS` 에 `'chat_open'`. `PERSISTED_PROP_KEYS`(:180-185)는 이미 `method`·`job_id` 포함 → 무변경 |
| `src/services/observability/__tests__/analyticsService.productionRail.test.ts:181-197` | 8종 → 9종 |
| `supabase/tests/analytics_core_funnel_dau.test.sql:43-52` | F1 배열에 `chat_open` + **신규 단언 F4: CHECK 정의 안 값이 정확히 18개**(현재 파일은 "넣어진다"만 보고 개수는 안 본다 → "18종"을 단언하려면 개수 단언이 필요) |
| `package.json` scripts | `e2e:chat-enable` / `e2e:chat-disable`(선례 `test:db:helpers` `package.json:22` 의 `docker cp` + `docker exec supabase_db_uniqn psql` 패턴) |
| `.github/workflows/e2e.yml:106-128` 다음 | 스텝 "Enable chat (local E2E stack only)" → `npm run e2e:chat-enable` |

### 3-3. S2b (사진) — 신규·수정

| 경로 | 책임 |
|---|---|
| `src/services/chat/chatMediaService.ts` | `pickChatImage(source: 'library'\|'camera')`(expo-image-picker, 1장) → `prepareChatImage(uri, w, h)`: **manipulate → 긴 변 1600px(작으면 리사이즈 생략하되 재인코딩은 항상) → JPEG 0.8 base64 → ArrayBuffer**, 1.5MB 초과 시 0.6 으로 1회 재시도 후 거부 → `uploadChatImage(conversationId, uid, clientMessageId, bytes)` 경로 `<conv>/<uid>/<clientId>.jpg`(소문자) · `upsert:false` · **이미 존재(중복) 응답은 "업로드 완료"로 간주**(재전송 경로) → `createSignedUrls` |
| `src/services/chat/chatService.ts` | `sendImage({…, imagePath, width, height, caption})` 추가 — 순서 `open → upload → send`(설계 §4:258-263) |
| `src/errors/chat.ts` | storage RLS 거부(`new row violates row-level security policy` — 10분 20장/하루 60장 초과 또는 비멤버, S1마이그:349-356)를 `CHAT_IMAGE_LIMIT` 사용자 문구로 매핑(원인 구분 불가 — 복합 문구, 선례 `workspace.ts:148-157`) |
| `src/hooks/chat/useChatMediaUrls.ts` | 화면에 보이는 이미지 경로 묶음 → `['chat','media',path]` |
| `src/hooks/chat/useChatOutbox.ts` · `useSendChatMessage.ts` | 항목에 `localUri`·`width`·`height`·`uploadedPath?`·`stage: 'preparing'\|'uploading'\|'sending'` 추가 |
| `src/components/chat/ChatImageBubble.tsx` | expo-image, **`cacheKey = image_path`**(서명 URL 이 바뀌어도 캐시 재사용), 비율 박스(image_width/height), 업로드 중 진행 표시 |
| `src/components/chat/ChatImageViewer.tsx` | 전체화면 뷰어(모달, 닫기·핀치는 후속) |
| `src/components/chat/ChatAttachButton.tsx` | 컴포저 왼쪽 `+` → 앨범/카메라 |
| `e2e/fixtures/chat-exif-sample.jpg` | GPS EXIF 가 들어 있는 테스트 이미지 |
| `e2e/tests/p1-important/chat-basic.spec.ts` | 사진 1건 + EXIF 제거 단언(§7-4) |

### 3-4. 실패 말풍선 · 재전송 상태 모델

- **위치**: 방 화면 로컬 `useChatOutbox(conversationKey)` — `useReducer`, 액션 `enqueue / markFailed / retry / resolve`. 쿼리 캐시에 넣지 않는다(R1), 저장하지 않는다(오프라인 큐 금지).
- **항목**: `{ clientMessageId(소문자 uuid, generateUUID — src/utils/generateId.ts:26-28), kind, body, status: 'sending'|'failed', errorMessage?, createdAtLocal, (S2b) localUri, width, height, uploadedPath? }`.
- **전송**: `enqueue`(sending) → `chatService.sendText` → 성공 시 tail 무효화, 항목은 **tail/pages 에 같은 `clientMessageId` 행이 보이는 순간** `mergeChatTimeline` 이 걸러낸다(`resolve` 는 정리용).
- **실패**: `markFailed(errorMessage)` — 말풍선 아이콘+색, "재전송" 버튼. `CHAT_RATE_LIMITED` 는 재시도 가능 문구.
- **재전송**: `retry(clientMessageId)` → **같은 `clientMessageId`·같은 `conversationId`** 로 재호출. 서버가 이미 받았으면 `deduped:true`(S1마이그:571-579) → 중복 0.
- **`new` 화면**: 첫 전송에서 `open` 은 성공, `send` 가 실패하면 받은 `conversationId` 를 **화면 상태에 보관**하고 재전송은 그 id 로 `send` 만 한다(`open` 재호출 없음 — 새 방 한도 20/일 토큰 보호, :431-438). 전송 성공 후에만 `router.replace`.
- **S2b 사진**: 업로드 성공 후 `send` 실패면 `uploadedPath` 를 남겨 재전송 시 재업로드를 건너뛴다. 업로드된 채 끝난 고아 파일은 S5 정리 EF 몫(설계 §4:264).
- **오프라인**: 컴포저 비활성 + 기존 `OfflineStatusBar`(`src/components/ui/index.ts:118`). 오프라인 중 이미 `sending` 이던 항목은 실패로 떨어진다.

### 3-5. `chat_open` 계측 발화 규칙

- 진입점이 `src` 파라미터를 붙인다: `job_detail`·`work_tab`·`applicants`·`posting_tile`·`header`·`list`.
- 방 화면(`[conversationId]`·`new`) **마운트당 1회**(ref 가드 — 선례 `app/(app)/jobs/[id]/index.tsx:80-89`, 시간당 240 상한 공유) `trackEvent('chat_open', { job_id, method: src })`.
- prod 는 플래그 OFF 라 ON 전까지 행이 생기지 않는다.

---

## 4. 로컬·E2E 전용 GRANT 방식 — 권고: **E2E fixture SQL + `e2e.yml` 스텝**

| 선택지 | 판정 | 근거 |
|---|---|---|
| A. `supabase/seed.sql` 에 GRANT | ❌ **DB Tests 가 red 가 된다** | `db-tests.yml:51-62` 가 `supabase start` 로 스택을 띄우고 `:69-70` 에서 pgTAP 을 돈다. `config.toml` 에 `[db.seed]` 절이 없어 CLI 기본값(`./seed.sql` 적용)을 따른다(`config.toml:1-75` — 기본값 동작은 CLI 문서 기준, **이 레포에서 seed 적용 로그는 미실측**). seed 에 GRANT 가 들어가면 `chat_security_grants.test.sql` 의 **A4(:60-64) · A4b(:66-69) · A4c(:71-74)** 가 실패한다. 로컬 `npm run db:reset`(`package.json:27`)도 seed 를 다시 넣어 로컬 pgTAP 도 같이 깨진다. 또 seed 는 "QA 계정 시드" 파일이다(`seed.sql:1-15`) — 권한 모양을 바꾸는 파일이 아니다 |
| B. `e2e/global-setup.ts` 에서 GRANT | ❌ | ① SQL 채널이 없다 — global-setup 은 Auth REST 로그인만 하고(`global-setup.ts:63-142`), service_role 클라이언트(`e2e/helpers/supabase-admin.ts:109-123`)는 PostgREST 라 `GRANT` 를 못 친다 → node 에서 `docker exec` 를 불러야 하는데 ② global-setup 은 **모든** 로컬 E2E 실행에서 돈다 — 기본 대상이 prod 인 로컬 실행(설계 §14-3:568)이나 Docker 없는 실행까지 깨진다 |
| **C. fixture SQL + npm script + `e2e.yml` 스텝** ✅ | 채택 | ① **E2E 잡과 DB Tests 잡은 다른 러너·다른 스택**이다(`e2e.yml:93-104` / `db-tests.yml:51-62`) → E2E 스택에만 GRANT 가 걸리고 pgTAP 의 다크 단언은 그대로 산다. ② 실행 수단은 이미 검증된 `docker exec supabase_db_uniqn psql` 패턴(`package.json:22`, CI `db-tests.yml:64-67` 에서 매번 성공). ③ 같은 파일에 플래그 upsert 를 넣어 "잠금 해제 + 불 켜기"를 한 곳에서 관리. ④ 파일에 "PROD 실행 금지" 머리말(선례 `seed.sql:7-8`) |

- `e2e_chat_enable.sql` 내용 = `jpc_chat_simulate_on()` 과 **같은 GRANT 문장**(`supabase/fixtures/jpc_helpers.sql:624-630`) + `app_config` upsert. ⚠️ `app_config.key` 에 UNIQUE/PK 가 있는지 **미확인** — 없으면 `DELETE → INSERT` 로 쓴다.
- `e2e.yml` 스텝 위치: "Export Supabase env vars"(:106-128) 뒤, "Run E2E Tests"(:159) 앞. 웹 빌드(:152)와 무관(플래그는 런타임 조회).
- **로컬 규율**: `npm run db:start` → `npm run e2e:chat-enable` → (셸 env 로 로컬 URL/키 export, storageState JWT `iss`=127.0.0.1 확인 — 설계 §14-3:568) → `npm run e2e`. **E2E 후 pgTAP 전에는 `npm run e2e:chat-disable` 또는 `npm run db:reset`**(안 하면 A4b 가 로컬에서 red — 실패가 아니라 오염).
- 스펙 안 가드: `chat-basic.spec.ts` 의 `beforeAll` 이 ① Supabase URL 호스트가 `127.0.0.1`/`localhost` 가 아니면 skip(prod 오염 방지), ② **`CI=true` 인데 service_role 키가 없거나 개설 RPC 가 42501 이면 skip 이 아니라 실패**시킨다 — 기존 스펙의 `test.skip` 폴백(`cancellation-lifecycle.spec.ts:246` 등)을 그대로 따르면 GRANT 스텝이 빠져도 초록이 된다("미실행 성공" — wiki `decisions/vacuous-verification`).

---

## 5. 에러 매핑 — `src/errors/chat.ts`

매칭은 **메시지 접두사**로 한다(`^(?:P0001:\s*)?TOKEN`). `code` 에 의존하지 않는다 — postgrest-js 가 fetch 예외의 code 를 빈 문자열로 버리는 선례(`src/utils/supabase.ts:103-109`)와 같은 이유. 서버 원문 형식은 `'TOKEN: 한글'`(S1마이그 :385 … :584).

| 서버 토큰(발생 위치) | AppError | 코드 | 사용자 문구(초안) | 재시도 |
|---|---|---|---|---|
| `CHAT_POSTING_UNAVAILABLE` (:407) | BusinessError | **E6150** | 채팅할 수 없는 공고예요. | ✗ |
| `CHAT_OPEN_LIMITED` (:436) | BusinessError | **E6151** | 오늘은 새 채팅을 더 시작할 수 없어요. 내일 다시 시도해 주세요. | ✗ |
| `CHAT_RATE_LIMITED` (:584) | BusinessError | **E6152** | 메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내 주세요. | ✓ |
| `CHAT_IMAGE_INVALID` (:560) | BusinessError | **E6153** | 사진을 보낼 수 없어요. 다시 선택해 주세요. | ✗ |
| `CHAT_COUNTERPART_GONE` (:443, :566) | BusinessError | **E6154** | 대화 상대가 탈퇴해 메시지를 보낼 수 없어요. | ✗ |
| `CHAT_BLOCKED` (S4 자리 — S1 미발생) | BusinessError | **E6155** | 대화할 수 없는 상태예요.(설계 §7:376) | ✗ |
| 42501 `permission denied for function chat_…`(서버 다크) | BusinessError | **E6156** | 채팅 기능을 아직 사용할 수 없어요. | ✗ |
| (S2b) storage RLS 거부 | BusinessError | **E6157** | 지금은 사진을 더 보낼 수 없어요. 잠시 후 다시 시도해 주세요. | ✓ |
| `PERMISSION_DENIED` (:385, :388, :395, :413, :420, :519 …) | PermissionError | E4001(`INFRA_PERMISSION_DENIED`) | 서버 한글 꼬리(`: ` 뒤)를 그대로 — 서버가 사용자용으로 쓴 문장이다. 비면 "이 채팅에 참여할 수 없어요." | ✗ |
| `INVALID_INPUT` (:534-576, :732) | ValidationError | E3005(`VALIDATION_SCHEMA`) | 서버 한글 꼬리 | ✗ |

- E6150~E6157 은 현재 미사용(`E61[4-9]\d` 검색 결과 `E6140` 1건뿐 — `src/errors/AppError.ts:231`). 유일성 가드에 편입(§3-2).
- 42501 을 E6156 으로 따로 잡는 이유: 전역 매핑은 `PermissionError(E4001)`(`src/utils/supabase.ts:59, 186-191`)이라 "권한 없음"으로 보여 사용자가 계정 문제로 오해한다. 플래그가 실수로 먼저 켜진 경우의 문구다.
- 순서: `CHAT_*` 고유 토큰 → 42501 → `PERMISSION_DENIED` → `INVALID_INPUT` → `null`(호출자가 `handleSupabaseError` 로 폴백 → 매핑 없는 P0001 은 **E7000**, `src/utils/supabase.ts:219-226`). 토큰 간 부분문자열 충돌 없음.
- **위치 권고(결정 D-a)**: 도메인 매퍼를 `ChatRepository` 가 먼저 부른다(선례 `opsRpcError.ts:163-181` · `workspace.ts:81-160`). 전역 `handleSupabaseError` 에 범용 `PERMISSION_DENIED`/`INVALID_INPUT` 매핑을 넣으면 다른 RPC 의 문구가 함께 바뀐다. 설계 §14-3 문구("handleSupabaseError 에")와 다르므로 승인 대상.

---

## 6. TDD 순서 · 커밋 경계

각 커밋 = **테스트 먼저(RED 확인) → 구현(GREEN) → 디렉터리 단위 jest**. 커밋 형식 `<type>(chat): <한글>`.

### S2a (PR 1)

| 커밋 | 먼저 쓸 테스트 | 구현 |
|---|---|---|
| C1 `feat(chat): 플래그·상수·스키마·에러 매핑·순수 도메인` | `src/domains/chat/__tests__/chatFlag.test.ts`(null·undefined·`{}`·`{"enabled":"true"}`·`{enabled:1}`·`{ios:true,android:true,web:true}`·배열 → **전부 fallback**, 그리고 "빌드타임 fallback 은 false" 단언 — 선례 `opsHubFlag.test.ts`) · `privacyWarning.test.ts` · `timeline.test.ts`(정렬·중복·outbox 해소) · `src/schemas/__tests__/chat.schema.test.ts`(1000/1001자·공백만·`<script>`·대문자 uuid 정규화) · `src/errors/__tests__/chat.test.ts`(표 전 행 + 미매칭=null) · `errorCodeUniqueness` 확장 · `src/constants/__tests__/chat.test.ts`(버킷 id === `'chat-media'`, 1.5MB 값) | 상수·타입·도메인·스키마·에러·featureFlags·appConfigService |
| C2 `feat(chat): ChatRepository·chatService` | `src/repositories/supabase/__tests__/ChatRepository.test.ts`(RPC 인자 snake_case 정확성 — `p_job_posting_id`/`p_seeker_id`/`p_client_message_id` 등, 에러가 `mapChatRpcError` 를 먼저 타는지, keyset 필터 문자열) · `src/services/chat/__tests__/chatService.test.ts`(방 없을 때 open→send 순서 · 방 있을 때 open 미호출 · **clientMessageId 를 서비스가 바꾸지 않음** · zod 거부 시 RPC 0회) | Repository·서비스 |
| C3 `feat(chat): 목록·방·아웃박스 훅 + queryKeys` | `src/hooks/chat/__tests__/useChatOutbox.test.ts`(**재전송 시 같은 clientMessageId** · 불변 갱신) · `useSendChatMessage.test.ts`(첫 실패 → 재전송 → `sendText` 두 호출의 `clientMessageId`·`conversationId` 동일, `new` 에서 open 성공·send 실패 후 재전송 시 **open 0회**) · `useChatMessages.test.ts`(realtime 콜백이 **`invalidateQueries({queryKey:['chat','messages',id,'tail']})` 만** 부르고 `setQueryData` 0회) · `useChatEnabled.test.ts`(appConfig null → false) | 훅·키 |
| C4 `feat(chat): 목록·방·새 방 화면` | `app/(app)/chat/__tests__/*.test.tsx`(플래그 OFF → 안내 화면 · 목록 빈 상태 · 방: 실패 말풍선 "재전송" 노출 · 오프라인 컴포저 비활성 · 개인정보 경고 표시되나 전송 버튼은 활성) · `src/components/chat/__tests__/*.test.tsx`(`dark:` 클래스 존재) | 컴포넌트·라우트 |
| C5 `feat(chat): 진입점 5곳 + 헤더 배지` | `TabHeader.test.ts`(플래그 OFF → 채팅 버튼 없음 / ON → 있음 + 배지 접근성 라벨) · `JobDetailScreen.test.tsx`(소유자면 숨김) · `WorkTab.*.test.tsx`(ownerPhone 없어도 확정이면 보임) · `ApplicantsScreen*`·`JobPostingDetailScreen*`(타일) | 진입점 |
| C6 `feat(analytics): chat_open 계측 + CHECK 17→18` | `analyticsService.productionRail.test.ts` 9종 · pgTAP F1+F4 수정 → **로컬 `npm run db:reset` 후 `npm run test:db` 에서 RED(마이그 전)** 확인 | 마이그 `20260925200000` + 유니온·Set |
| C7 `test(e2e): 채팅 기본 흐름 + E2E 전용 GRANT` | `chat-basic.spec.ts`(텍스트 시나리오) | fixture SQL 2개 · npm scripts · `e2e.yml` 스텝 |

### S2b (PR 2 — S2a 머지 후 master 기준 새 브랜치)

| 커밋 | 먼저 쓸 테스트 | 구현 |
|---|---|---|
| C8 `feat(chat): 사진 준비·업로드·전송 파이프라인` | `src/services/chat/__tests__/chatMediaService.test.ts`: **manipulate 가 upload 보다 먼저 호출**(`mock.invocationCallOrder`) · upload body 가 원본 uri 가 아니라 **재인코딩 결과 바이트** · 가로/세로 긴 변에 따라 `resize({width:1600})`/`({height:1600})` · 작은 사진도 재인코딩 호출 · 1.5MB 초과 → 0.6 재시도 → 그래도 초과면 거부 · 경로 = 소문자 `<conv>/<uid>/<clientId>.jpg` · 중복 업로드 응답을 성공 취급 · storage RLS 거부 → E6157 | 서비스·에러 |
| C9 `feat(chat): 사진 말풍선·뷰어·첨부` | `ChatImageBubble.test.tsx`(`cacheKey === imagePath`) · `useChatMediaUrls.test.ts`(TTL 300 전달) · 아웃박스 사진 재전송(업로드 완료분은 재업로드 0회, clientMessageId 동일) | UI·훅 |
| C10 `test(e2e): 사진 1건 + EXIF 제거` | spec 확장 | 픽스처 이미지 |

---

## 7. 검증표

### 7-1. 요구된 Red-Green 4건 (각각 고의로 깨뜨려 실패를 본 뒤 복원 — 결과를 PR 본문에 기록)

| # | GREEN 단언 | 깨뜨리는 법 | 기대 RED |
|---|---|---|---|
| RG1 | `chatFlag.test.ts` "빌드타임 fallback 은 false" + `useChatEnabled.test.ts` "원격 null → enabled=false" | `featureFlags.chat_enabled = true` | 두 단언 실패 |
| RG2 | `chat.test.ts` "`CHAT_RATE_LIMITED: …` → E6152, isRetryable=true" + `ChatRepository.test.ts` 같은 입력이 E6152 로 throw | 매퍼에서 `CHAT_RATE_LIMITED` 행 삭제 | 폴백 `handleSupabaseError` 가 **E7000** 을 던져 실패 |
| RG3 | `chatMediaService.test.ts` "업로드 전 manipulate 호출 · 업로드 바이트 = 재인코딩 결과" | `prepareChatImage` 의 manipulate 단계 제거(원본 바이트 업로드) | 호출 순서·바이트 단언 실패(EXIF 보호 회귀 탐지) |
| RG4 | `useSendChatMessage.test.ts` "재전송의 clientMessageId === 첫 시도" | `retry` 에서 `generateUUID()` 재생성 | 두 호출 인자 불일치로 실패 |

### 7-2. jest (디렉터리 단위 — 파일명 패턴 금지, CLAUDE.md 규칙)

```
npx jest src/errors src/constants src/domains/chat src/schemas src/repositories src/services/chat src/services/observability src/hooks/chat src/components/chat src/components/headers src/components/schedule src/components/employer "app/(app)/chat" "app/(app)/jobs" "app/(employer)/my-postings"
npm run quality   # css-vars · check:rpc-migrations · tsc · eslint · prettier
npm test          # 전체
```
- 🚨 `e2e/` 는 eslint·quality 사각지대(CLAUDE.md) — 스펙은 `npx tsc -p e2e/tsconfig.json`(존재 확인됨 `e2e/tsconfig.json`)로 따로 타입 검사.
- `check:rpc-migrations` 는 레포만 대조한다 — prod 부재(PGRST202)는 못 막는다(설계 §14-3:560). S1 은 prod 반영 확인됨(메인 세션).

### 7-3. pgTAP

- `analytics_core_funnel_dau.test.sql`: F1 에 `chat_open`(9종 INSERT 통과) + **F4 CHECK 값 정확히 18개**(`pg_get_constraintdef` 안 따옴표 값 개수). `analytics_app_session_start.test.sql` A4(CHECK 1개)는 무수정으로 통과해야 한다(DROP 이 정의로 찾기 때문).
- 채팅 pgTAP 7종은 무수정 — 특히 `chat_security_grants` A4/A4b/A4c 가 **DB Tests 에서 계속 초록**인지(= §4 방식이 다크 단언을 안 깼다는 증거).
- 순서: `npm run db:reset` → `npm run test:db`(헬퍼 선로딩 포함 — `package.json:23`).

### 7-4. E2E `e2e/tests/p1-important/chat-basic.spec.ts`

파일명에 `employer` 가 없으므로 `chromium`(staff storageState) 프로젝트에 속한다(`playwright.config.ts:64-73`). 구인자 쪽은 `browser.newContext({ storageState: employer.json })`(선례 `cancellation-lifecycle.spec.ts:33-34`).

| 단계 | 행동 | 단언 |
|---|---|---|
| 준비 | adminClient 로 qa-employer 소유 active 공고 1건 생성(선례 `cancellation-lifecycle.spec.ts:68`) — 새 공고라 기존 방 없음, **지원서 없음** | — |
| 1 | staff(비지원자): `/jobs/<id>` → "채팅하기" → `/chat/new` → 텍스트 전송 | URL 이 `/chat/<uuid>` 로 바뀜, 말풍선 표시 |
| 2 | employer: 소통 탭(배지 확인) → '채팅' 칸 → 목록 | 행에 상대 이름 `qa-staff`(닉네임 — `seed.sql:228`) · 미리보기 · 배지 ≥1 |
| 3 | employer: 방 열기 → 답장 | staff 화면에 **새로고침 없이** 답장 등장(realtime + RLS 경로 검증) |
| 4 | adminClient: 공고 `status='closed'` → staff 재전송 | 전송 성공 + 방 배너 "마감" |
| 5 | employer: "채팅방 나가기"(confirmAction) | 목록에서 사라짐 |
| 6 | staff: 새 메시지 | employer 목록에 **다시 나타남**(S1마이그:645-647) |
| 7 | 재전송: `page.route` 로 `rpc/chat_send_message` 1회 abort → 실패 말풍선 → "재전송" | 두 요청 body 의 `p_client_message_id` 동일 · adminClient 로 해당 client id 행 **정확히 1개** |
| 8 (S2b) | staff: 첨부 → 파일 선택기(`page.waitForEvent('filechooser')` — 웹 picker 의 input 요소는 **미확인**)에 `chat-exif-sample.jpg` | 이미지 말풍선 · adminClient 로 객체 다운로드 → **EXIF(APP1 `Exif\0\0`) 마커 없음** · 크기 ≤ 1.5MB |
| 정리 | 공고 hard delete(방·메시지 CASCADE — S1마이그:93, :111) | — |

- 가드는 §4 의 `beforeAll` 규칙(로컬 아니면 skip, CI 에서 전제 불충족이면 fail).

### 7-5. 실기기 (iOS 먼저, 기기 2대 — 설계 §14-3:569)

키보드 가림(KeyboardChatScrollView) · 최신부터 표시 · 과거 로드 시 스크롤 튐 · 다크모드 · 오프라인 입력 비활성+재전송 · 1000자 · 한글/이모지 이름 계정 · Android 백버튼 · (S2b) 카메라/앨범 권한 · HEIC 원본 → JPEG · **iOS 사진의 GPS EXIF 가 업로드본에서 사라졌는지**(manipulator 재인코딩의 EXIF 제거는 웹 E2E 로만 확인되고 네이티브는 **미확인**).

### 7-6. 배포 (각 PR 머지 후, 사람 실행)

1. **S2a**: `gh workflow run prod-migrate.yml --ref master -f migration=20260925200000_analytics_chat_open_event.sql -f confirm=<같은 이름>` — **`verify_function` 비움**(함수 없는 CHECK 전용). 실측: `list_migrations` 최신 = `20260925200000` · CHECK 18종 · 파리티 **238/105 불변**.
2. OTA production(1.0.7) + 웹(`--branch=master`). 번들 검증은 ASCII 식별자 `chat_send_message` grep(비ASCII 는 `\uXXXX` — 메모리 함정). 긴 명령 전후 `git rev-parse HEAD` 대조.
3. prod 웹에서 플래그 OFF 확인: 헤더·공고 상세에 채팅 진입점이 **없어야** 한다. `/chat` 직접 입력 → 안내 화면.
4. **S2b**: 마이그 없음 → OTA + 웹만.
- 롤백: 직전 OTA 그룹 재발행 · CF Pages 이전 배포. CHECK 는 값 추가뿐이라 되돌릴 필요 없음(필요 시 정방향 마이그).

---

## 8. 위험 · 미결

| # | 위험 | 영향 | 완화 |
|---|---|---|---|
| R-1 | **헤더 폭**: 우측 클러스터는 `flex-1` + `paddingLeft: 60`(`TabHeader.tsx:52-55`), 중앙 로고는 absolute. 내 공고 탭은 이미 `⋯`+QR+종 3개(`app/(app)/(tabs)/employer.tsx:496-501`), 프로필 탭은 테마+QR+종 3개(`profile.tsx:136`). 채팅을 더하면 **4개 × 약 40px**. 375pt 기준 우측 가용폭 추정 ≈ 187 − 16 − 60 ≈ 111px(**추정, 미실측**) — 이미 3개(≈120px)부터 패딩을 침범 중일 수 있고 4개면 로고와 겹칠 가능성 | 중 | 착수 첫날 웹 실측(워크트리 export + serve 4101, 메모리의 실측법) 375/320pt · 큰 글꼴. 결정 D-c |
| R-2 | 고정영역 높이 예산 | 저 | 헤더 아이콘은 높이 0(설계 §8:394). 공고 상세 하단 CTA 는 한 줄 추가 시 `bottomActionHeight` 가 늘어남(`jobs/[id]/index.tsx:59, 267-272`) — **버튼을 기존 행에 나란히**(outline 소형) 두어 높이 증가 0 목표. 내 공고 탭 고정영역(225px 실측, 메모리)은 무변경 |
| R-3 | `app/(employer)/my-postings/[id]/index.tsx` 가 이미 800줄 상한 초과(≥1118줄) | 중 | 타일 로직은 훅으로 빼 5줄 안팎만 추가. 파일 분할은 범위 밖(별도 과제로 기록) |
| R-4 | `open` → `send` 가 클라 2단 호출 — CLAUDE.md "클라 다단계 뮤테이션 금지"와 긴장 | 저 | 설계가 명시한 흐름(§4:258-263, §8:399). `open` 은 멱등(:425-429, :467-474), 실패해 남은 빈 방은 상대에게 안 보임(:272, :848) |
| R-5 | 목록 커서가 시각 단독(:849) → 동시각 방 누락 | 저 | 기록만. 재발 시 S1 RPC 에 `(p_before, p_before_id)` 추가(서버 과제) |
| R-6 | S3 전까지 목록·배지 실시간 갱신 없음(notifications 구독 편승은 S3 — 설계 §14-4:576) | 저(플래그 OFF) | staleTime 30초 + 포커스 refetch + 내 행동 뒤 무효화 |
| R-7 | "읽음" 표시 불가(0-7) | 저 | 설계 §5:325 의 기능은 서버 RPC 가 필요 — S3 이후 과제로 넘김 |
| R-8 | 구직자는 `cancelled`/`expired` 공고를 못 읽음(baseline:13592) → 방 카드가 두 상태를 구분 못 함 | 저 | 목록 RPC status 우선, 없으면 "종료된 공고"(결정 D-g) |
| R-9 | 대문자 uuid → 경로 불일치로 `CHAT_IMAGE_INVALID` | 중 | 생성·전달 전부 `.toLowerCase()` + 단위 테스트 |
| R-10 | `check_xss_fields` 의 `on\w+\s*=` 가 "phone=" 류 오탐(설계 §14-8:616) | 저 | 클라 zod 가 먼저 막고 문구로 안내 |
| R-11 | FlashList `startRenderingFromBottom`·`KeyboardChatScrollView`·`KeyboardStickyView` 의 **웹 동작 미확인** | 중 | C4 착수 전 반나절 스파이크(웹 + iOS). 웹이 안 되면 웹만 일반 ScrollView 폴백 |
| R-12 | manipulator 재인코딩의 EXIF 제거 — 웹은 E2E 로 확인, **네이티브 미확인** | 중(개인정보) | 실기기 체크리스트에 GPS 사진 1건. 안 지워지면 S2b 머지 차단 |
| R-13 | 로컬 공유 Docker 스택에서 `e2e:chat-enable` 뒤 pgTAP 을 돌리면 A4b red | 저 | §4 로컬 규율 + disable 스크립트. 병렬 세션 상존 — `db:reset` 전 타 세션 사용 확인 |
| R-14 | 마이그 슬롯 `20260925200000` 을 병렬 세션이 쓸 가능성 | 중 | **머지 직전** origin/master + 미푸시 워크트리 + prod `list_migrations` 재확인 |
| R-15 | `app_config.key` UNIQUE 여부 미확인(fixture upsert 형태) | 저 | 착수 시 baseline 에서 확인 |
| R-16 | 로그아웃 시 chat 캐시 정리 경로 미확인(§2) | 중(계정 전환 시 남의 목록 노출) | 착수 시 확인, 필요하면 키에 uid |

**진입점 실제 경로(확인 완료)**: 공고 상세 `app/(app)/jobs/[id]/index.tsx` · WorkTab `src/components/schedule/tabs/WorkTab.tsx` · 지원자 관리 `app/(employer)/my-postings/[id]/applicants.tsx` → `src/components/employer/applicants/ApplicantList.tsx` → `ApplicantCard/ApplicantCard.tsx` · 공고 관리 타일 `app/(employer)/my-postings/[id]/index.tsx:684-767` · 헤더 `src/components/headers/TabHeader.tsx`(사용처 5탭).

**범위 밖으로 둔 것**: 알림 딥링크·포그라운드 억제·notifications 구독 무효화(S3) · 차단/신고/뮤트(S4) · 고아 사진 정리(S5) · "일정 소통 게시판 가기" 링크(설계 §1:69 — 지시 범위에 없음, 결정 D-e).

---

## 9. 성공 기준

- [ ] S2a/S2b 각 PR: §7-2 jest 디렉터리 전부 초록 · `npm run quality` exit 0 · `npm test` 초록 · CI(DB Tests·E2E Gate) 초록
- [ ] Red-Green 4건(RG1~RG4) 고의 파손 RED 출력이 PR 본문에 있다
- [ ] `chat_security_grants` A4/A4b/A4c 가 DB Tests 에서 초록(= E2E GRANT 가 다크 단언을 안 깼다)
- [ ] `chat-basic.spec.ts` 가 CI 로컬 스택에서 **실행되어**(skip 아님) 초록
- [ ] prod: `20260925200000` 기록 · CHECK 18종 · 파리티 238/105 불변 · OTA/웹 배포 ID 기록 · 플래그 OFF 상태에서 진입점 비노출 확인
- [ ] 실기기 iOS→Android 체크리스트 통과(한글/이모지 계정, 기기 2대, GPS EXIF 제거)
- [ ] 리뷰: code-reviewer(opus) + security-reviewer(opus) — S2a·S2b 각각, CRITICAL/HIGH 해소
