# 공고별 협업자 공유 — 워크스페이스 권한 입자 세분화

- **작성일**: 2026-05-11
- **상태**: 디자인 승인 대기
- **범위**: UNIQN Mobile (`uniqn-mobile/`) + Supabase (DB + Edge Function)
- **배경**: 현재 워크스페이스 권한 모델은 all-or-nothing — `workspace_members.role='editor'` 1명 추가 시 워크스페이스의 모든 공고에 접근 권한이 자동 부여됨. 소규모 운영자가 "특정 공고 1개만 외부 사장님/매니저에게 맡기고 싶다"는 요구를 수용할 수 없음. 이를 해결하기 위해 공고 단위 협업자(`job_posting_collaborators`) 개념을 도입한다.

## 문제 정의

### 현재 상태의 한계

1. **권한 입자 부재** — `is_workspace_member(workspace_id, auth.uid())` RLS 한 번 통과 시 워크스페이스 내 모든 공고의 SELECT/UPDATE 가능 (`supabase/migrations/20260514010000_workspace_m3_consolidate_jp_rls.sql:14-21`)
2. **공고 ↔ 사용자 연결 부재** — `job_posting_members` 같은 테이블 없음. `job_postings.workspace_id` (N:1)만 존재
3. **신규 공고 자동 노출** — workspace_members 에 추가된 editor 는 이후 생성되는 모든 공고를 자동으로 보게 됨
4. **외부 협업자 시나리오 불가** — "외부 매장 사장님/파트너에게 특정 공고 1건만 위탁 운영" 패턴 불가

### 사용자 시나리오 (확정 요구사항)

- **시나리오 A**: 홍대점 사장이 자기 공고 5개 중 "강남점 딜러 모집" 공고 1개만 강남점 매니저(외부인, UNIQN 가입자)에게 풀 위임
- **시나리오 B**: 워크스페이스 editor 는 매니저급으로 모든 공고 자동 접근 (기존 동작 유지)
- **시나리오 C**: 협업자는 자기 워크스페이스 컨텍스트 안에서 "공유받은 공고" 별도 섹션으로 발견

## 결정사항

### D1: 권한 모델은 이중 (workspace editor + 공고별 협업자)

워크스페이스 editor 는 기존 동작 유지(워크스페이스 모든 공고 자동 접근). 추가로 공고 단위로 외부 협업자를 지정 가능. 이중 구조이며 우선순위는 **OR** (둘 중 하나라도 만족하면 접근 허용).

### D2: 협업자 권한 = 풀 관리권 (조회 + 수정 + 지원자 + 스태프 + work_logs + settlements)

해당 공고의 운영 전반을 위임. **공고 삭제만 owner 전용** (워크스페이스 권한 경계 유지). 이는 "이 공고 운영을 통째로 맡긴다"는 시나리오 A 의 자연스러운 적용범위.

### D3: 공유 대상 = 모든 UNIQN 가입자 (이메일로 검색)

워크스페이스 멤버십 강제 없이 외부인도 직접 추가. workspace `invite.tsx:55,74` 의 이메일 lookup 패턴 재사용.

### D4: 즉시 권한 부여 + 푸시 알림 (수락 단계 없음)

owner 가 추가하는 즉시 권한 발효, 받는 사람에게 푸시 알림. 받는 사람이 원치 않으면 본인이 "나가기" 가능. (workspace_invitations 의 pending 패턴 재사용 안 함 — 공고별 권한은 가벼운 작업 단위라 수락 절차가 마찰)

### D5: 받는 사람 동선 = "공유받은 공고" 별도 섹션

`WorkspaceSwitcher` 자체는 변경 없음. `my-postings/index.tsx` 리스트를 [내 공고] / [공유받은 공고] 두 섹션으로 분리. 협업자가 다른 워크스페이스의 컨텍스트(다른 공고/멤버 등)는 절대 못 봄 (RLS 격리).

### D6: 협업자 추가/제거 = workspace owner 전용 (MVP)

editor 도 가능하게 할지는 추후 사용 패턴 보고 결정. MVP 는 안전하게 owner 만. 협업자 본인은 "자기 발 빼기"(자기 행 DELETE) 가능.

### D7: 데이터 모델 = Approach A (별도 테이블 신설)

