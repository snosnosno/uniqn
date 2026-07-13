# 핸드오프 — 유저플로우 감사 남은 작업 끝까지 (다음 세션 메인 프롬프트)

> 이 파일을 다음 세션 첫 프롬프트로 그대로 붙여넣으면 된다. 2026-07-10~11 세션에서 P0#1·P0#3을 출하했고, 이 문서는 그 뒤를 잇는다.

---

## 붙여넣을 프롬프트 (여기부터)

너는 UNIQN(홀덤펍·대회사 대상 단발 인력매칭 앱, Expo/RN/TS/Supabase)의 유저플로우 감사 후속 구현을 이어받는다. 이전 세션이 감사(코어 10 flow, 확정 24건/8뿌리)를 끝내고 P0 2건을 출하했다. **남은 P0/P1을 끝까지 구현**하는 것이 목표다.

### 먼저 읽어라 (재탐색 금지)
- 메모리 `project_userflow_audit_20260710` — 전체 맥락·완료분·후속
- `docs/analysis/2026-07-10-userflow-audit.md` — 감사 리포트(§4 백로그, §6 P0#1 기록, §8 P0#3 기록)
- 이 파일(`docs/planning/2026-07-11-userflow-audit-remaining-handoff.md`)

### 작업 환경 (엄수)
- **브랜치**: `analysis/userflow-audit-20260710` — 현재 11커밋, **미push**. master는 `e26553d4d`(#222 그리드 머지).
- **워크트리**: `C:/Users/user/Desktop/T-HOLDEM-authority` (node_modules 정션됨). 여기서 작업하라. 없으면 `git worktree add`로 재생성 + `mklink /J` 정션(`MSYS_NO_PATHCONV=1` 필요).
- ⚠️ **병렬 세션이 공유 체크아웃(`C:/Users/user/Desktop/T-HOLDEM`)을 master로 전환한다.** 절대 메인 트리에서 이 브랜치를 작업하지 마라 — blob이 발밑에서 바뀐다(실제로 겪음). 반드시 워크트리에서.
- 다른 워크트리 `.claude/worktrees/ux-flow-review-20260710`(locked)는 병렬 세션 소유 — 건드리지 마라.
- **RLS/권한/마이그 건드리기 전 `/guard` 먼저**, 편집 경계 `uniqn-mobile/`(또는 마이그만이면 `uniqn-mobile/supabase/`).
- 커밋 사전승인됨(로컬만). push/PR은 사용자 명시 요청 시만.
- 마이그레이션은 **prod 함수/정책 본문을 원본**으로 (레포↔prod 발산 이력). 기존 마이그 수정 금지, 새 타임스탬프. 적용은 `mcp__supabase__apply_migration`(db push 금지). 적용 후 **prod 실측 검증** 필수.
- 각 슬라이스: spec 승인 → writing-plans → TDD(RED 확인 필수) → code+security 리뷰(opus 병렬) → 커밋. `npm run quality` + `npm test` + 필요시 `npx supabase test db` 게이트.

### 남은 작업 (우선순위 순)

**즉시 착수 후보 — 이전 세션이 리뷰에서 발견한 실제 결함(선재 패턴)**
- `useStaffSettlementsHandlers.ts` **255·282·348행**이 `posting.ownerId`를 actorId로 넘겨 앱레이어 인가가 no-op이 된다(owner short-circuit 항상 참). 정산 커스텀설정·금액수정 경로. 실쓰기는 RLS가 막지만 P0#3 통합의 신뢰성을 갉는다. **세션 uid로 교체**(서비스 계층 `settlementMutation.updateWorkLogCustomSettlement`에서 `requireCurrentUser()`로 채우고 훅은 안 넘기게). 작다. 여기부터 권장.
- `markAsNoShow`/`updateStatus`/Settlement의 `ownerId` 파라미터명을 `actorId`로 통일(LOW, 의미 불일치·미래 과잉조임 위험).

**P0 (금전·정원·승인게이트) — 남은 3건**
- **B**: `ApplicationRepositoryTransactions.ts:226` `executeCancelConfirmation`가 `p_actor_type='staff_initiates'` 하드코딩 → 구인자 확정해제가 **항상 unauthorized**. 호출자가 owner면 `employer_initiates`로. ⚠️RPC `cancel_application_atomically`(또는 유사) 본문을 prod에서 실측해 actor_type별 분기·바인딩 확인부터. 알림·카운터 경로 회귀 같이 볼 것.
- **C(정산 표시)**: `settlementGrouping.ts:140` 정산 **완료**건 표시액이 현재 급여설정으로 소급 재계산됨. `payroll_amount` 동결값 표시로. 급여도 수당(ES-003)처럼 완료시 스냅샷. ※P0#1로 **입력값 조작은 이미 차단**됨 — 이건 표시/스냅샷 문제.
- **D**: `JobPostingRepository.ts:416` 대회공고 `approvalStatus`가 `status`와 분리 → 미승인 공고가 비로그인 열람+지원까지. 공개(`app/jobs/[id].tsx`)·인증(`app/(app)/jobs/[id]/index.tsx`) 상세 + 지원 경로에 `approvalStatus==='approved'` 게이트. ⚠️기존 대회공고 approvalStatus 분포 prod 실측 후(무단 차단 회귀 주의).

**P1 (마찰·정합성)**
- C: `SettlementRepository.ts:520` 커스텀 급여정보 저장에 서버측 `COMPLETED` 가드(현재 UI만 방어).
- C: QR 체크인 시각을 서버 `clock_timestamp()` 기준 or 편차 임계 검증(`20260702000000_...sql:76`).
- F: 공고 생성 시 `activeWorkspace.id` 명시 전달(`jobManagementService.ts:61` — 현재 가장 오래된 워크스페이스에 붙어 방금 만든 공고가 목록서 사라짐). ⚠️draftAdapter 4매퍼 전수(메모리 #194 region유실 함정).
- F: 워크스페이스 0개 EmptyState에 '보관함' 진입점(`workspace/index.tsx:155` — 마지막 워크스페이스 보관 시 복원경로 소멸).
- E: 취소 요청 제출 시 owner+워크스페이스 멤버+협업자 알림. ⚠️**트리거 `fn_notify_cancellation_request`는 이미 prod에 존재하나 owner 1명에게만 발송** → "수신자 확장"이지 신설 아님.
- E: 스케줄 부분조회 warning 화면 노출(`useSchedules.ts:666` — 훅이 드롭).
- E: 영문 BusinessError userMessage 5개 한글화(`JobPostingRepository.ts:520` 부근).

**P2 (낮음)**: `confirm_application` 동시성 예외 문구 매핑 · JPC 수락/거절 계약(설계 필요) · `CollaboratorSearch.tsx:56` 죽은 분기 · `useWorkspaces.ts:229` 캐시 무효화.

**구현 중 발견한 신규(감사 §6)** — 별도 판단:
- 레포↔prod 파리티: `base_schema.sql:654` 느슨한 notifications INSERT 정책 제거 + `users.nickname` UNIQUE 추가(prod엔 이미 있음/없음, 레포가 더 위험. db reset시 구멍).
- `anon` write grant 회수(notifications·applications·work_logs, RLS만으로 방어 중).
- `notify_on_job_posting_update` 런타임 실패(`malformed array literal: "status"` — pgTAP WARNING, 예외 삼킴 → 알림 조용히 누락 가능). prod 재현 미확인.
- work_logs INSERT/DELETE 정책 파리티(레포에 `work_logs_insert_owner_or_admin`·`work_logs_delete_admin`, prod엔 없음).

### 범위 밖(제품 결정 필요 — 사용자 확인 없이 착수 금지)
- 클러스터 A 잔여 `staff-role-collaborator-locked-out`: `app/(employer)/_layout.tsx` `useHasRole('employer')` 게이트가 staff-role 협업자를 조용히 튕김. "staff-role에게 employer 화면 노출?" 결정 필요.
- 기존 blocker **B1**(fixed 공고 취소 사유 미노출)·**B2**(crossesMidnight) — 이번 감사 범위 밖 별도 트랙.

### 모델 배치 (이전 세션 실측 교훈)
- 읽기·추적·검증 = **sonnet**(대량) / **opus**(적대검증·판단). 종합·설계 = 메인 세션.
- **fable 금지** — `2+3=6` 오답(`pitfall_fable_arithmetic_unreliable`). 판단·검증·종합 자리에 두지 마라.
- Workflow 팬아웃은 **5개씩 순차 배치**(17개 동시=버스트 한도 전원 실패, `pitfall_workflow_burst_agent_limit`).

### 마무리
- 각 슬라이스 완료 시 감사 §4 백로그 체크 + §N 실행기록 추가 + 메모리 갱신.
- 모두 끝나면(또는 사용자 요청 시) 11커밋+신규를 PR로. 브랜치가 커지면 논리 단위로 나눠 PR 제안.
- 세션 끝 `/session-wrap`.

## 프롬프트 끝
