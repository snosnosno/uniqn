---
name: migration
description: DB 마이그레이션 가이드. 마이그레이션, 스키마 변경, 데이터 이전, DB 변경 요청 시 활성화
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# DB 마이그레이션 스킬

Supabase(PostgreSQL) 스키마 변경과 데이터 마이그레이션을 안전하게 수행합니다.

## 마이그레이션 원칙

1. **무중단**: 서비스 중단 없이 마이그레이션
2. **롤백 가능**: 문제 시 이전 상태로 복구 가능
3. **점진적**: 작은 단위로 나누어 실행
4. **검증**: 각 단계마다 데이터 무결성 확인
5. **append-only**: 이미 적용된 마이그레이션 파일은 **절대 수정하지 않는다** — 되돌릴 때도 새 파일을 추가
6. **적용 경로 고정**: `mcp__supabase__apply_migration` 사용, `supabase db push` 금지

파일 위치·이름: `uniqn-mobile/supabase/migrations/<YYYYMMDDHHMMSS>_<snake_case_name>.sql`

## 마이그레이션 유형

### 1. 컬럼 추가 (가장 안전)
```sql
-- 기존 코드: 영향 없음 (NULL 허용 또는 DEFAULT 제공)
-- 새 코드: 새 컬럼 사용

-- DEFAULT 를 주면 PG11+ 는 테이블 rewrite 없이 기존 행에도 즉시 반영된다
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS new_field text DEFAULT 'defaultValue';

-- DEFAULT 없이 nullable 로 추가한 경우에만 별도 백필이 필요
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS new_field text;
-- UPDATE public.users SET new_field = 'defaultValue' WHERE new_field IS NULL;
```

### 2. 컬럼 이름 변경 (주의 필요) — 확장·수축 3단계
```sql
-- 단계 1: 새 컬럼 추가 + 기존 컬럼 유지 (한 마이그레이션)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
UPDATE public.users SET name = user_name WHERE name IS NULL;

-- 단계 2: 코드에서 새 컬럼 사용 (앱 배포 — 읽기는 fallback)
--   const name = user.name ?? user.userName;

-- 단계 3: 구 코드가 모두 빠진 뒤 기존 컬럼 제거 (별도 마이그레이션)
ALTER TABLE public.users DROP COLUMN IF EXISTS user_name;
```

⚠️ 컬럼 DROP 전에는 `pg_proc.prosrc` 의존성을 실측한다 — RPC·트리거 함수가 해당 컬럼을
참조하면 런타임에서만 터진다.
```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosrc ILIKE '%user_name%';
```

### 3. 컬럼 타입 변경 (위험)
```sql
-- 예: text → integer
-- 단계 1: 새 컬럼으로 추가
ALTER TABLE public.data ADD COLUMN IF NOT EXISTS count_num integer;

-- 단계 2: 백필 (실패 허용 캐스팅)
UPDATE public.data
SET count_num = COALESCE(NULLIF(regexp_replace(count, '\D', '', 'g'), '')::integer, 0)
WHERE count_num IS NULL;

-- 단계 3: 코드 업데이트 배포 후 기존 컬럼 제거 (별도 마이그레이션)
ALTER TABLE public.data DROP COLUMN IF EXISTS count;
```

`ALTER COLUMN ... TYPE` 직접 변경은 테이블 전체 rewrite + ACCESS EXCLUSIVE 락이므로
대형 테이블에서는 위 3단계를 사용한다.

### 4. 테이블 구조 변경 (복잡)
```sql
-- 예: 하위 테이블을 최상위 테이블로 분리·평탄화
-- user_orders(user_id, ...) → orders(user_id 컬럼 유지, RLS 재정의)

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  migrated_at timestamptz DEFAULT now()
  -- ... 나머지 컬럼
);

INSERT INTO public.orders (user_id, migrated_at /*, ... */)
SELECT o.user_id, now() /*, ... */
FROM public.user_orders o
ON CONFLICT DO NOTHING;

-- RLS 는 자동 상속되지 않는다 — 새 테이블에 반드시 재정의
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
```

## 마이그레이션 프로세스

### 1단계: 분석
```markdown
## 마이그레이션 계획

### 변경 사항
- 현재 스키마: [설명]
- 목표 스키마: [설명]
- 영향 받는 행 수: [예상 수]

### 영향도 분석
- 영향 받는 코드: [파일 목록]
- 영향 받는 쿼리/RPC: [목록]
- RLS 정책 / SECURITY DEFINER 함수 변경 필요: [예/아니오]
- prod 반영 여부 확인: `mcp__supabase__list_migrations` 실측
```

### 2단계: 백업
```bash
# Supabase 대시보드 백업(Database → Backups) 또는 pg_dump
pg_dump "$PROD_DB_URL" --schema-only -f backup-schema-$(date +%Y%m%d).sql
```

