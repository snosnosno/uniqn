# ADR: 공고 템플릿(job_posting_templates) — 워크스페이스 비공유 (owner-only) 유지

**상태**: Accepted
**날짜**: 2026-05-09
**작성자**: workspace 협업 Phase 3E
**관련 plan**: `docs/superpowers/plans/2026-05-08-workspace-collaboration-completion.md`

## 컨텍스트

워크스페이스 협업 (M1~M5 + Phase 1A/1B/2A/3A/3B/3C) 작업의 일부로, `job_posting_templates`
테이블을 워크스페이스 분기 (editor 공유) 대상에 포함시킬지 검토함.

**현재 상태:**

```sql
-- pg_policy job_posting_templates (4개)
templates_select_own  : USING  (user_id = auth.uid())
templates_insert_own  : CHECK  (user_id = auth.uid())
templates_update_own  : USING  (user_id = auth.uid())
templates_delete_own  : USING  (user_id = auth.uid())
```

모두 `user_id = auth.uid()` — 즉 **개인 소유 자산** 모델. 워크스페이스
멤버십과 무관.

## 결정

**owner-only (개인 자산) 모델 유지**. workspace 분기 추가하지 않음.

## 이유

### 1. 템플릿은 작업자 개인의 일하는 방식 산출물

공고 템플릿은 "내가 자주 쓰는 공고 양식" 으로, 다음 특성을 가짐:

- 개인 글쓰기 스타일 (제목 패턴, 설명 톤)
- 개인 정산 정책 (시급/일급 기본값)
- 개인 모집 직무 구성 (자주 쓰는 role 조합)

editor 가 owner 의 템플릿을 그대로 보거나 수정할 수 있게 하면, 개인 작업
스타일이 강제 노출되어 부담을 발생시킴. 협업 = 데이터 공유가 아니라
**실행 단계에서의 공동 운영** 임.

### 2. 권한 모델 복잡도 — created/edited 추적 부담

템플릿을 워크스페이스 자산으로 만들 경우:

- 누가 만들었는지 (`created_by`)
- 누가 마지막으로 수정했는지 (`updated_by`)
- 변경 이력 (`modification_history` jsonb)
- 다른 멤버 템플릿을 수정/삭제 가능한지 (role 별 권한)

이 모든 메타데이터를 추적해야 충돌이나 분쟁 시 책임 소재를 가릴 수 있음.
공고/work_logs/지원자처럼 운영 데이터는 RLS 분기로 충분하지만,
**템플릿은 협업 산출물 의 1차 자산** 이라 더 정교한 권한 모델 (Notion /
Google Docs 같은 공유 권한) 이 필요해짐. 현 단계에서 이 복잡도는
요구사항 (공유 공고 운영) 대비 과잉.

### 3. 기존 client 흐름 — 호환성 유지

현재 클라이언트는:

- `templateRepository.list(userId)` — 본인 user_id 기반
- `templateRepository.create({ userId, ... })` — INSERT 시 user_id 자동 주입
- 템플릿 모달 (TemplateModal) 도 본인 템플릿만 표시

워크스페이스 분기를 추가하면 모든 호출 지점에 "어느 워크스페이스 / 어느
사용자 템플릿인가" 분기를 도입해야 함. 이는 client 흐름 전반의
재설계를 요구하며, M1~M5 의 단일성 (Service → Repository → Supabase) 와
충돌함.

### 4. 사용자 요구 검증 부재

현재까지 "editor 도 owner 의 템플릿 사용 가능" 요구사항은 plan 또는
사용자 피드백에서 확인되지 않음. 공유 공고 운영의 핵심은 작성/수정/지원자
관리/정산이며, 템플릿 공유는 별도 mature feature 로 후속 고민 가능.

## 대안 검토

### 옵션 A — 워크스페이스 모든 멤버가 모든 템플릿 SELECT/UPDATE/DELETE 가능

- 장점: 단순한 RLS 분기 (`is_workspace_member(workspace_id, auth.uid())`)
- 단점: editor 가 owner 의 사적 템플릿 변경 가능 → 신뢰 문제. 또한
  `job_posting_templates` 에는 `workspace_id` 컬럼 자체가 없음 (별도 migration
  필요).

### 옵션 B — owner 만 작성, editor 는 SELECT 가능 (read-only)

- 장점: editor 가 owner 의 표준 양식을 참고 가능
- 단점: 옵션 A 와 같은 컬럼 추가 필요. 추가로 "owner 가 의도하지 않은
  템플릿 (테스트, 미완성)" 이 editor 에게 노출될 가능성. owner 가 별도로
  공개/비공개 토글을 만들어야 함.

### 옵션 C — owner-only 유지 (선택)

- 장점: 현재 모델 유지, 마이그레이션 0, client 변경 0
- 단점: 향후 템플릿 공유 요청 시 별도 spec/migration 필요

## 향후 검토 트리거

다음 중 하나 충족 시 본 ADR 재검토:

1. **사용자 명시 요구**: "editor 도 owner 의 템플릿 사용 가능해야 한다"
   는 명시적 피드백 (≥ 3건 또는 핵심 고객 요청)
2. **공유 공고 빈도 임계 도달**: 워크스페이스 협업 사용량이 누적되어
   editor 가 owner 의 양식 그대로 사용해야 할 운영 빈도 발생
3. **별도 spec 작성**: "공유 템플릿" 을 1차 feature 로 정의 (권한 모델,
   변경 이력, 충돌 해결, UI 패턴 모두 포함)

## 영향

- migration: 0건
- client 변경: 0건
- pg_policy: 변경 없음 (owner-only 4개 정책 유지)
- 테스트: 변경 없음
- 다른 워크스페이스 RLS 작업과 독립적 (Phase 3B/3C 머지 후에도 영향 없음)

## 관련 문서

- plan: `docs/superpowers/plans/2026-05-08-workspace-collaboration-completion.md` — Phase 3E
- 작업 컨텍스트: `CLAUDE.md` 중 `2026-04-18 업데이트` (templates 인터페이스 리팩토링 시점)
- 관련 PR: 본 ADR 단독 (코드 변경 없음)