`job_posting_collaborators` 신설. workspace_members / 일반화 권한 테이블(resource_permissions) 대안 모두 검토 후 기각:
- workspace_members 확장(scope JSONB) 안 → 외부인이 workspace_members 더럽힘 + JSONB RLS 성능 저하
- 일반화 안 → 권한 시스템 전면 리팩토링 필요, PR3-A.2 진행 작업과 충돌, YAGNI

### D8: 마이그레이션은 PR3-A.2 머지 후 시작

PR3-A.2 (admin RLS update/delete split, spec apply 대기 중) 가 job_postings RLS 를 수정 중일 가능성 → 충돌 회피를 위해 머지 후 본 작업 시작. (Soft gate — 스펙/플랜은 지금 작성, 구현만 머지 후 시작.)

### D9: Realtime subscription 활성화 (eng-review 추가)

`job_posting_collaborators` 를 `supabase_realtime` publication 에 등록하고, owner 모달 + collaborator my-postings 의 "공유받은 공고" 섹션 모두 Realtime channel 구독. 이유:
- 즉시 부여 + 푸시 알림 (D4) 의 UX 일관성 — 푸시 받은 직후 my-postings 가 이미 갱신되어 있어야 자연스러움
- 메모리 학습 (PR #67 hotfix): "Realtime 새 테이블 사용 시 publication 등록 필수" — `pg_publication_tables` 사전 확인
- 마이그레이션에 `ALTER PUBLICATION supabase_realtime ADD TABLE public.job_posting_collaborators` 1줄 추가

### D10: Service / Repository 레이어 분리 (eng-review 추가)

CLAUDE.md 아키텍처 규칙 (`Presentation → Hooks → Service → Repository → Supabase`) 준수. 기존 service 패턴 일관성. `src/repositories/jobPostingCollaboratorRepository.ts` 추가:
- Repository: Supabase 직접 호출, snake_case ↔ camelCase 변환, Zod 검증
- Service: 비즈니스 로직 (검증, 권한 체크, 알림 트리거)

### D11: Audit log 테이블 포함 (eng-review 추가, scope 확장)

`job_posting_collaborator_audit` 테이블 신설 + AFTER INSERT/DELETE 트리거. 보존 항목: actor_user_id, target_user_id, job_posting_id, action ('added'|'removed'), at. RLS: workspace owner 만 조회 (운영 가시성). 이유:
- 워크스페이스 데이터 접근 권한 부여/회수 = 보안 중요 액션, 이력 보존 필수
- DELETE 후 added_by/added_at 손실 방지
- "누가 언제 협업자 추가/제거했는지" 운영자 질문 대응

### D12: Edge case 테스트 포함 (eng-review 추가)

다음 user flow 엣지 케이스를 hook/service 테스트 4건으로 추가:
- 네트워크 끊김 상태에서 추가 → 낙관적 업데이트 후 롤백 + 친절 toast
- 푸시 알림 받은 직후 앱 강제 종료 → 재실행 → my-postings 정상 노출 (deep link 큐잉)
- 동시에 owner 두 명 (owner + 다른 PC owner 본인) 같은 사람 추가 → UNIQUE 충돌 → 친절 메시지
- workspace 이양 직후 신규 owner 의 collaborator DELETE 권한 검증 (Section 1.4 권고도 흡수)

## 데이터 모델

### 신규 테이블 (2개)

```sql
-- 1. 협업자 본 테이블
CREATE TABLE job_posting_collaborators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  added_by        uuid NOT NULL REFERENCES auth.users(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_posting_id, user_id),
  CHECK (user_id != added_by)  -- 자가 추가 차단
);

CREATE INDEX idx_jpc_user_id     ON job_posting_collaborators(user_id);
CREATE INDEX idx_jpc_posting_id  ON job_posting_collaborators(job_posting_id);

-- 2. 감사 로그 (D11 — eng-review 추가)
CREATE TABLE job_posting_collaborator_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL,                                  -- FK 안 검 (공고 삭제돼도 보존)
  target_user_id  uuid NOT NULL,                                  -- FK 안 검 (탈퇴해도 보존)
  actor_user_id   uuid NOT NULL,                                  -- FK 안 검
  action          text NOT NULL CHECK (action IN ('added','removed')),
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jpca_posting_id ON job_posting_collaborator_audit(job_posting_id, at DESC);
CREATE INDEX idx_jpca_target_id  ON job_posting_collaborator_audit(target_user_id, at DESC);

-- AFTER INSERT/DELETE 트리거 → 자동 audit
CREATE FUNCTION log_collaborator_audit() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action)
    VALUES (NEW.job_posting_id, NEW.user_id, NEW.added_by, 'added');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action)
    VALUES (OLD.job_posting_id, OLD.user_id, COALESCE(auth.uid(), OLD.added_by), 'removed');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER trg_jpca_log
  AFTER INSERT OR DELETE ON job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION log_collaborator_audit();
```

Audit 테이블 RLS: workspace owner 만 SELECT (`is_workspace_owner` via 공고 join). 다른 작업 차단.

### TypeScript 타입

```typescript
// src/types/job-posting.ts
export interface JobPostingCollaborator {
  id: string;
  jobPostingId: string;
  userId: string;
  addedBy: string;
  addedAt: Date;  // tz-aware, Repository 에서 toDate() 변환
}
```

### Zod 스키마

```typescript
// src/schemas/jobPostingCollaborator.schema.ts
export const JobPostingCollaboratorSchema = z.object({
  id: z.string().uuid(),
  jobPostingId: z.string().uuid(),
  userId: z.string().uuid(),
  addedBy: z.string().uuid(),
  addedAt: z.date(),
});

export const AddCollaboratorInputSchema = z.object({
  jobPostingId: z.string().uuid(),
  email: z.string().email().refine(xssValidation),  // CLAUDE.md 보안 규칙
});
```

## RLS 정책

### `job_posting_collaborators` 자체 정책

| 작업 | USING / WITH CHECK |
|------|-------------------|
| **SELECT (collaborator 본인)** | `user_id = auth.uid()` |
| **SELECT (workspace 멤버)** | `EXISTS(SELECT 1 FROM job_postings jp WHERE jp.id = job_posting_id AND is_workspace_member(jp.workspace_id, auth.uid()))` |
| **INSERT** | workspace owner 만: `is_workspace_owner(jp.workspace_id, auth.uid())` |
| **DELETE (owner 가 제거)** | `is_workspace_owner(jp.workspace_id, auth.uid())` |
| **DELETE (본인 나가기)** | `user_id = auth.uid()` |

DELETE 정책은 두 케이스 OR 로 단일 정책 작성. UPDATE 는 정책 없음 (행 immutable, 변경 시 DELETE+INSERT).

### 영향 받는 기존 RLS 정책 (OR 추가)

다음 테이블의 SELECT/UPDATE 정책에 `OR is_posting_collaborator(<해당 테이블의 job_posting_id>, auth.uid())` 추가 (헬퍼 함수는 아래 § 헬퍼 함수 섹션):

- `job_postings` — `20260514010000_workspace_m3_consolidate_jp_rls.sql:14-21`
- `applications`
- `staff_assignments`
- `work_logs` (D2 결정에 따라)
- `settlements` (D2 결정에 따라)
- 기타 공고 종속 테이블 (audit 단계에서 확정)

### Audit 단계 (마이그레이션 작성 전 필수)

다음 항목을 사전 audit 하여 RLS 변경 대상 확정:

1. `job_postings` 를 FK 로 참조하는 모든 테이블 목록 (`pg_constraint` 조회)
2. 각 테이블의 현재 RLS 정책에서 `is_workspace_member` / `is_workspace_owner` 호출 위치
3. 알림 발송 대상자 결정 로직 (trigger / edge function / RPC) 위치 및 collaborator 추가 위치
4. PR3-A.2 가 변경하는 정책과의 충돌 여부

audit 결과는 본 spec 의 별도 섹션 또는 후속 plan 문서에 기록.

## 헬퍼 함수

```sql
-- collaborator 여부 확인 (RLS 에서 재사용)
CREATE FUNCTION is_posting_collaborator(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.job_posting_collaborators
    WHERE job_posting_id = p_posting_id AND user_id = p_user_id
  );
$$;
```

`is_workspace_member` 와 같은 패턴 (SECURITY DEFINER + search_path 격리). RLS 무한 재귀 방지 (메모리 학습: WITH CHECK 자기 self-SELECT 함정).

## UI — owner 측 진입점

### 진입점 1: 공고 상세 헤더

`app/(employer)/my-postings/[id]/index.tsx` 헤더에 멤버 아바타 스택 + "공유 관리" 버튼.

- 아바타 3개 + "+N" overflow + "공유 관리" 텍스트
- 0명일 때: `+ 협업자 추가` CTA 형태
- workspace editor / collaborator 시점엔 아바타만 (탭 시 read-only 모달)

### 진입점 2: 공고 목록 카드 인디케이터

`app/(employer)/my-postings/index.tsx` 카드 우측 상단에 협업자 1명 이상일 때만 `●●● N` 뱃지. 0명일 땐 표시 안 함 (시각 노이즈 최소화).

### 진입점 3 (MVP 제외)

워크스페이스 화면의 "공유한 공고" 요약 카드 — 추후 사용 패턴 보고 추가.

## UI — 협업자 관리 화면

### 라우트

`app/(employer)/my-postings/[id]/collaborators.tsx` (Stack `presentation: 'modal'`)

### 레이아웃

상단: 공고 제목 + "N명이 함께 관리 중"

검색 영역:
- 이메일 input (debounce 300ms, ≥3자)
- `userService.searchByEmail(query)` 결과 카드
- 탭 → optimistic insert → push 알림 trigger

현재 협업자 리스트:
- 이름 + 이메일 + 추가일
- ✕ 버튼 (owner 만)
- 본인 행에 "나가기" (collaborator 자신)

### 검증 / 예외 케이스 (검색 시점)

| 케이스 | UI 처리 |
|--------|---------|
| 자기 자신 | 검색 결과에서 미표시 (DB CHECK 도 백업) |
| 이미 workspace member | "이미 워크스페이스 멤버 — 모든 공고 접근 가능" hint, 추가 비활성 |
| 이미 collaborator | "이미 협업자" 표시 |
| UNIQN 미가입 | "UNIQN에 가입한 사용자만 추가할 수 있어요" |

### 권한별 화면 분기

| 사용자 | 화면 |
|--------|------|
| workspace owner | 풀 화면 (검색 + ✕) |
| workspace editor | 검색 비활성 + 협업자 read-only |
| collaborator 본인 | 검색 비활성 + 자기 행 "나가기" 만 |
| 그 외 | 라우트 가드로 진입 차단 |

### 컴포넌트 분해

```
app/(employer)/my-postings/[id]/collaborators.tsx       # 라우트 (~120줄)
src/components/job-posting/CollaboratorSearch.tsx       # 검색+결과 (~150줄)
src/components/job-posting/CollaboratorList.tsx         # 리스트 (~100줄)
src/components/job-posting/CollaboratorRow.tsx          # 행 (~60줄)
src/hooks/job-posting/useJobPostingCollaborators.ts     # TanStack Query + Realtime (~120줄)
src/hooks/job-posting/useSharedJobPostings.ts           # 공유받은 공고 (~80줄)
src/services/job-posting/collaboratorService.ts         # 비즈니스 로직 + 검증 (~120줄)
src/repositories/jobPostingCollaboratorRepository.ts    # Supabase 직접 호출 + 변환 (~80줄)
```

각 파일 200줄 이하 (golden principle #5 준수).

## UI — 받는 사람 동선

### my-postings 목록 — 섹션 분리

```
─── 내 공고 (5) ──────────────  + 새 공고
[card] 홍대점 딜러 모집      ●●● 3
[card] 강남점 플로어 모집
...

─── 공유받은 공고 (2) ──────────────       ← 1개 이상일 때만
[card] 신촌점 서빙 모집      🔗
       2026-05-18 · @박사장님 워크스페이스
```

- FlashList `sections` (대형 리스트 — CLAUDE.md 규칙)
- 출처 워크스페이스 이름 표시 (멘탈모델 고정)
- 🔗 = 공유받은 공고 마커
- 0개일 땐 섹션 헤더 자체 미렌더

### 공고 상세 — owner 와 동일 화면

권한 매트릭스:

| 액션 | owner | workspace editor | collaborator |
|------|-------|------------------|--------------|
| 공고 정보 보기 | ✅ | ✅ | ✅ |
| 공고 정보 수정 | ✅ | ✅ | ✅ |
| 공고 삭제 | ✅ | ❌ | ❌ |
| 지원자 보기/승인/거절 | ✅ | ✅ | ✅ |
| 스태프 배정 | ✅ | ✅ | ✅ |
| work_logs 조회/편집 | ✅ | ✅ | ✅ |
| settlements 조회 | ✅ | ✅ | ✅ |
| 협업자 추가/제거 | ✅ | read-only | read-only (자기만 나가기) |

상단 헤더에 출처 표시: `🔗 박사장님 워크스페이스의 공고`

### 데이터 흐름

```
my-postings/index.tsx
    ↓
useJobPostings(workspace_id)   ← 기존 hook
useSharedJobPostings()         ← 신규 hook
    └─ SELECT jp.*, w.name as source_workspace_name
       FROM job_postings jp
       JOIN workspaces w ON jp.workspace_id = w.id
       WHERE jp.id IN (
         SELECT job_posting_id FROM job_posting_collaborators
         WHERE user_id = auth.uid()
       )
    ↓
useQueries → FlashList sections
```

두 쿼리 병렬 실행 (`Promise.all` 또는 useQueries) — 추가 latency 없음.

### 워크스페이스 컨텍스트 격리

- `WorkspaceSwitcher` 의 active workspace = 본인 워크스페이스 (변경 없음)
- 공유받은 공고는 본인 워크스페이스 컨텍스트 안에서 별도 섹션으로만 노출
- 박사장님 워크스페이스의 다른 공고/멤버는 절대 못 봄 (RLS 격리, FK 격리)

## 알림

### 푸시 알림 트리거 (3가지)

| 이벤트 | 받는 사람 | 메시지 예시 |
|--------|-----------|-------------|
| 협업자 추가됨 | 추가된 collaborator | `🤝 박사장님이 "홍대점 딜러 모집" 공고 관리에 초대했어요` |
| 협업자 제거됨 | 제거된 collaborator | `홍대점 딜러 모집 공고 관리에서 제외되었어요` (조용히, no badge) |
| 새 지원자 신청 | owner + workspace editors + collaborators | `🙋 김지원님이 홍대점 딜러 모집에 지원했어요` |

### 인프라

기존 `notification_outbox` + Edge Function `sync-schedule-board-outbox` 패턴 재사용 (drift 수정 완료, end-to-end 200 검증 — 메모리 참조).

### 신규 outbox 이벤트 타입

```typescript
type NotificationEvent =
  | ...existing
  | { type: 'job_posting_collaborator_added',
      job_posting_id: string,
      added_by_name: string,
      job_posting_title: string }
  | { type: 'job_posting_collaborator_removed',
      job_posting_title: string }
```

### Trigger 구현

```sql
CREATE FUNCTION notify_collaborator_added() RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_outbox (user_id, event_type, payload)
  VALUES (
    NEW.user_id,
    'job_posting_collaborator_added',
    jsonb_build_object(
      'job_posting_id', NEW.job_posting_id,
      'added_by', NEW.added_by,
      'added_at', NEW.added_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jpc_added
  AFTER INSERT ON job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION notify_collaborator_added();

-- DELETE trigger 도 동일 패턴 (제거됨 알림)
```

### 새 지원자 알림 — 기존 로직 확장

신규 지원자 알림 로직(trigger / edge function / RPC) 위치 audit 후 수신자 목록에 collaborator UNION 추가:

```sql
WITH recipients AS (
  SELECT w.owner_id AS user_id FROM workspaces w
    JOIN job_postings jp ON jp.workspace_id = w.id WHERE jp.id = NEW.job_posting_id
  UNION
  SELECT wm.user_id FROM workspace_members wm
    JOIN job_postings jp ON jp.workspace_id = wm.workspace_id WHERE jp.id = NEW.job_posting_id
  UNION
  SELECT user_id FROM job_posting_collaborators WHERE job_posting_id = NEW.job_posting_id
)
INSERT INTO notification_outbox (user_id, event_type, payload)
SELECT user_id, 'application_submitted', ... FROM recipients;
```

### 인앱 표시 / Deep link

- 추가됨 알림 탭 → my-postings 의 "공유받은 공고" 섹션으로 deep link
- 새 지원자 알림 탭 → 해당 공고 상세 / 지원자 탭
- in-app banner (OfflineBanner 와 공존하는 디자인)

## 엣지 케이스 & 정책

### Cascade 삭제

| 트리거 | 동작 |
|--------|------|
| 공고 삭제 | `ON DELETE CASCADE` → collaborators 자동 삭제 (push 알림 X) |
| user 탈퇴 | `ON DELETE CASCADE` → 해당 user 의 모든 collaborator 행 삭제 |
| workspace 삭제 | 공고 cascade → collaborators cascade (연쇄) |

### Workspace owner 변경 / 이양

현재 워크스페이스 모델은 `owner_id` 단독 — 이양 흐름 audit 항목. 만약 이양 발생 시 collaborators 는 그대로 유지 (공고 단위 권한이라 owner 와 무관). 신규 owner 가 collaborators 보고 제거 가능.

### Workspace editor 가 collaborator 로도 추가됨

UI 에서 추가 시점에 차단 ("이미 워크스페이스 멤버" 표시 + 비활성). 이미 데이터에 있다면 무해 (RLS OR 조건이라 중복 평가만 발생).

### Workspace editor → collaborator 만 남기고 싶을 때

자동화 안 함. workspace editor 제거 → 필요한 공고에 collaborator 로 다시 추가 (명시적 액션이 더 안전).

### 동시 편집 충돌

last-write-wins (RN/Supabase 기본). MVP 에서 OT/CRDT 도입 안 함. 큰 충돌 우려 시 추후 `updated_at` optimistic lock 추가.

### Collaborator cap

없음 (MVP). collaborator 는 workspace_members 에 들어가지 않으므로 workspaces cap 과 무관. abuse 패턴 보고 추후 결정.

### Localhost dev = production DB 함정

`.env.local` 이 prod DB 가리키므로 dev 테스트 시 실제 prod 데이터 변경됨 (메모리 학습 2026-05-09). collaborator 추가/제거 dev 테스트 시 dev 전용 워크스페이스 + 더미 사용자로만 검증. staging branch (`mcp__supabase__create_branch`) 사용 권장.

## 마이그레이션 전략

### 순서

1. **PR3-A.2 머지 대기** (필수)
2. **Audit 단계** — 영향 받는 RLS / 알림 로직 / 의존 테이블 확정 (audit 결과 plan 문서에 기록)
3. **마이그레이션 1**: `job_posting_collaborators` 테이블 + 헬퍼 함수 + 자체 RLS
4. **마이그레이션 2**: 기존 RLS 정책 OR 추가 (job_postings, applications, staff_assignments, work_logs, settlements, ...)
5. **마이그레이션 3**: trigger 추가 (notify_collaborator_added, notify_collaborator_removed) + 신규 지원자 알림 로직 확장
6. **마이그레이션 4 (필요 시)**: 인덱스 최적화 (사용 패턴 보고)

각 마이그레이션은 staging branch 에서 dry-run 검증 후 prod apply (메모리 학습 2026-05-10: plpgsql lazy 컴파일이 column mismatch 가림 → `SELECT * FROM rpc() LIMIT 0` 호출 검증 필수).

### 마이그레이션 도구

- Supabase MCP `apply_migration` (메모리 학습 2026-04-19: `supabase db push` 금지)

### 백워드 호환

- 기존 workspace_members 동작 변경 없음
- 기존 RLS 정책에 OR 만 추가 → 기존 권한 보유자는 영향 없음
- 신규 컬럼/필드 없음 → 클라이언트 강제 업그레이드 불필요

## 테스트 전략

### 1. RLS 매트릭스 테스트 (가장 중요)

5개 테이블 × 4 페르소나 × 4 작업 = **80 케이스**. **`supabase/tests/` 하위 .sql 파일 + pg_prove 로 CI 자동 실행** (eng-review 결정). plpgsql ASSERT 로 행 수 검증, GitHub Actions matrix job 으로 통과 여부 gate.

| | owner | editor | collaborator | 외부인 |
|---|-------|--------|--------------|--------|
| job_postings (자기) SELECT | ✅ | ✅ | ✅ | ❌ |
| job_postings (자기) UPDATE | ✅ | ✅ | ✅ | ❌ |
| job_postings (자기) DELETE | ✅ | ❌ | ❌ | ❌ |
| job_postings (다른 워크스페이스) SELECT | ❌ | ❌ | ❌ | ❌ |
| applications (자기 공고) SELECT/UPDATE | ✅ | ✅ | ✅ | ❌ |
| staff_assignments (자기 공고) SELECT/UPDATE | ✅ | ✅ | ✅ | ❌ |
| **work_logs (자기 공고) SELECT/UPDATE** | ✅ | ✅ | ✅ | ❌ |
| **settlements (자기 공고) SELECT** | ✅ | ✅ | ✅ | ❌ |

추가 cascade 시나리오 테스트:
- workspace 삭제 → 공고 cascade → collaborators cascade
- user 탈퇴 → 해당 user 의 collaborator 행 삭제
- 공고 삭제 → 해당 공고의 collaborators 삭제

추가 owner 이양 테스트:
- workspace owner 변경 후 신규 owner 가 collaborator DELETE 권한 확보 검증

### 2. Service 레이어 테스트 (Jest)

`src/services/job-posting/__tests__/collaboratorService.test.ts`:

- `addCollaborator`: 자기 자신 추가 시 ValidationError
- `addCollaborator`: 이미 workspace_member 인 사용자 추가 시 ConflictError + hint
- `addCollaborator`: 이미 collaborator 인 사용자 추가 시 ConflictError
- `addCollaborator`: UNIQN 미가입 사용자 → NotFoundError
- `addCollaborator`: 성공 시 outbox 에 알림 이벤트 생성
- `removeCollaborator`: workspace owner 가 제거 → 성공
- `removeCollaborator`: collaborator 가 본인 제거 → 성공
- `removeCollaborator`: 다른 collaborator 가 제거 시도 → AuthError
- `listCollaborators`: workspace 멤버 read-only 조회 가능

목표 커버리지 80%.

### 3. Hook 테스트 (TanStack Query)

`src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx`:

- 낙관적 업데이트: 추가 즉시 리스트에 표시 → 실패 시 롤백
- 낙관적 업데이트: 제거 즉시 리스트에서 제거 → 실패 시 롤백
- staleTime: 30초 캐시 유지

`useSharedJobPostings`:

- collaborator 인 공고만 반환
- 워크스페이스 정보(이름) JOIN
- 빈 결과 시 빈 배열

`useJobPostingCollaborators` Realtime:

- INSERT 이벤트 수신 → 캐시에 추가
- DELETE 이벤트 수신 → 캐시에서 제거
- 채널 unsubscribe 정리 검증 (메모리 leak 방지)

### 4. UI 통합 테스트 (스모크)

핵심 시나리오 3개:

- owner 가 협업자 추가 → 모달 닫힘 → 헤더 아바타 +1
- collaborator 시점에서 my-postings 진입 → "공유받은 공고" 섹션 표시
- collaborator 가 자기 발 빼기 → 모달 닫힘 + 리스트에서 제거

### 5. Push 알림 검증

- staging branch 에서 실제 push 발송 (Edge Function 호출 확인)
- notification_outbox 행 생성 → trigger fire → expo push token 발송
- `mcp__supabase__get_logs` 로 edge function 로그 확인

### 6. Migration dry-run

staging branch 에서 모든 신규 RLS 정책 4 페르소나 시드 → SELECT 실측. 헬퍼 함수는 `SELECT is_posting_collaborator(uuid, uuid) LIMIT 0` 호출 검증.

### 7. Performance 모니터링 (eng-review 추가)

마이그레이션 후 staging branch 에서 `EXPLAIN ANALYZE` 실측 항목:
- `SELECT * FROM job_postings WHERE id = $1` (RLS OR 적용 후) — index 사용 확인
- `SELECT * FROM applications WHERE job_posting_id = $1` (RLS OR 적용 후)
- application INSERT trigger 의 UNION 쿼리 (3-way) — 행당 5ms 이하 목표
- 1000 활성 공고 + 100 apps/공고 시나리오 시뮬레이션

실측 결과 미달 시 인덱스 추가 (workspace_members.workspace_id, job_postings.workspace_id 사전 audit).

## 영향 범위 정량

| 항목 | 수치 |
|------|------|
| 신규 마이그레이션 파일 | 5~6개 (테이블/RLS/트리거/publication/audit/RLS OR 확장) |
| 변경되는 RLS 정책 수 | 5~7개 (audit 후 확정) |
| 신규 테이블 | 2개 (`job_posting_collaborators`, `job_posting_collaborator_audit`) |
| 신규 트리거 | 3개 (added/removed/audit) |
| 변경되는 trigger | 1개 (신규 지원자 알림 — 수신자 UNION) |
| 신규 헬퍼 함수 | 1개 (`is_posting_collaborator`) |
| 신규 publication entry | 1개 (`supabase_realtime` ADD TABLE) |
| 신규 클라이언트 파일 | 8개 (라우트 1 + 컴포넌트 3 + hook 2 + service 1 + repository 1) |
| 변경되는 클라이언트 파일 | 3개 (my-postings/index.tsx, my-postings/[id]/index.tsx, types/notification.ts) |
| 신규 테스트 파일 | 5개 (RLS pg_prove .sql 1개 + service/hook/repo Jest 4개) |
| 모니터링 항목 | 4개 (RLS index 사용, UNION trigger 시간, Realtime 채널 수, 푸시 도달률) |

## 미확정 / 후속 결정

- 협업자 추가/제거 권한을 editor 까지 확장할지 (MVP 후 결정)
- 알림 설정에서 collaborator 알림 끄기 옵션 (MVP 제외)
- 진입점 3 (워크스페이스 화면 "공유한 공고" 요약 카드) (MVP 제외)
- collaborator cap (MVP 제외)
- Workspace owner 이양 흐름 audit (별도 작업)
- Audit log 테이블 (collaborator add/remove 이력) (TODOS 후보 — eng-review)
- 푸시 알림 backward compat 명시 (구현 상세에 위임 — eng-review)
- User flow 엣지 케이스 (네트워크 끊김, 강제 종료 후 재실행, UNIQUE 충돌 친절 메시지) (TODOS 후보)

## NOT in scope (eng-review 명시)

- **Realtime 외 동기화 모델** (CRDT, OT) — last-write-wins 로 충분
- **Collaborator 권한 차등** (manager / viewer) — 풀 관리권만 (D2)
- **Collaborator 본인이 다른 collaborator 추가** — owner 만 (D6)
- **Workspace editor 의 collaborator 관리** — owner 만 (D6, MVP)
- **외부 소셜 로그인을 통한 즉석 가입 + 초대** — UNIQN 가입자만 (D3)
- **공고 템플릿 / 정산 등 다른 리소스 공유** — Approach C 기각, 추후 일반화 시 재검토 (D7)
- **Cross-workspace collaborator 검색** (이메일 외 다른 사용자 발견 방법) — MVP 제외

## What already exists (eng-review 명시)

- **`is_workspace_member` / `is_workspace_owner` 헬퍼** — 같은 패턴으로 `is_posting_collaborator` 추가
- **`workspaces.owner_id` + `workspace_members.role='editor'` 모델** — 변경 없이 그대로 사용
- **`notification_outbox` + Edge Function `sync-schedule-board-outbox`** — 이벤트 타입만 추가, 인프라 그대로 재사용 (drift 수정 완료, end-to-end 200 검증)
- **`workspace_invitations` 의 이메일 lookup 흐름 (`invite.tsx:55,74`)** — 검색 UI 재사용
- **`workspace/index.tsx:225-318` 멤버 추가/제거 패턴** — UI 디자인 톤 재사용
- **`createRealtimeSubscription` 헬퍼 (PR #67)** — Realtime hook 에서 재사용
- **CLAUDE.md 아키텍처 규칙 (Service → Repository → Supabase)** — 신규 파일도 동일 적용

## 참조

- `supabase/migrations/20260514010000_workspace_m3_consolidate_jp_rls.sql` — M3 RLS (수정 대상)
- `app/(employer)/workspace/invite.tsx:55,74` — 이메일 lookup 패턴 재사용
- `app/(employer)/workspace/index.tsx:225-318` — 멤버 추가/제거 UI 패턴 참조
- 메모리: pitfall_rls_with_check_self_select_recursion.md, feedback_supabase_migration_workflow.md, feedback_localhost_dev_production_db.md, feedback_staging_dryrun_ddl_only_insufficient.md, project_push_notification_setup.md
- 진행 중 작업: PR3-A.2 (`docs/superpowers/plans/2026-05-11-pr3a2-admin-rls-update-delete-split.md`) — 머지 후 본 작업 시작
