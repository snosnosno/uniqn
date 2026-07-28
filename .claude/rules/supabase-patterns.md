---
paths:
  - "uniqn-mobile/src/repositories/supabase/**/*.ts"
  - "uniqn-mobile/src/schemas/**/*.ts"
  - "uniqn-mobile/src/services/**/*.ts"
  - "uniqn-mobile/supabase/migrations/**/*.sql"
  - "uniqn-mobile/supabase/tests/**/*.sql"
---

# Supabase 패턴 규칙

## 1. null → undefined 정규화 (CRITICAL)

Supabase는 없는 JSONB/optional 컬럼을 `null`로 반환. Zod optional 스키마는 `null`을 거부.
Repository에서 Zod 파싱 전에 반드시 정규화:

```typescript
// ✅ CORRECT
const cleaned = Object.fromEntries(
  Object.entries(camelRow).map(([k, v]) => [k, v === null ? undefined : v])
);
return schema.parse({ ...cleaned, id: row.id });

// ❌ WRONG — null이 Zod optional 필드에서 파싱 실패
return schema.parse({ ...camelRow, id: row.id });
```

## 2. 기존 레코드 조회 — 컬럼 필터 사용 (CRITICAL)

composite string ID를 UUID 컬럼으로 조회하면 PostgreSQL 22P02 에러:

```typescript
// ✅ CORRECT — 개별 컬럼 필터
const { data } = await supabase
  .from('applications')
  .select('id')
  .eq('job_posting_id', jobPostingId)
  .eq('applicant_id', applicantId)
  .single();

// ❌ WRONG — composite string → UUID 타입 에러
.eq('id', `${jobPostingId}_${applicantId}`)
```

## 3. Zod `.or()` 순서

더 구체적인 스키마를 먼저 배치. 순서가 매칭 결과에 직접 영향:

```typescript
// ✅ CORRECT — string 먼저 (ISO string이 그대로 유지됨)
const timestampOrString = z.string().or(timestampSchema);

// ❌ WRONG — timestampSchema 먼저면 ISO string이 TimestampLike로 변환됨
const timestampOrString = timestampSchema.or(z.string());
```

## 4. 날짜 변환 — toDate() 명시 필수

Supabase row에서 온 날짜 필드는 반드시 `toDate()` 호출:

```typescript
// ✅ CORRECT
lastActivityAt: toDate(jobPosting.updatedAt ?? jobPosting.createdAt ?? null)

// ❌ WRONG — timestamp 객체 그대로 전달 → Supabase 파싱 에러
lastActivityAt: jobPosting.updatedAt ?? jobPosting.createdAt ?? null
```

## 5. RLS — app role 조회 경로

```sql
-- ✅ CORRECT
(auth.jwt() -> 'app_metadata' ->> 'role')

-- ❌ WRONG
auth.jwt() ->> 'role'
```

## 6. QA/테스트 계정 생성

반드시 GoTrue signup API 사용. SQL 직접 INSERT 금지:

```bash
# ✅ CORRECT
curl -X POST https://<project>.supabase.co/auth/v1/signup \
  -H "apikey: <anon_key>" \
  -d '{"email":"qa@test.com","password":"password"}'

# ❌ WRONG — GoTrue rate limit 및 identities 누락 문제 발생
INSERT INTO auth.users ...
```

## 7. 다중 문서 변경 — RPC 사용

클라이언트에서 직접 multi-step mutation 금지. 반드시 RPC 함수 사용:

```typescript
// ✅ CORRECT
const { data } = await supabase.rpc('confirm_application', { application_id: id });

// ❌ WRONG — 원자성 보장 불가
await supabase.from('applications').update({ status: 'confirmed' }).eq('id', id);
await supabase.from('work_logs').insert({ ... });
```

## 8. upsert — unique constraint 기반

ID가 없는 upsert는 unique constraint 컬럼 지정:

```typescript
// ✅ CORRECT
await supabase
  .from('board_memberships')
  .upsert(data, { onConflict: 'user_id,post_id' });

// ❌ WRONG — composite string을 UUID 컬럼 id에 넣으면 22P02 에러
await supabase
  .from('board_memberships')
  .upsert({ id: `${postId}_${userId}`, ...data });
```

## 9. DB 컬럼 추가 워크플로우 (nullable 컬럼)

새 선택적 컬럼 추가 시 4단계 순서를 반드시 준수:

```bash
# 1. migration 파일 생성 (ADD COLUMN IF NOT EXISTS)
# 2. Supabase MCP 또는 대시보드에서 마이그레이션 적용
# 3. 생성 타입 재생성 (파일명 주의 — database.types.ts 아님)
mcp__supabase__generate_typescript_types → src/types/supabase.ts 갱신
# 4. Repository의 TABLE_COLUMNS 상수에 새 컬럼 추가
const TABLE_COLUMNS = 'id,...,new_column,...' as const;
```

nullable 컬럼(`text`, `integer` 기본) → 도메인 타입은 `field?: string | null` (optional + nullable 동시):

