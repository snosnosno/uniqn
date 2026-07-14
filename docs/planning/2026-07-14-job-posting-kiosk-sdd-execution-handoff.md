# 핸드오프 — 키오스크 주문서 SDD 구현 실행 (다음 세션 메인 프롬프트)

> ⚠️ **완료됨(2026-07-14) — 이 문서의 실행 지시를 재사용하지 말 것.** 아래 지시(Task 1 리뷰부터 SDD 실행)는 같은 날 세션에서 **전부 완료**됐다: 11태스크 opus 구현→fable 태스크 리뷰 전건 Approved(수정 루프 T3·T4·T7·T10·T9 후속), 최종 브랜치 리뷰(fable) **Ready to merge — 필수 수정 0건**. HEAD `f9cb4c565`(merge-base `a66ddcc2a`, 30커밋/76파일/+8,596), 게이트 실측 quality exit 0·jest 439스위트/5266 PASS·e2e 변경 2스펙 23 pass. 실행 중 결정: origin/master(#244·#245) 머지, 계획 교정 5건(`9f25c6f6e`), **Design B 승인 일탈**(shared에도 roleCatalog salary 전사 + draftToValues는 by_role만 roleSalaries 복원 — 브리프 자기모순·협의+shared "급여 미정" 오표시 해소).
>
> **다음 세션이 할 일 = 잔여 게이트만(사용자 보류 중, 순서 엄수)**:
> ① `20260714000000_job_postings_conditions.sql` prod 적용(**OTA보다 반드시 선행** — TABLE_COLUMNS에 conditions 추가돼 미적용 OTA 시 공고 SELECT 전건 실패. PR 직전 `20260714*` 타임스탬프 충돌 확인)
> ② push/PR(머지 직전 origin/master 재통합·재검증, squash 저장소라 merge)
> ③ OTA(직전 재fetch·ff 규율)
> ④ 실기기 QA(인라인 지역 3단·TimeWheelPicker embedded·#244 지연 전환·홈 인디케이터)
> + **OTA 전 후속 PR 권고(최종 리뷰)**: conditions 지원자 표시(계획 갭 — 읽기 배선은 완료, UI만) + ⚡→Lucide Zap·strokeWidth 2.0·ConditionsSheet trim·TimeSlotsSheet roles 깊은복사·TemplateModal catch 번들. 상세=SDD 원장(`<워크트리>/.superpowers/sdd/progress.md`, git 미추적)·메모리 `project_job_posting_kiosk_order_sheet.md`.
>
> 아래 원문은 이력 보존용. (원지시: 아래 블록을 다음 세션 첫 메시지로 그대로 사용)

---

공고작성 키오스크 "주문서" 개편 — **리뷰가 끝난 구현 계획 11개 태스크를 서브에이전트 SDD로 끝까지 실행**해줘.

## 컨텍스트 (전부 커밋돼 있음 — 읽고 시작)

- 워크트리: `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\job-posting-kiosk-ux` (브랜치 `worktree-job-posting-kiosk-ux`, node_modules junction 연결됨). **이 워크트리에서만 작업** — 메인 체크아웃 접근 금지.
- **실행 SSOT = 구현 계획(리뷰 반영판)**: `docs/superpowers/plans/2026-07-14-job-posting-kiosk-order-sheet.md` (커밋 `a1cb2ea30`, 11태스크 2,275줄) — 5관점 병렬 리뷰(eng/design/security/db=fable + 정합성=sonnet) + 메인 세션 전건 재검증 + 사용자 결정 4건이 이미 반영된 최종판. **계획이 곧 스펙 — 재설계 금지, 그대로 실행.**
- 설계 SSOT: `docs/planning/2026-07-14-job-posting-kiosk-order-sheet-design.md` (2026-07-14 개정 포함)
- 사용자 확인용 계획 요약 아티팩트: https://claude.ai/code/artifact/5662b5af-8cee-4dc9-94d9-c11a19ac50b1
- 메모리: `project_job_posting_kiosk_order_sheet.md`
- 브랜치 상태: `1fcc63665`(origin/master 머지 — #241 baseline squash 포함) → `a1cb2ea30`(계획) → **`687d0a1d7` = Task 1 이미 구현·커밋됨**(타입·zod strict 화이트리스트·마이그레이션 파일, 구현자 보고: 스키마 36/36·tsc 0·로컬 db reset으로 conditions 컬럼 실측). **단 Task 1의 fable 태스크 리뷰는 미실시.**

## 실행 방식 (사용자 확정 — superpowers:subagent-driven-development)

태스크별 루프: `task-brief`로 브리프 추출 → **opus 구현자** 디스패치(TDD·커밋) → `review-package BASE HEAD` 생성 → **fable 태스크 리뷰어**(스펙 준수+코드 품질 이중 판정) → Critical/Important는 수정 루프 후 재리뷰 → 원장 기록 → 다음 태스크. 전 태스크 완료 후 **최종 전체 브랜치 리뷰**(fable, merge-base 기준).

- SDD 스크립트: `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.1.1/skills/subagent-driven-development/scripts/` (`task-brief PLAN N` · `review-package BASE HEAD`)
- 브리프/보고서/원장 위치: `<워크트리>/.superpowers/sdd/` — `task-1-brief.md`·`task-1-report.md` 이미 존재, **`progress.md` 원장 필독(완료 태스크 재디스패치 금지)**
- 리뷰어 디스패치 시 사전판정 금지(무엇을 flag하지 말라고 지시 금지), BASE는 태스크 시작 전 기록한 커밋(HEAD~1 금지 — 멀티커밋 태스크 잘림)

## 첫 액션 (순서 엄수)

1. `git log --oneline -5` + `.superpowers/sdd/progress.md`로 상태 확인.
2. **Task 1 태스크 리뷰부터**: `review-package a1cb2ea30 687d0a1d7` 생성 → fable 리뷰어 디스패치(브리프=`task-1-brief.md`, 보고서=`task-1-report.md`, 계획 Global Constraints 발췌 동봉). Critical/Important 나오면 수정 서브에이전트 → 재리뷰.
3. 통과 시 원장 기록 → Task 2부터 순차 실행.

## 태스크별 함정 요약 (상세·정확한 코드는 계획 본문 — 브리프가 SSOT)

- **T2**: conditions 왕복 **9지점**(쓰기4·읽기3·수정2) — `TABLE_COLUMNS`(JobPostingRepositoryHelpers.ts:17)·`deserializeJobPostingDocument`·`toCreateJobPostingInput`·`draftToUpdateJobPostingInput` 누락 시 "쓰기만 되고 읽기 전건 증발"(#194 동형). 읽기 방향 테스트 필수.
- **T4**: RHF **3제네릭** `useForm<OrderSheetFormValues(z.input), unknown, OrderSheetValues(z.output)>` — 단일 제네릭은 컴파일 불가(스파이크 실측). 협의=`{type:'other',amount:0}` · `roleSalaries[]` · `initialOrderSheetValues()`(INITIAL_JOB_POSTING_DRAFT 경유 금지 — by_role 오염) · `draftToValues`는 fixed/날짜별 이질 스케줄 throw · gridParams 정규화(비-UUID drop·count 1..99).
- **T5**: 행 unset ≡ zod 판정 정렬(죽은 등록버튼 방지) + `formState.errors`→행 배지 배선 + onInvalid 폴백 + 프로필 phone 프리필 + 고정/대회 전환 dirty 확인.
- **T6·T8**: **RegionSelectModal·ActionSheet 사용 금지**(RN Modal 중첩 → iOS 터치먹통) — 지역=시트 내부 인라인 3단 모드(REGION_GROUPS 재사용), 답변유형=인라인 라디오 3버튼.
- **T7**: DatePickerModal은 추가전용 시맨틱 — additive prop `initialSelectedDates` 추가(기존 호출부 무회귀).
- **T8**: `guaranteedHours`에 PROVIDED_FLAG(-1) 절대 금지(문서게이트 min(0) reject → 등록 사망) — setAmount 키별 분기. 세금 기본=미설정(시트 열면 3.3% 제안).
- **T9**: `handleSaveTemplate` 직접 호출 금지(templateName 비면 조용한 no-op) — `openTemplateModal` 경유. fixed/이질 프리셋은 try/catch 스킵.
- **T10**: `created.id`(CreateJobPostingResult)·`shareJobById(id)` 실측 확정 — 그대로 사용.
- **T11**: e2e 갱신은 **3케이스**(required controls·empty submit→시트 열림 단언·title cap) + 러너 `node scripts/run-e2e.js` + 최종 `npm run quality` + `npx jest` 전체 green.

## 규율

- 태스크마다 커밋(한글 `<type>(<scope>): <한글>`), 완료 주장 전 이 세션 도구 결과 증거(fablize 게이트), 구현자 "성공" 보고는 diff·테스트로 독립 검증.
- 모델 라우팅: 구현=opus · 리뷰/판정=fable (429/한도 시 fable→opus→sonnet 한 단계 폴백, 보고에 다운그레이드 명시).
- 디스패치 프롬프트에 금지 명시: `mcp__supabase__*` 호출 금지 · 기존 마이그레이션 파일 수정 금지 · push/PR 금지(명시 요청 전) · 메인 체크아웃 접근 금지 · 범위 밖 리팩터링 금지.
- Workflow 도구 금지(옵트인 없음). 병렬 구현자 금지(SDD는 순차 — 충돌 방지).

## 완료 후

1. 최종 전체 브랜치 리뷰(fable): `review-package $(git merge-base origin/master HEAD) HEAD` → CRIT/HIGH 수정 루프(수정은 원 파인딩 전체를 든 단일 fixer).
2. 사용자에게 배포 게이트 확인 질문(코드 완료 보고와 함께): ①prod 마이그레이션 적용(`mcp__supabase__apply_migration` — 파리티 가드 무해 실측 확정, PR 직전 `20260714*` 타임스탬프 중복 확인) ②push/PR ③OTA(직전 origin/master 재fetch·ff 규율) ④실기기 QA(주문서 시트 iOS 터치 — 인라인 지역 모드·TimeWheelPicker embedded·DatePickerModal).
3. 메모리(`project_job_posting_kiosk_order_sheet.md`)·원장 갱신, `/session-wrap`.
