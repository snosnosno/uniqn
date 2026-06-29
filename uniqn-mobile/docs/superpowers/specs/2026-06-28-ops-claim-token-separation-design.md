# ops claim 토큰 읽기/쓰기 분리 — 설계 (STEP A)

> 상태: 적대검증 반영 완료(v2) → 사용자 스펙 리뷰 → writing-plans
> 날짜: 2026-06-28 · 브랜치: `fix/ops-claim-token-separation`
> 선행: 1c 전체 출하 완료(master `fd0c5b077`). 본 작업은 **1d(bust/재진입/ITM) 착수 전 BLOCKING 선결과제**.
> 관련: 설계 v3.2 §4.3/§5.3/§7 · `project_tholdem_ops_revival_20260623`(2026-06-28) · 1c-4 적대검증(5렌즈) 결론 · STEP A 적대검증(6렌즈, §12).

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

| 유출 벡터                                    | 빈도       | 현재 결과                 | 재설계 후                                    |
| -------------------------------------------- | ---------- | ------------------------- | -------------------------------------------- |
| 디지털 읽기 URL 유출(스크린샷·공유·화면공유) | **흔함**   | 읽기 + **claim 하이재킹** | **읽기만(무해)**                             |
| 물리 QR슬립 유출(숄더서핑·분실)              | 드묾(대면) | claim 가능                | claim 가능하나 운영자 복구(unclaim + 재발급) |

핵심: **흔한 유출 벡터(디지털 읽기 링크)와 claim 비밀(물리 슬립 한정)의 벡터를 분리**한다. 읽기 페이로드는 claim 비밀을 절대 포함하지 않으므로, 읽기 링크를 아무리 공유해도 claim은 불가능하다.

> **적대검증 반영(§12)**: "읽기만(무해)" 보장을 깨던 잠금 DoS(유출 view_token으로 정당 플레이어 claim 봉쇄)를 **잠금 메커니즘 자체를 제거**(강한 PIN 채택)하여 해소. 읽기 토큰 보유가 부여하는 쓰기측 부작용이 0이 되어 보장이 성립한다.

## 3. 결정 (Decisions)

