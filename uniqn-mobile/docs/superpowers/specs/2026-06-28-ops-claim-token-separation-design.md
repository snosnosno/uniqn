# ops claim 토큰 읽기/쓰기 분리 — 설계 (STEP A)

> 상태: 설계 승인 대기 → 적대검증 → writing-plans
> 날짜: 2026-06-28 · 브랜치: `fix/ops-claim-token-separation`
> 선행: 1c 전체 출하 완료(master `fd0c5b077`). 본 작업은 **1d(bust/재진입/ITM) 착수 전 BLOCKING 선결과제**.
> 관련: 설계 v3.2 §4.3/§5.3/§7 · `project_tholdem_ops_revival_20260623`(2026-06-28 섹션) · 1c-4 적대검증(5렌즈) 결론.

## 1. 배경 — 적발된 구조 결함

1c-4 플레이어뷰는 `claim_token` 단일 토큰을 **읽기 능력과 쓰기 능력에 겸용**한다.

| RPC                                           | 역할                  | 권한   | 키 토큰              |
| --------------------------------------------- | --------------------- | ------ | -------------------- |
| `ops_get_player_view(claim_token)`            | 읽기(본인 안전필드)   | anon   | claim_token          |
| `ops_claim_participant(claim_token, user_id)` | 쓰기(계정 1회 바인딩) | authed | **같은** claim_token |

읽기 URL `ops.uniqn.app/live/{claim_token}`은 본질적으로 공유·유출되기 쉽다(QR슬립 사진, 본인 스택을 친구에게 보여주기, 화면 공유, 스크린샷). 유출된 링크를 가진 **로그인 방문자**가 같은 토큰으로 `ops_claim_participant`를 호출하면 그 참가자를 **자기 계정에 1탭 비가역 바인딩**(하이재킹)할 수 있다.

현재 `player_user_id`는 **dead column**(인가에 미사용)이라 결과는 LOW~MED다. 그러나 설계 v3.2 §4.3/§7은 1d/1f에서 `player_user_id`를 **권한키로 승급**(플레이어 액션·계정 포털)할 것을 전제한다. 승급 시 하이재킹은 **CRITICAL**(타인 엔트리 탈취 → 재진입 소비·상금·플레이어 액션). 따라서 권한키 승급 **전에**, prod 데이터가 0행일 때 토큰 모델을 바로잡는다.

즉시 방어(1c-4에서 이미 반영): claim 확인 다이얼로그(`ConfirmModal`), `ops_unclaim_participant` 운영자 복구 RPC, pgTAP PII/`player_user_id` 부재 단언, 무효 토큰 폴링 중단.

## 2. 위협 모델 — 분리의 근거

| 유출 벡터                                    | 빈도       | 현재 결과                 | 재설계 후                                             |
| -------------------------------------------- | ---------- | ------------------------- | ----------------------------------------------------- |
| 디지털 읽기 URL 유출(스크린샷·공유·화면공유) | **흔함**   | 읽기 + **claim 하이재킹** | 읽기만(무해)                                          |
| 물리 QR슬립 유출(숄더서핑·분실)              | 드묾(대면) | claim 가능                | claim 가능하나 운영자 복구(unclaim + 재발급 로테이트) |

핵심: **흔한 유출 벡터(디지털 읽기 링크)와 claim 비밀(물리 슬립 한정)의 벡터를 분리**한다. 읽기 페이로드는 claim 비밀을 절대 포함하지 않으므로, 읽기 링크를 아무리 공유해도 claim은 불가능하다.

## 3. 결정 (Decisions)

