# 핸드오프 — 공고작성 주문서 통일 S4(레거시 은퇴) + 머지 (다음 세션 메인 프롬프트)

> S1(대회 생성)+S2(고정 생성)+전체리뷰 fix+**S3(전 타입 편집, SDD 5커밋+최종리뷰 fix)**까지 완료(브랜치 `docs/order-sheet-unification-design @6faa74ad3`, 로컬·미push).
> 아래 "메인 프롬프트"를 다음 세션에 그대로 붙여넣어 시작한다. **1세션 = 1슬라이스** — 이번은 **S4(레거시 은퇴)**가 마지막 슬라이스이며, 완료 후 **master 재통합→push→PR까지** 이 세션에서 진행한다(사용자 2026-07-17 승인 — 머지는 CI green+최소 스모크 확인 후).

---

## 메인 프롬프트

공고작성 주문서 통일의 **S4 — 레거시 은퇴**를 계획 작성→SDD 구현→최종 리뷰→master 재통합→push→PR 생성까지 끝까지 진행해줘. (push·PR은 이번에 사전 승인됨 — 머지는 CI green + 최소 스모크 후.)

**착수 전 필수 확인 (실증된 함정 — 반드시 선행):**
1. `git status` + `git branch --show-current` — 작업 브랜치 **`docs/order-sheet-unification-design`**, HEAD **`6faa74ad3`**(S1 5+S2 9+리뷰fix 4+S3 5커밋+docs, 미push). 다르면 바로잡고 시작.
2. **병렬 세션 격리**: 단일트리 동시세션이 워킹트리를 master로 되돌린 실증 있음. **커밋 직전마다 `git branch --show-current` 재확인**, master 직접 커밋 금지, append 커밋만(리베이스·리셋·amend 금지). 내가 만들지 않은 미커밋 **코드** 변경이 있으면 워크트리 격리(문서·`.claude/skills/`·TODOS.md는 타 세션 산출물 — 미터치, add는 항상 명시 경로).
3. SDD ledger 확인: `.superpowers/sdd/progress.md` 하단 S3 섹션 — 이월 목록이 이 문서와 함께 S4의 입력이다.

**설계 SSOT**: `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` §6-4(S4)·§7(함정)·§8(검증). S3 결과·계약: 메모리 `project_order_sheet_unification_all_types` + ledger S3 섹션.

**1단계 — S4 계획 작성 (플랜 아직 없음). 계획 전 실측이 필수인 지점:**

### S4 범위 — S3 완료 기준 갱신판

**⚠️ 전제 교정**: 원래 설계의 "draftAdapter 제거"는 실측상 부분 은퇴다. S3의 `valuesToCreateInput`/`valuesToUpdateInput`이 `draftToCreateJobPostingInput`/`draftToUpdateJobPostingInput`에 **위임**하고, edit 하이드레이션이 `jobPostingToDraft`를, mappers·jobTemplate이 `buildFixedSyntheticRequirement`를 사용한다 — **살아있는 심볼은 이주(또는 존치·개명) 후 제거, 통째 삭제 금지**. 위임을 풀고 mappers로 이주할 경우 **T1 등가성 스위트(mappers.update.test.ts의 신·구 등가성 it.each)가 그 순간부터 실질 게이트가 된다**(현재는 위임 구조라 동어반복 — S3 최종리뷰 명기 사항). 이주 여부·파일 배치는 계획 단계에서 의존 그래프 실측 후 결정.

1. **레거시 폼 제거**: `JobPostingScrollForm` + job-form 섹션들(BasicInfoSection·DateRequirementsSection·RolesSection·SalarySection·ScheduleSection·PreQuestionsSection·SectionCard)·`PostingTypeSelector`·`LoadTemplateModal`(레거시 분기 전용) — **삭제 전 소비자 전수 grep**(edit.tsx는 S3에서 이미 이탈, create.tsx 사문 분기 외 다른 화면·admin 사용 여부 실측).
2. **create.tsx 사문 분기 삭제**(주석에 "S4 제거 예정" 마킹됨): `legacyType`/`isLegacyForm`/`handleSwitchToLegacyForm`/사문 Alert/레거시 렌더 분기 — 호출자 0 실증 완료. `updateFormData`의 M7 복귀 경로도 함께 사문.
3. **OrderSheetScreen `onSwitchToLegacyForm` prop 제거**(S3에서 optional화 완료, 소비 0 — create.tsx 전달부와 계약 주석·테스트 mock 전달분까지).
4. **레거시 전용 유틸 정리(실측 후)**: `submission.ts`의 `buildUpdateJobPostingInput`(S3 이후 라이브 호출자 0)·`draftToFormData`/`formDataToDraft`/`applyFormDataPatch`(레거시 폼 전용 여부 grep)·`validation.ts` `validateAllSections`(레거시 edit 전용이었음 — 다른 소비자 실측).
5. **knip 데드코드 정리**: `knip:gate` 래칫 준수(2344 이하 유지·삭제만큼 하향). 함정: peer-only 네이티브(mmkv/nitro) `knip.ignoreDependencies` 보호·babel/expo-modules-core 오탐 삭제 금지(`pitfall_knip_falsepositive_build_config`).
6. **S3 이월 정리(같은 슬라이스에서)**: ①stripIds 전 깊이 id 제거 재점검 ②scheduleLocked 부가 가드(그룹삭제·일정추가·토스트) 테스트 ③edit ghost '템플릿 저장' 렌더 테스트 ④`setIsDirty(false)`→`router.back()` 순서 정리(unsaved guard stale 여지) ⑤create.tsx:96-97 프리셋 제외 주석 stale(S1 이월분).