### 3단계: 마이그레이션 스크립트 작성
```sql
-- uniqn-mobile/supabase/migrations/20260726120000_add_status_to_items.sql
-- ============================================================
-- items.status 추가 — 목적/원인/유지기준을 주석으로 남긴다
-- ============================================================

-- 1. 컬럼 추가 (재실행 안전)
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz;

-- 2. 백필 — 대형 테이블은 락 시간을 줄이려 배치로 나눈다
--    아래는 1배치분이다. 갱신 행이 0이 될 때까지 반복 실행할 것
--    (파일에 1배치만 두면 나머지 행이 미마이그레이션 상태로 남는다)
UPDATE public.items
SET status = 'active', migrated_at = now()
WHERE migrated_at IS NULL
  AND id IN (
    SELECT id FROM public.items WHERE migrated_at IS NULL LIMIT 5000
  );

-- 3. 제약은 백필 완료 후 부여 (NOT VALID → VALIDATE 로 락 최소화)
ALTER TABLE public.items
  ADD CONSTRAINT items_status_check CHECK (status IN ('active', 'archived')) NOT VALID;
ALTER TABLE public.items VALIDATE CONSTRAINT items_status_check;
```

작성 규칙:
- `IF NOT EXISTS` / `IF EXISTS` 로 재실행 안전(idempotent)하게
- 함수·트리거는 `CREATE OR REPLACE` + `SET search_path` 고정
- 정책/함수 수가 바뀌면 `supabase/tests/parity_baseline_guard.test.sql` 의
  `PARITY_EXPECT_FUNCS` / `PARITY_EXPECT_POLICIES` 기대값을 같은 PR에서 갱신

### 4단계: 테스트 (로컬 환경)
```bash
# 로컬 Supabase 스택에서 먼저 실행
cd uniqn-mobile
npm run db:start
npm run db:reset   # 전체 마이그레이션 재적용 — 순서 충돌 조기 검출
npm run test:db    # pgTAP 회귀 (supabase/tests/)
```

### 5단계: 프로덕션 실행
```
# 프로덕션 실행 (주의!) — MCP 경유 단일 마이그레이션 적용
mcp__supabase__list_migrations     # 미적용 목록 확인
mcp__supabase__apply_migration     # 해당 마이그레이션만 적용
```
⚠️ `supabase db push` 금지. 이미 적용된 마이그레이션 재적용 금지.

> 이 스킬의 `allowed-tools` 에는 `mcp__supabase__*` 가 **없다**(설계·작성 전용).
> 실제 prod 적용은 해당 도구가 선언된 `/deploy` 스킬로 넘기거나, 메인 세션에서 직접 호출하라.

### 6단계: 검증
```sql
-- 마이그레이션 검증 쿼리
SELECT
  count(*)                                   AS total,
  count(*) FILTER (WHERE status IS NOT NULL
                     AND migrated_at IS NOT NULL) AS migrated,
  count(*) FILTER (WHERE status IS NULL
                      OR migrated_at IS NULL)     AS failed
FROM public.items;

-- 실패 행 식별
SELECT id FROM public.items
WHERE status IS NULL OR migrated_at IS NULL
LIMIT 50;
```
추가로 `mcp__supabase__list_migrations` 로 적용 이력을 재확인하고,
파리티 기대값(`PARITY_EXPECT_*`)과 prod 실측 카운트가 일치하는지 확인한다.

## 롤백 전략

되돌리기도 **새 마이그레이션 파일**로 수행한다 (기존 파일 수정·삭제 금지).

### 컬럼 추가 롤백
```sql
-- uniqn-mobile/supabase/migrations/20260726130000_revert_add_status.sql
ALTER TABLE public.items
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS migrated_at;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_status_check;
```

### 데이터 복원
데이터 자체의 복원은 Supabase 대시보드 백업 / PITR(Database → Backups)로만 수행한다 —
2단계의 `--schema-only` 덤프에는 데이터가 들어 있지 않다.

```bash
# 스키마 덤프는 빈 DB 재구축·스키마 대조용 (운영 DB에 그대로 덮어쓰지 말 것)
psql "<복구_대상_DB_URL>" -v ON_ERROR_STOP=1 -f backup-schema-20260726.sql
```

## 체크리스트

### 마이그레이션 전
- [ ] 스키마 변경 사항 문서화
- [ ] 영향 받는 코드 파악 (RPC·트리거 함수의 컬럼 참조 포함)
- [ ] 백업 완료
- [ ] 로컬 환경에서 `db:reset` + `test:db` 통과

### 마이그레이션 중
- [ ] 대량 백필은 배치로 분할 (락 시간 최소화)
- [ ] 재실행 안전(`IF EXISTS` / `ON CONFLICT`) 확인
- [ ] 에러 시 중단 (`ON_ERROR_STOP`) 및 트랜잭션 경계 확인

### 마이그레이션 후
- [ ] 데이터 무결성 검증
- [ ] 코드 업데이트 배포
- [ ] RLS 정책 / SECURITY DEFINER 함수 업데이트 + pgTAP 회귀 추가
- [ ] 파리티 기대값(`PARITY_EXPECT_*`) 갱신
- [ ] 모니터링

## 출력 형식

```markdown
## 마이그레이션 계획

### 개요
- 이름: [마이그레이션 이름]
- 대상: [테이블/컬럼]
- 예상 행 수: [N개]

### 변경 사항
| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 컬럼명 | ... | ... |

### 실행 계획
1. [ ] 백업 생성
2. [ ] 로컬 환경 테스트 (db:reset + test:db)
3. [ ] 프로덕션 적용 (apply_migration)
4. [ ] 검증
5. [ ] 코드 배포

### 롤백 계획
[역방향 마이그레이션 파일 내용]
```