```typescript
// ✅ CORRECT — DB nullable 컬럼은 도메인 타입도 | null
interface MyEntity {
  description?: string | null; // nullable + optional
}

// ❌ WRONG — nullable DB 컬럼인데 도메인 타입에서 null 누락
interface MyEntity {
  description?: string; // Supabase에서 null이 오면 타입 불일치
}
```

## 10. 트리거 추가·변경 시 중복 검사 (필수)

같은 테이블·같은 이벤트에 트리거가 둘 걸리면 알림이 2번 나가는 등 조용히 중복 실행된다.
**실제로 두 번 터졌다** — `20260620151331`(work_logs 체크인)과
`20260726000000`(리뷰·문의·대회 알림 3쌍, PR #328). grep으로는 새 트리거가
기존 것과 겹치는지 알 수 없다.

```bash
# ⚠️ 레포 루트에서 실행 (uniqn-mobile/ 안이면 ../scripts/) — 이 스크립트는 앱이 아니라 레포 루트 소유
node scripts/graph-db-deps.mjs triggers    # 그래프 불필요, 항상 최신
```

- **그래프가 필요 없다.** `.sql`을 직접 스캔하고, 나중 마이그레이션의 `DROP TRIGGER`까지
  타임스탬프 순으로 재생해 *지금 살아있는* 트리거만 센다. graphify 설치 여부와 무관.
- 판정 기준은 **같은 테이블 + 같은 타이밍 + 같은 이벤트**다. 함수가 달라도 잡힌다 —
  실제 버그가 `review_notify_insert → notify_on_review_insert()` vs
  `tr_notify_review_created → fn_notify_review_created()` 처럼 **함수가 다른** 형태였다.
- ⚠️ **`중복_후보` 0건은 "안전 확정"이 아니다.** 같은 테이블·시점에 트리거가 여럿인 건
  대부분 정상이라(updated_at + 상태전이 + XSS검사…) 함수명 토큰이 겹치는 쌍만 올린다.
  이름이 전혀 안 겹치는 중복은 사람이 봐야 한다. 전체 목록은 `--verbose`.

### 컬럼·테이블 변경 전 영향도 (이쪽은 그래프 필요)

```bash
# ⚠️ 둘 다 레포 루트에서 실행 (uniqn-mobile/ 안이면 ../scripts/)
graphify update uniqn-mobile --force --no-cluster   # 약 1분, LLM 토큰 0
node scripts/graph-db-deps.mjs table <테이블명>      # 읽는 SQL 함수를 file:line 으로
```

- graphify 미설치 시 `uv tool install "graphifyy[sql,mcp]"`. `graphify-out/`은 gitignore
  대상이라 **새 워크트리·머신에는 없다** — 위 갱신 명령을 먼저 한 번 돌려야 한다.
- 그래프가 최신 `.sql`보다 낡으면 **exit 2로 차단**된다. `--allow-stale`로 우회하지 말 것.
- ⚠️ `graphify install`/`claude install`은 **쓰지 말 것** — CLAUDE.md를 고치고 PreToolUse
  훅을 심어 fablize 게이트와 충돌한다. CLI와 MCP 서버만 쓴다.
- MCP `graphify` 서버(툴 10종)로도 조회 가능하나 `query_graph`는 임베딩이 없어 한글 질의가
  0건이다. `get_node`/`get_neighbors`/`shortest_path`를 쓸 것.


## 11. work_logs 읽기 — 소프트 취소 필터 (필수)

근무표 "빼기"는 2026-07-27(PR#357, 마이그 `20260727120000_work_schedule_soft_cancel_and_required_status_filter`)부터 **하드 `DELETE` 가 아니라 `status='cancelled'` 소프트 취소**다. 취소 행은 테이블에 **남아 있다.**

```sql
-- work_logs 를 세거나 목록에 내보내는 모든 쿼리
AND wl.status NOT IN ('cancelled', 'no_show')
```

- 이 필터를 빠뜨리면 **취소된 인원이 근무표·부족인원·단가표에 되살아난다.** 에러는 나지 않는다.
- 현재 마이그레이션 8개 파일에 **30회** 반복돼 있다(`grep -rn "NOT IN ('cancelled'" uniqn-mobile/supabase/migrations/*.sql`). 반복이 많다는 건 규칙이 없으면 다음 쿼리가 조용히 놓친다는 뜻이다.
- 🔑 **한쪽 취소 경로만 영속 의미론을 바꾸면, 그 전제에 기대던 리더가 조용히 결함이 된다.** PR#357 이 형제 리더 2개는 고쳤지만 지점 단가표 리더를 놓쳤다(후속 마이그 `20260728185802` 로 봉합). 리더 전수 조사는 `grep` 이 아니라 **`pg_proc.prosrc`** 로 하라 — 함수 본문은 파일이 아니라 DB 에 있다.
- 클라이언트 쪽: 취소 행은 `src/shared/status/StatusMapper.ts` 의 `workLogToSchedule` 매핑을 타야 '취소' 카드로 표시되고 통계(완료/확정/지원)에서 빠진다. **SQL 만 고치고 클라 매핑을 안 보면 취소 행이 정상 근무처럼 렌더된다** — DB 전용 변경이어도 클라 상태 매핑을 실측할 것.