**불변 계약**: 한글(주석·커밋·문구) · `logger` · `dark:` · `@/` 경로 · camelCase · 커밋 `<type>(<scope>): 한글` · **서버 무변경**(마이그·RLS·EF·`serialization.ts` 산출 0 — JSON-only OTA 유지) · 삭제 태스크마다 빌드·초점 테스트 green 후 커밋(대량 삭제 한 커밋 금지 — 참조 무결성 단위로 쪼갤 것).

**무조치 확정(재제안 금지)**: 스키마 상호배타 반강제(설계 ⑤) · WorkConditionSheet rounded-lg vs RolesSheet rounded-full(RolesSheet 쪽 후속) · hasConfirmedApplicants TOCTOU(서버 가드 최종 방어) · T2 toEqual(approvedConfig) 확장 · update patch 시맨틱의 conditions 상시 전달은 **S3 fix로 확정된 계약**(6faa74ad3) — 되돌리기 금지.

**2단계 — SDD 구현**: 태스크별 fresh 서브에이전트(구현=opus·리뷰=fable, 429 시 opus 폴백 명시) + per-task 리뷰 + 최종 whole-branch 리뷰. ledger `.superpowers/sdd/progress.md`에 S4 섹션 append.

**3단계 — 출하 시퀀스(S4 green 후, 이 세션에서)**:
1. 최종 게이트: `npm run quality` EXIT 0 + 초점 스위트 + `npx knip` 래칫 + 서버 무변경 diff 확인
2. **최신 master 재통합**: fetch 후 **merge**(squash 저장소 — rebase 금지) → 재검증(quality+초점 테스트 재실행. stale-base green 무효 규칙)
3. push + PR 생성(전체 커밋 이력 기반 요약: S1~S4 재구축 완결·서버 무변경·테스트 수치. `gh pr create`)
4. **머지는 CI green + 사용자 최소 스모크(편집 왕복+조건 해제 재진입) 확인 후** — PR까지 만들고 스모크 필요 항목을 보고하고 대기
5. OTA는 별도 명시 게이트(`feedback_ota_refetch_local_tree_before_update` — 배포 직전 origin/master 재fetch·ff 필수)

---

## 세션 컨텍스트 (참고)

- **S3 결과(2026-07-16~17 SDD)**: 5커밋(1fbbdeb13..6faa74ad3). `valuesToUpdateInput` 위임 신설(등가성 구조 보장)·승인 보존 4중 증거(타입 계약+직렬화 current 보존+회귀 3케이스+red-green RED 3/3 실측)·OrderSheetScreen mode='edit'+scheduleLocked(급여 미잠금 — 서버 identity 가드는 역할 키만)·edit.tsx 전면 교체(+87/-311, 훅 토스트 위임·presets 미전달 필수=handleApplyPreset 잠금 가드 밖). 최종 게이트 fresh: quality EXIT 0·초점 113 스위트/1127 tests·서버 무변경.
- **🔑 S3 최종리뷰 교훈(S4에서도 경계)**: update는 patch 시맨틱(키 생략=현행 유지) — create의 키 생략 관례를 승계하면 해제 계열이 침묵 무시된다(conditions 소실 2건 → fix 6faa74ad3, 빈 {} wholesale 반영 3계층 실측). 삭제·이주 시 이 계약(draftToUpdateJobPostingInput 양분기 `conditions: draft.conditions ?? {}`)을 보존할 것.
- **실기기 QA(사용자 게이트, 머지 전 최소 스모크 권장)**: 전 타입 편집 왕복(대회 approvalStatus 유지·고정 근무조건)·확정 지원자 편집(잠금 배너·급여만 수정 저장)·조건 수정/전량 해제 재진입·편집 템플릿 저장·잠금축 스키마 미달 레거시 형상 엣지(M-1).
- **관련 문서**: S3 계획 `docs/superpowers/plans/2026-07-16-order-sheet-edit-all-types.md` · 직전 핸드오프 `docs/planning/2026-07-16-order-sheet-s3-execution-handoff...`(S3 완료로 본 문서가 대체) · 위키 `wiki/decisions/order-sheet-form-contract.md`·`wiki/decisions/whitelist-silent-drop.md`·`wiki/decisions/knip-signal-hygiene.md`.
- **관련 메모리**: `project_order_sheet_unification_all_types`(S3 반영 완료) · `pitfall_knip_falsepositive_build_config` · `feedback_knip_peer_deps` · `pitfall_shared_worktree_concurrent_branch_switch` · `feedback_merge_cleanup_shared_worktree_occupied_master`(머지 단계 함정) · `feedback_master_direct_push_bypasses_e2e`.
