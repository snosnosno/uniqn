---
paths:
  - "src/repositories/supabase/**/*.ts"
  - "src/schemas/**/*.ts"
  - "src/services/**/*.ts"
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
return parseDocument({ ...cleaned, id: row.id });

// ❌ WRONG — null이 Zod optional 필드에서 파싱 실패
return parseDocument({ ...camelRow, id: row.id });
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

## 9. DB 컬럼 추가 워크플로우 (nullable 컬럼)

새 선택적 컬럼 추가 시 4단계 순서를 반드시 준수:

```bash
# 1. migration 파일 생성 (ADD COLUMN IF NOT EXISTS)
# 2. Supabase MCP 또는 대시보드에서 마이그레이션 적용
# 3. database.types.ts 재생성
mcp__supabase__generate_typescript_types → src/lib/database.types.ts 갱신
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