| ID  | 결정                                                                                                         | 근거                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| D1  | 읽기 토큰을 `claim_token` → **`view_token`** 으로 정정                                                       | "이 토큰 = 읽기 전용" 의미를 구조적으로 명시 → 미래 오용 방지. prod 0행이라 클린 rename.                             |
| D2  | claim 비밀 = **6자리 숫자 PIN**, DB엔 **bcrypt 해시**만(`crypt`+`gen_salt('bf')`), 평문은 발급 시 1회만 반환 | 타이핑 UX 우선(현장 플레이어가 슬립의 6자리 입력). bcrypt로 DB 유출에도 PIN 비노출.                                  |
| D3  | claim은 **`view_token` AND `PIN` 둘 다** 요구                                                                | view_token(48hex 추측불가)이 PIN 대입을 단일 참가자로 한정(전역 PIN 스캔 차단). 4중 방어(token+PIN+authed+auth.uid). |
| D4  | **시도 잠금**: 오답 5회 → `OPS_CLAIM_LOCKED`. 해제 = 운영자 재발급(attempts=0 + 새 PIN)                      | 6자리(1e6) 공간 보완. 플레이어가 현장에 있어 운영자 즉시 복구. 시간기반 자동해제 미채택(현장 운영 단순).             |
| D5  | claim은 **authed 전용**(anon 아님). 발급/언클레임은 운영자(authed+is_ops_member)                             | auth.uid 바인딩 유지(#195 계약). PIN 대입을 로그인 사용자로 한정.                                                    |
| D6  | 구 `ops_claim_participant(text,uuid)`·`ops_issue_claim_token(uuid,uuid)`를 **명시적 DROP**                   | 시그니처 오버로딩 잔존 시 PIN 없는 구 claim 경로가 우회구멍. 보안상 필수.                                            |

## 4. 스키마 변경 — `ops_participants`

```sql
ALTER TABLE public.ops_participants RENAME COLUMN claim_token TO view_token;
-- UNIQUE 제약/인덱스는 rename 자동 추종.
ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS claim_pin_hash text,            -- bcrypt 해시. null = 미발급(claim 불가)
  ADD COLUMN IF NOT EXISTS claim_pin_attempts int NOT NULL DEFAULT 0;  -- 무차별대입 잠금 카운터
```

- `view_token`: 읽기 능력(anon RPC 키). 기존 `text UNIQUE`.
- `claim_pin_hash`: 쓰기 비밀. **anon/공개 경로 절대 미반환**.
- `claim_pin_attempts`: 0~5. 5 도달 시 잠금. 발급/재발급이 0으로 리셋.

prod 데이터 0행 → 데이터 마이그레이션 불필요. additive + rename.

## 5. RPC 명세 (4종)

모든 RPC: `SECURITY DEFINER`, `SET search_path = 'public', 'extensions', 'pg_temp'`(pgcrypto `crypt`/`gen_salt` 해소). 반환 jsonb camelCase.

### 5.1 `ops_get_player_view(p_view_token text)` — anon 읽기 (로직 동일, 키만 변경)

- `p_view_token` 길이<32 또는 NULL → `OPS_VIEW_TOKEN_INVALID`(구 OPS_CLAIM_TOKEN_INVALID 의미 승계).
- `WHERE view_token = p_view_token` 1행, **안전필드만** INTO(기존과 동일: phone/nationality/note/view_token/**claim_pin_hash**/**claim_pin_attempts**/player_user_id 미선택).
- 반환 페이로드는 기존과 동일(me/tournament/clock/currentLevel/stats/serverNow).

### 5.2 `ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid)` → `{viewToken, claimPin}` — 운영자 발급(로테이트)

(구 `ops_issue_claim_token` 대체)

1. actor 가드: `auth.uid()` NULL 또는 (`auth.uid() <> p_actor_id` AND NOT `is_admin()`) → `PERMISSION_DENIED`.
2. 참가자 `FOR UPDATE` 조회(없으면 `PARTICIPANT_NOT_FOUND`). `is_ops_member(tournament_id, p_actor_id) OR is_admin()` 아니면 `PERMISSION_DENIED`.
3. `view_token` 멱등 보장: NULL이면 `encode(gen_random_bytes(24),'hex')` 생성(안정 URL/QR — 재발급해도 동일).
4. **새 PIN 발급(로테이트)**: `v_pin := lpad((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000)::text, 6, '0')`. `claim_pin_hash := crypt(v_pin, gen_salt('bf'))`, `claim_pin_attempts := 0`.
5. 반환 `{viewToken, claimPin: v_pin}` — **평문 PIN은 이 호출에서만 노출**(슬립 인쇄용).

- ⚠️ 재발급 시 기존 PIN 무효 → UI가 "재발급하면 이전 PIN은 사용할 수 없어요" 경고.

### 5.3 `ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid)` — 플레이어 본인 바인딩(PIN 게이트)

(구 2-인자 시그니처 **DROP** 후 3-인자 신규)

**반환 계약 (CRITICAL — 트랜잭션 함정 회피)**: PostgREST는 RPC 1호출=1트랜잭션이다. 오답 시 `claim_pin_attempts++` UPDATE 후 `RAISE EXCEPTION`하면 그 트랜잭션이 **롤백되어 카운터 증가가 유실** → 잠금이 절대 누적되지 않아 무제한 대입이 가능해진다(잠금 무력화). 따라서 **비즈니스 결과는 RAISE가 아닌 결과 jsonb 본문으로 신호**한다(함수 정상반환 → 카운터 커밋). `auth.uid`/형식 가드만 상태변경 없으므로 RAISE 허용.

반환: `{ ok: bool, reason?: text, claimed?: bool, noop?: bool, attemptsLeft?: int }`.

1. **(RAISE 허용)** `auth.uid()` NULL 또는 `auth.uid() <> p_user_id` → `PERMISSION_DENIED`(본인만, 상태변경 없음).
2. **(RAISE 허용)** 형식: `p_view_token` 길이<32 → `OPS_VIEW_TOKEN_INVALID`. `p_claim_pin`이 정확히 6자리 숫자(`^[0-9]{6}$`) 아님 → `OPS_CLAIM_PIN_INVALID`(형식, 카운터 미증가 — 대입 전 형식거부).
3. `WHERE view_token = p_view_token` `FOR UPDATE`(id, player_user_id, claim_pin_hash, claim_pin_attempts). 없으면 **RAISE** `OPS_VIEW_TOKEN_INVALID`(오라클 회피 — 존재여부 비노출, 카운터 대상 행 없음).
4. `claim_pin_hash IS NULL` → **본문** `{ok:false, reason:'not_available'}`(운영자 미발급, 상태변경 없음).
5. `claim_pin_attempts >= 5` → **본문** `{ok:false, reason:'locked', attemptsLeft:0}`.
6. PIN 불일치(`crypt(p_claim_pin, claim_pin_hash) <> claim_pin_hash`) → `claim_pin_attempts := claim_pin_attempts + 1` UPDATE → **본문** `{ok:false, reason:'pin_invalid', attemptsLeft: 5 - 새attempts}`(정상반환이라 증가 커밋).
7. PIN 일치:
   - `player_user_id IS NOT NULL`: `= p_user_id`면 **본문** `{ok:true, claimed:true, noop:true}`(멱등); 아니면 **본문** `{ok:false, reason:'already_claimed'}`.
   - 그 외: `player_user_id := p_user_id`, `claim_pin_attempts := 0` 바인딩 → **본문** `{ok:true, claimed:true}`.

**repo 변환**: `OpsPlayerRepository.claim`이 `ok:false`의 `reason`을 AppError로 매핑(`pin_invalid`→E6122, `locked`→E6123, `not_available`→E6124, `already_claimed`→E6121). RAISE된 P0001은 기존 `opsRpcError` 메시지 prefix 경로로 매핑. 이 본문-신호 계약은 **claim 전용 예외**(카운터 보존 목적)이며 §11 코멘트로 명시한다.

### 5.4 `ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid)` — 운영자 복구(변경 없음)

- 기존과 동일: actor+is_ops_member 가드, `player_user_id := NULL`.
- 복구 절차 문서화: **슬립 유출/오클레임 복구 = unclaim(바인딩 해제) + 재발급(PIN 로테이트, 새 슬립)**. unclaim 단독은 PIN 미변경이라 슬립 보유자가 재클레임 가능 → 운영자는 재발급까지 수행.

## 6. 에러코드 (AppError E61xx)

| 코드                                  | 의미                                                   | 한글 메시지                                                   |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| E6120 (개명) `OPS_VIEW_TOKEN_INVALID` | 읽기 토큰 무효(구 OPS_CLAIM_TOKEN_INVALID 승계·rename) | 유효하지 않은 플레이어 링크입니다                             |
| E6121 `OPS_CLAIM_ALREADY_CLAIMED`     | 이미 타 계정 바인딩                                    | 이미 다른 계정에 연결된 참가자입니다                          |
| **E6122** `OPS_CLAIM_PIN_INVALID`     | PIN 불일치/형식오류                                    | 연결 PIN이 올바르지 않습니다                                  |
| **E6123** `OPS_CLAIM_LOCKED`          | 5회 초과 잠금                                          | 연결 시도가 많아 잠겼습니다. 운영자에게 새 PIN을 요청해주세요 |
| **E6124** `OPS_CLAIM_NOT_AVAILABLE`   | PIN 미발급(claim 불가)                                 | 아직 연결이 준비되지 않았습니다. 운영자에게 문의해주세요      |

`opsRpcError.ts` PREFIX_MAP에 신규 prefix 매핑 + `__tests__/opsRpcError.test.ts` 케이스 추가.

## 7. 클라이언트 변경 (Presentation→Hooks→Service→Repository)

- **라우트**: `app/(public)/live/[claim_token].tsx` → **`[view_token].tsx`**. `useLocalSearchParams<{ view_token }>`.
- **`usePlayerView(view_token)`**: 키/RPC 파라미터(`p_view_token`) 변경.
- **claim 플로우**: `useOpsClaimToken`/`useClaimParticipant`가 `(view_token, claim_pin)` 받음. 플레이어뷰 claim 모달에 **6자리 PIN 입력**(숫자 키패드, 룰20 keyboard UX) 추가. 확인 후 `ops_claim_participant(view_token, pin, uid)`.
- **운영자 발급 UI**(`app/(ops)/tournaments/[id].tsx` + `PlayerClaimButton`): `ops_issue_player_credentials` 호출 → `{viewToken, claimPin}` 표시(슬립/QR + PIN). "재발급 시 기존 PIN 무효" 경고.
- **Repository/Service/types**: `OpsPlayerRepository`/`opsPlayerService`/`IOpsPlayerRepository`/`src/types/ops.ts` — claimToken→viewToken, claim 시그니처 변경. `src/lib/queryClient.ts` 쿼리키. `src/types/supabase.ts`는 prod 마이그 후 MCP gen 정합.
- 다크모드·44px 터치·에러 메시지(룰10 무엇+왜+어떻게) 준수.

## 8. 테스트

### pgTAP (`ops_player_view_security.test.sql` 전면 개정 + 신규 시나리오)

- **[핵심 회귀] 하이재킹 차단**: view_token만 보유(PIN 없음/오답) → `ops_get_player_view`는 성공(읽기), `ops_claim_participant`는 실패. ← 본 작업의 존재 이유.
- 정상 claim: 올바른 PIN + view_token + auth.uid 일치 → 1회 바인딩 성공.
- cross-token 격리·PII 차단(기존) + **신규 컬럼**(view_token/claim_pin_hash/claim_pin_attempts) player_view 미반환 단언.
- PIN 오답 누적 → 5회 후 `OPS_CLAIM_LOCKED`.
- 재발급(rotate): 구 PIN 무효 + attempts=0 해제 + 새 PIN 동작.
- pin_hash NULL(미발급) → claim `OPS_CLAIM_NOT_AVAILABLE`.
- 이미 바인딩: 타인=거부, 본인=멱등.
- auth.uid≠user_id 거부. 권한 격리(anon은 claim/issue/unclaim 불가, player_view만).
- unclaim 후 재클레임(정당 플레이어, 새 PIN).

### jest

- 도메인 PIN 형식 검증(6자리) 순수함수(있으면).
- `opsRpcError` 신규 코드 매핑.
- 서비스/훅 시그니처 변경 단위 테스트.

## 9. 마이그레이션 구조

| 파일(타임스탬프 예시)          | 내용                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…_ops_claim_split_schema.sql` | 컬럼 rename + claim_pin_hash/claim_pin_attempts 추가                                                                                                                                                |
| `…_ops_claim_split_rpcs.sql`   | **DROP** 구 `ops_claim_participant(text,uuid)`·`ops_issue_claim_token(uuid,uuid)` + player_view 키 변경 + `ops_issue_player_credentials`·신 `ops_claim_participant(text,text,uuid)`·unclaim REPLACE |
| `…_ops_claim_split_grants.sql` | 신규 함수 REVOKE PUBLIC/anon + GRANT(player_view=anon 포함, 나머지 authed) + 구 함수 grant 정리                                                                                                     |

prod 적용 후 `get_advisors`: anon-executable SECDEF 화이트리스트 = `ops_get_monitor_snapshot`·`ops_get_player_view` **2개 유지**(신규 claim/issue/unclaim은 authed). `function_search_path_mutable` 0, ERROR 0.

## 10. 범위 밖 (Out of Scope)

- 1d(bust/재진입/ITM) — STEP A 완료 후 별도(`player_user_id` 권한키 승급은 1d/1f에서 신중히).
- 운영자 승인 게이트·시간기반 자동잠금해제(미채택, 필요 시 fast-follow).
- SSO/세션 핸드오프(`.uniqn.app` 쿠키) — 후속.
- QR 코드 실제 인쇄/이미지 생성 파이프라인(현 텍스트 링크+PIN 표시로 충분, 필요 시 별도).

## 11. 영향 파일 목록 (실측)

DB: `supabase/migrations/`(신규 3) · `supabase/tests/ops_player_view_security.test.sql`(개정) · `ops_monitor_snapshot.test.sql`(컬럼명 단언 갱신).
클라: `app/(public)/live/[claim_token].tsx`(→view_token) · `app/(ops)/tournaments/[id].tsx` · `src/components/ops/PlayerClaimButton.tsx`(+PIN 입력) · `src/hooks/ops/{usePlayerView,useOpsClaimToken}.ts` · `src/repositories/{interfaces/IOpsPlayerRepository,supabase/OpsPlayerRepository}.ts`(+`IOpsParticipantRepository`/`OpsParticipantRepository` view_token 참조) · `src/services/ops/opsPlayerService.ts` · `src/types/ops.ts` · `src/lib/queryClient.ts` · `src/errors/AppError.ts` · `src/errors/opsRpcError.ts`(+테스트) · `src/types/supabase.ts`(MCP gen).