| ID  | 결정                                                                                                                                      | 근거                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 읽기 토큰을 `claim_token` → **`view_token`** 으로 정정                                                                                    | "이 토큰 = 읽기 전용" 의미를 구조적으로 명시 → 미래 오용 방지. prod 0행이라 클린 rename.                                                                                    |
| D2  | claim 비밀 = **8자 Crockford base32 PIN**(대문자, 혼동문자 I/L/O/U 제외 → 32^8≈1.1e12), DB엔 **bcrypt 해시**만, 평문은 발급 시 1회만 반환 | 강한 엔트로피 + bcrypt + view_token 선결로 무차별대입 비현실(~수천년) → **잠금 불요**. 슬립의 8자 1회 입력은 수용 가능 UX.                                                  |
| D3  | claim은 **`view_token` AND `PIN` 둘 다** 요구                                                                                             | view_token(48hex 추측불가)이 PIN 검증을 단일 참가자로 한정(전역 PIN 스캔 차단). 4중 방어(token+PIN+authed+auth.uid).                                                        |
| D4  | **잠금/시도 카운터 없음**                                                                                                                 | 강한 PIN으로 무차별대입이 비현실이라 잠금 불필요. 잠금이 유발하는 cross-actor DoS·상태 오라클·body-signal 복잡성을 원천 제거(§12 ②).                                        |
| D5  | claim은 **authed 전용**(anon 아님). 발급/언클레임은 운영자(authed+is_ops_member)                                                          | auth.uid 바인딩 유지(#195 계약). PIN 검증을 로그인 사용자로 한정.                                                                                                           |
| D6  | 구 `ops_claim_participant(text,uuid)`·`ops_issue_claim_token(uuid,uuid)`·`ops_get_player_view(text)`를 **명시적 DROP 후 CREATE**          | claim/issue: 시그니처 오버로딩 잔존 시 PIN 없는 구 경로가 우회구멍(보안). player_view: 파라미터명 rename은 CREATE OR REPLACE 불가(42P13, §12 ③).                            |
| D7  | claim 실패는 **표준 RAISE 에러**(body-signal 아님)                                                                                        | 잠금 카운터가 없어 카운터-보존용 body-signal이 불필요 → 나머지 ops RPC와 일관(`opsRpcError` prefix 매핑 재사용).                                                            |
| D8  | 운영자 read 경로에 **view_token 노출**(참가자 읽기 컬럼)                                                                                  | "라이브 링크 재공유"가 PIN 재발급(로테이트) 없이 가능해야 함(§12 recovery). view_token은 운영자가 부여하는 읽기 능력이지 비밀이 아님. anon 경로는 여전히 view_token 미반환. |

## 4. 스키마 변경 — `ops_participants`

```sql
ALTER TABLE public.ops_participants RENAME COLUMN claim_token TO view_token;
-- UNIQUE 제약/인덱스는 rename 자동 추종.
ALTER TABLE public.ops_participants
  ADD COLUMN IF NOT EXISTS claim_pin_hash text;  -- bcrypt 해시. null = 미발급(claim 불가)
```

- `view_token`: 읽기 능력(anon RPC 키). 기존 `text UNIQUE`.
- `claim_pin_hash`: 쓰기 비밀. **anon/공개 경로 절대 미반환**. 운영자 read에도 hash는 미반환(view_token만 D8).
- ~~`claim_pin_attempts`~~: **없음**(D4 — 잠금 제거).

prod 데이터 0행 → 데이터 마이그레이션 불필요. additive + rename.

## 5. RPC 명세

모든 RPC: `SECURITY DEFINER`, `SET search_path = 'public', 'extensions', 'pg_temp'`(pgcrypto `crypt`/`gen_salt` 해소 — `base_schema.sql`에 pgcrypto 설치 확인). 반환 jsonb camelCase.

### 5.1 `ops_get_player_view(p_view_token text)` — anon 읽기 (DROP 후 CREATE)

- §9에서 `DROP FUNCTION ops_get_player_view(text)` 후 CREATE(파라미터명 변경 위해, D6/§12 ③). grants 마이그가 anon 재GRANT.
- `p_view_token IS NULL OR char_length(p_view_token) < 32` → `OPS_VIEW_TOKEN_INVALID`(구 OPS_CLAIM_TOKEN_INVALID 승계).
- `WHERE view_token = p_view_token` 1행, **안전필드만** INTO. 미선택: phone/nationality/note/**view_token**/**claim_pin_hash**/player_user_id.
- 반환 페이로드 기존과 동일(me/tournament/clock/currentLevel/stats/serverNow).

### 5.2 `ops_issue_player_credentials(p_participant_id uuid, p_actor_id uuid)` → `{viewToken, claimPin}` — 운영자 발급(PIN 로테이트)

(구 `ops_issue_claim_token` 대체)

1. actor 가드: `auth.uid()` NULL 또는 (`auth.uid() <> p_actor_id` AND NOT `is_admin()`) → `PERMISSION_DENIED`.
2. 참가자 `FOR UPDATE`(없으면 `PARTICIPANT_NOT_FOUND`). `is_ops_member(tournament_id, p_actor_id) OR is_admin()` 아니면 `PERMISSION_DENIED`.
3. `view_token` 멱등 보장: NULL이면 `encode(gen_random_bytes(24),'hex')` 생성(안정 URL/QR — 재발급해도 동일).
4. **새 PIN 발급(로테이트, 균일 8자 base32)**:
   ```sql
   v_rand := gen_random_bytes(8);  -- 256 = 8*32 → 모듈로 편향 0
   v_pin  := (SELECT string_agg(
               substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(v_rand, g) % 32), 1),
               '' ORDER BY g) FROM generate_series(0,7) g);
   claim_pin_hash := crypt(v_pin, gen_salt('bf'));  -- v_pin 대문자 정규형
   ```
5. 반환 `{viewToken, claimPin: v_pin}` — **평문 PIN은 이 호출에서만 노출**(슬립 인쇄용).

- ⚠️ 재발급 시 기존 PIN 무효. **"링크 재공유"는 issue 호출 없이 view_token read(D8)로** — issue/재발급은 PIN 로테이트라 확인게이트(§7).

### 5.3 `ops_claim_participant(p_view_token text, p_claim_pin text, p_user_id uuid)` — 플레이어 본인 바인딩(PIN 게이트)

(구 2-인자 시그니처 **DROP** 후 3-인자 신규. 표준 RAISE 에러 — D7)

1. `auth.uid()` NULL 또는 `auth.uid() IS DISTINCT FROM p_user_id` → `PERMISSION_DENIED`(본인만).
2. **`p_view_token IS NULL`** OR `char_length(p_view_token) < 32` → `OPS_VIEW_TOKEN_INVALID`.
3. **`p_claim_pin IS NULL`** OR `upper(p_claim_pin) !~ '^[0-9A-HJKMNP-TV-Z]{8}$'` → `OPS_CLAIM_PIN_INVALID`(명시 NULL 가드 — §12 ① fail-closed).
4. `WHERE view_token = p_view_token` `FOR UPDATE`(id, player_user_id, claim_pin_hash). 없으면 `OPS_VIEW_TOKEN_INVALID`(오라클 회피).
5. **NULL-안전 PIN 검증 + 오라클 회피**:
   `IF claim_pin_hash IS NULL OR crypt(upper(p_claim_pin), claim_pin_hash) IS DISTINCT FROM claim_pin_hash THEN RAISE OPS_CLAIM_PIN_INVALID`.
   - `IS DISTINCT FROM`은 NULL을 불일치로 취급 → crypt가 NULL이어도 성공분기 낙하 불가(§12 ① 심층방어).
   - `pin_hash IS NULL`(미발급)을 별도 코드로 구분하지 않고 동일 `PIN_INVALID` → 발급 여부 오라클 차단(§12 ④).
6. `player_user_id IS NOT NULL`: `= p_user_id`면 멱등 `{claimed:true, noop:true}`; 아니면 `OPS_CLAIM_ALREADY_CLAIMED`.
7. 그 외: `player_user_id := p_user_id` 바인딩 → `{claimed:true}`.

> 잠금 카운터가 없으므로(D4) 오답은 단순 RAISE(트랜잭션 롤백, 보존할 상태 없음). body-signal 불요 → repo는 표준 `opsRpcError` prefix 매핑.

### 5.4 `ops_unclaim_participant(p_participant_id uuid, p_actor_id uuid)` — 운영자 복구(변경 없음)

- 기존과 동일: actor+is_ops_member 가드, `player_user_id := NULL`.
- 복구 절차: **슬립 유출/오클레임 복구 = unclaim(바인딩 해제) + 재발급(PIN 로테이트, 새 슬립)**. unclaim 단독은 PIN 미변경이라 슬립 보유자가 재클레임 가능 → 운영자는 재발급까지 수행. (§2 드문 물리벡터 잔여위험 — 수용, §12 token-bypass-2 기각.)

### 5.5 운영자 view_token read (D8 — recovery)

- `OpsParticipantRepository` 운영자 참가자 read 컬럼에 **`view_token` 추가**(RLS가 owner/is_ops_member 한정 — 비-PII 능력값). 운영자가 issue 호출 없이 라이브 링크를 복사/재공유 가능 → PIN 비파괴.
- anon `ops_get_player_view`·모니터 경로는 여전히 view_token 미반환(타 참가자 토큰 비노출 불변).

## 6. 에러코드 (AppError E61xx)

| 코드                                  | 의미                                              | 한글 메시지                          |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| E6120 (개명) `OPS_VIEW_TOKEN_INVALID` | 읽기 토큰 무효(구 OPS_CLAIM_TOKEN_INVALID rename) | 유효하지 않은 플레이어 링크입니다    |
| E6121 `OPS_CLAIM_ALREADY_CLAIMED`     | 이미 타 계정 바인딩                               | 이미 다른 계정에 연결된 참가자입니다 |
| **E6122** `OPS_CLAIM_PIN_INVALID`     | PIN 불일치/형식오류/미발급(통합 — 오라클 회피)    | 연결 PIN이 올바르지 않습니다         |

- ~~OPS_CLAIM_LOCKED~~·~~OPS_CLAIM_NOT_AVAILABLE~~: 잠금 제거(D4)·오라클 통합(§12 ④)로 **불요**.
- `opsRpcError.ts` PREFIX_MAP에 `OPS_VIEW_TOKEN_INVALID`/`OPS_CLAIM_PIN_INVALID` 매핑 + `__tests__/opsRpcError.test.ts` 케이스.

## 7. 클라이언트 변경 (Presentation→Hooks→Service→Repository)

- **라우트**: `app/(public)/live/[claim_token].tsx` → **`[view_token].tsx`**. `useLocalSearchParams<{ view_token }>`.
- **`usePlayerView(view_token)`**: 키/RPC 파라미터(`p_view_token`) 변경.
- **claim 플로우**: `useOpsClaimToken`/`useClaimParticipant`가 `(view_token, claim_pin)`. 플레이어뷰 claim 모달에 **8자 PIN 입력**(대문자 영숫자, 입력 시 toupper 정규화, 룰20 keyboard UX). 확인 후 `ops_claim_participant(view_token, pin, uid)`.
- **운영자 발급 UI**(`app/(ops)/tournaments/[id].tsx` + `PlayerClaimButton`):
  - **"라이브 링크 복사/공유"**(D8 view_token read — 비파괴, issue 미호출).
  - **"PIN 발급/재발급"**(`ops_issue_player_credentials` — PIN 로테이트, **확인 다이얼로그**: "재발급하면 이전 PIN은 사용할 수 없어요"). 현행 자유 재탭 제거(§12 recovery-3).
  - 발급 결과 `{viewToken, claimPin}` 표시(슬립/QR + 8자 PIN).
- **Repository/Service/types**: `OpsPlayerRepository`/`opsPlayerService`/`IOpsPlayerRepository`/`src/types/ops.ts` — claimToken→viewToken, claim 시그니처(+pin). `OpsParticipantRepository.COLUMNS`에 view_token 추가(D8). `src/lib/queryClient.ts` 쿼리키. `src/types/supabase.ts`는 prod 마이그 후 MCP gen 정합.
- 다크모드·44px 터치·에러 메시지(룰10 무엇+왜+어떻게) 준수.

## 8. 테스트

### pgTAP (`ops_player_view_security.test.sql` 전면 개정 + 신규 시나리오)

- **[핵심 회귀] 하이재킹 차단**: view_token만 보유(PIN 없음) → `ops_get_player_view`는 성공(읽기), `ops_claim_participant`는 실패.
- **[§12 ① NULL/형식 fail-closed]** `p_claim_pin` = NULL·빈문자·공백·7자·9자·유니코드숫자·소문자(정규화 후 검증)·비base32문자 → 전부 `OPS_CLAIM_PIN_INVALID`, **player_user_id NULL 유지(바인딩 안됨)**.
- 정상 claim: 올바른 8자 PIN + view_token + auth.uid 일치 → 1회 바인딩.
- **[§12 ④ 오라클 회피]** 미발급(pin_hash NULL) claim → 오답과 동일 `OPS_CLAIM_PIN_INVALID`(발급여부 비노출).
- cross-token 격리·PII 차단(기존) + **신규**: player_view가 view_token/claim_pin_hash 미반환 단언.
- 재발급(rotate): 구 PIN 무효 + 새 PIN 동작.
- 이미 바인딩: 타인=거부, 본인=멱등. auth.uid≠user_id 거부.
- 권한 격리: anon은 claim/issue/unclaim 불가, player_view만.
- **[§12 ③]** 마이그 적용 성공(player_view DROP+CREATE로 42P13 회피) — 적용 후 anon EXECUTE 유지 확인.
- (모니터 테스트 `ops_monitor_snapshot.test.sql`: claim_token 컬럼명 단언 → view_token/claim_pin 부재 단언으로 갱신.)

### jest

- 도메인 PIN 형식 검증(8자 base32, 정규화) 순수함수.
- `opsRpcError` 신규 코드 매핑. 서비스/훅 시그니처 변경 단위 테스트.

## 9. 마이그레이션 구조

| 파일(타임스탬프 예시)          | 내용                                                                                                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…_ops_claim_split_schema.sql` | 컬럼 rename(claim_token→view_token) + claim_pin_hash 추가                                                                                                                                                                                                                    |
| `…_ops_claim_split_rpcs.sql`   | **DROP**: `ops_claim_participant(text,uuid)`·`ops_issue_claim_token(uuid,uuid)`·`ops_get_player_view(text)` → **CREATE**: `ops_get_player_view(p_view_token)`·`ops_issue_player_credentials`·신 `ops_claim_participant(text,text,uuid)`·unclaim(REPLACE 가능, 시그니처 불변) |
| `…_ops_claim_split_grants.sql` | 신규 함수 REVOKE PUBLIC/anon + GRANT(player_view=anon 포함·재GRANT, 나머지 authed/service_role)                                                                                                                                                                              |

prod 적용 후 `get_advisors`: anon-executable SECDEF 화이트리스트 = `ops_get_monitor_snapshot`·`ops_get_player_view` **2개 유지**(claim/issue/unclaim은 authed). `function_search_path_mutable` 0, ERROR 0.

## 10. 범위 밖 (Out of Scope)

- 1d(bust/재진입/ITM) — STEP A 완료 후 별도(`player_user_id` 권한키 승급은 1d/1f에서 신중히).
- 잠금/레이트리밋: 강한 PIN(D2/D4)으로 불요. (per-actor 잠금·시간기반 해제 모두 미채택 — 잠금 자체가 없음.)
- view_token 강제회전 RPC: 잠금 DoS가 사라져 불요(슬립 유출 복구는 §5.4 unclaim+재발급으로 충분).
- 운영자 승인 게이트·SSO 핸드오프 — 후속.
- QR 코드 이미지 생성 파이프라인(현 텍스트 링크+PIN 표시로 충분).

## 11. 영향 파일 목록 (실측)

DB: `supabase/migrations/`(신규 3) · `supabase/tests/ops_player_view_security.test.sql`(개정) · `ops_monitor_snapshot.test.sql`(컬럼명 단언 갱신).
클라: `app/(public)/live/[claim_token].tsx`(→view_token) · `app/(ops)/tournaments/[id].tsx` · `src/components/ops/PlayerClaimButton.tsx`(+PIN 입력·발급/재공유 분리·재탭 확인) · `src/hooks/ops/{usePlayerView,useOpsClaimToken}.ts` · `src/repositories/{interfaces/IOpsPlayerRepository,supabase/OpsPlayerRepository}.ts` + `{IOpsParticipantRepository,OpsParticipantRepository}`(view_token COLUMNS·D8) · `src/services/ops/opsPlayerService.ts` · `src/types/ops.ts` · `src/lib/queryClient.ts` · `src/errors/AppError.ts` · `src/errors/opsRpcError.ts`(+테스트) · `src/types/supabase.ts`(MCP gen).

## 12. 적대검증 반영 이력 (6렌즈 find→verify, 26 에이전트 · 확정 10/기각 10)

확정 결함을 다음과 같이 해소(전부 본 v2 스펙 반영):

| #   | 결함(확정)                                                                                                                       | 심각도           | 해소                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ①   | NULL `p_claim_pin`이 형식게이트(`NOT(NULL~regex)=NULL`)와 crypt 비교(`NULL<>hash=NULL`)를 둘 다 fail-open 통과 → PIN 없이 바인딩 | HIGH             | §5.3 step3 `IS NULL` 명시 + step5 `IS DISTINCT FROM`(NULL-안전). view_token도 `IS NULL` 명시. pgTAP NULL/빈문자/공백/유니코드 회귀. |
| ②   | 잠금 카운터가 유출되는 view_token 단위 → 유출링크 보유자가 오답 5회로 정당 플레이어 봉쇄(재발급해도 재잠금)                      | HIGH(5렌즈 수렴) | **잠금 메커니즘 제거**(D4) — 8자 PIN(D2)으로 무차별대입 비현실 → 잠금 불요. DoS 표면 자체 소멸.                                     |
| ③   | `ops_get_player_view` 파라미터 rename을 CREATE OR REPLACE로 → 42P13 마이그 실패                                                  | MEDIUM           | §9에서 player_view **DROP 후 CREATE** + anon 재GRANT(D6).                                                                           |
| ④   | claim 상태 오라클(`not_available`/`locked`가 PIN검증 전 반환) + 운영자 view_token read 경로 부재(재공유=PIN 파괴)                | LOW              | 미발급을 `PIN_INVALID`로 통합(§5.3 step5). 운영자 view_token read(D8)+발급/재공유 분리·재탭 확인(§7).                               |

**기각 10건(전부 타당)**: 핵심 — PIN 생성식 `bit(32)::bigint` 음수 우려는 Postgres 15.8 실측으로 **비음수 확정**(우리는 모듈로-바이어스 0인 `get_byte % 32` 방식 채택, 더 안전); body-signal 충돌·비원자 복구·supabase.ts tsc 드리프트·monitor 공허단언 등은 스펙이 이미 다루거나(잠금 제거로 다수 moot) 느슨타입 인프라가 흡수.
