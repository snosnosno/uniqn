# 핸드오프 — 공고작성 주문서 통일 잔여 슬라이스 S2~S4 (다음 세션 메인 프롬프트)

> S1(대회 생성)은 완료(브랜치 `docs/order-sheet-unification-design`, 로컬·미push).
> 아래 "메인 프롬프트" 블록을 다음 세션에 그대로 붙여넣어 시작한다. **1세션 = 1슬라이스**(S1에서 검증된 리듬) — 이번은 **S2(고정 생성)**부터.

---

## 메인 프롬프트

공고작성 주문서 통일의 **S2 — 고정(fixed) 공고 생성 주문서화**를 설계→계획→SDD 구현으로 끝까지 진행해줘.

**착수 전 필수 확인 (S1 세션에서 겪은 함정 — 반드시 선행):**
1. `git status` + `git branch --show-current` — 작업 브랜치는 **`docs/order-sheet-unification-design`**. S1 코드 5커밋이 이미 있다(`git log --oneline -6`로 `ff262a250`(S1 리뷰 수정) ~ `08021cf06`(S1 Task1) 확인). 없으면 브랜치/HEAD부터 바로잡고 시작.
2. **병렬 세션 격리**: 별도 워크트리 `.claude/worktrees/ops-posting-followup` 등이 활성일 수 있다. 이 메인 체크아웃은 단일트리라 **커밋 직전마다 `git branch --show-current` 재확인** — S1 세션 이전에 워킹트리가 master로 되돌려져 커밋이 샌 실증이 있다. master 직접 커밋 금지.
3. S1이 미push 상태로 쌓여 있으니, 새 커밋은 반드시 이 브랜치 위에 append(리베이스·리셋 금지).

**설계 SSOT (이미 존재)**: `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` — §3.1/§3.2(fixed union·매퍼), §4(근무조건 시트), §6(S2 분해), §7(함정), §8(검증) 정독.

**1단계 — S2 계획 작성 (S1과 달리 플랜이 아직 없다):**
`superpowers:writing-plans`(또는 `/autoplan`)로 `docs/superpowers/plans/2026-07-16-order-sheet-fixed-create.md`를 먼저 작성. 실제 코드·정확 경로·실행 명령·기대 출력 포함, TDD 태스크 분해. 계획 확정 후 2단계.

**2단계 — SDD 구현**: `superpowers:subagent-driven-development`로 태스크당 새 서브에이전트 + 태스크 간 리뷰.
- **모델 라우팅**: 구현=**opus** / 계획·리뷰·판정=**fable**(전역 agents-v2). ⚠️ **fable 토큰 부재 시 전량 opus로 진행**(S1 세션이 그렇게 함). 한도 시 fable→opus→sonnet 폴백 + 다운그레이드 명시.
- 디스패치 프롬프트에 **금지사항 명시**: `mcp__supabase__*` 직접 호출 · 기존 마이그레이션 수정 · PROD 우회 · 범위 밖 리팩터 금지.
- 에이전트 "성공" 보고 신뢰 금지 — **VCS diff + jest 독립 검증** 후 다음 태스크. 커밋 직전 브랜치 재확인.

**작업 디렉토리**: `uniqn-mobile/`. 게이트 = `npm run quality` + 관련 `npx jest`.
- jest 경로에 괄호(`app/(employer)/...`)가 있으면 Windows에서 패턴 매칭 0건 → 괄호 없는 부분경로(예: `my-postings`)로 실행.

**S2 범위 · 핵심 함정 (설계 §3~§8 실측):**
- **fixedSchedule union**: 신규 `fixedSchedule { daysPerWeek, startTime, isStartTimeNegotiable }`. `orderSheetScheduleGroupSchema`는 `dates.min(1)` 필수라 고정과 정면 충돌 → **discriminated union**(스케줄만 분기, 전체 폼 union 아님)으로 격리. `superRefine`가 `postingType`↔스케줄 표현 정합 강제(fixed면 fixedSchedule present·scheduleGroups 미검증, dated면 반대).
- **근무조건 시트**: 날짜·시간 시트 → "근무조건" 시트 1개로 스왑(주 출근일수 칩 0=협의~7 · 출근시간 휠 · 출근시간 협의 토글). 역할·급여 이하 공유. "게시기간 7일 자동" 안내(`FIXED_POSTING_DURATION_DAYS=7`).
- **매퍼**: `draftToValues`(`mappers.ts:205`)의 `schedule.kind !== 'dated'` throw를 **fixed 전용 변환으로 대체**(고정 draft/posting → fixedSchedule 값 복원). 쓰기 시 SP1 synthetic `requirements:[{date:null, timeSlots:[{startTime, roles}]}]` 1개.
- **🔑 9지점 왕복 전수**([[whitelist-silent-drop]], #194 동형): 신규 `fixedSchedule`는 TABLE_COLUMNS SELECT 화이트리스트·`deserializeJobPostingDocument`·`toCreateJobPostingInput`·`draftToUpdateJobPostingInput`·템플릿·읽기 전 지점 갱신. **4지점만 하면 쓰기만 되고 읽기 전건 증발**. own-property 가드 red-green 필수.
- **SP1 헬퍼 통합**: `buildFixedSyntheticRequirement`/`buildFixedDraft`/`draftToCreateJobPostingInput` fixed 분기/`templateToDraft` fixed 변환 4곳 중복(기존 SP1 후속 TODO)을 공유 헬퍼로 통합, 주문서 create input이 재사용. 불변식 회귀 스냅샷(`sp1Equivalence.test.ts`) 유지.
- **신·구 등가성 게이트**: 주문서 `valuesToCreateInput`(fixed) 산출 == 기존 레거시 `draftToCreateJobPostingInput`(fixed) 산출. 무마이그 확정 = `job_postings` 기존 JSONB(requirements) 수용 실측.
- **금지**: `guaranteedHours` PROVIDED_FLAG(-1) — 문서 게이트 `min(0)` reject → 등록 사망. 기존 규칙 승계. zodResolver **3제네릭**(`useForm<z.input, unknown, z.output>`) 유지(union 도입해도 z.input/z.output 2형 유지).
- **서버 무변경**: 마이그·RLS·EF 0(JSONB 수용 확인 외).

**불변 계약**: 한글(주석·커밋·문구) · `logger`(console.log 금지) · `dark:` · `@/` 경로 · toast/Alert · camelCase · 아이콘 `@/components/icons` stroke 2.0(이모지 금지) · 커밋 `<type>(<scope>): 한글`. JS-only → OTA 가능.

**출하 게이트(사용자)**: 전 태스크 green + 최종 whole-branch 리뷰 후 → 실기기 QA는 사용자 게이트. push/PR/OTA는 **명시 요청 시에만**.

**슬라이스 경계**: 이번은 **S2(고정 생성)만**. S3(전 타입 편집)·S4(레거시 은퇴)는 각자 별도 계획 — 손대지 말 것.

---

## 이후 슬라이스 로드맵 (S3·S4 — 각자 별도 세션·계획)

### S3 — 전 타입 편집 주문서화
- `draftToValues` **전 타입 하이드레이션**(지원·급구·대회·고정 모두 draft/posting → 주문서 값 복원) + **`valuesToUpdateInput` 신설**.
- `edit.tsx`가 `OrderSheetScreen`을 전 타입에 사용(현재는 전부 레거시 `JobPostingScrollForm`).
- **🔑 대회 편집 승인상태 보존(확정 결정)**: `valuesToUpdateInput`가 `tournamentConfig`를 덮어쓰지 않도록 명시 — 승인된 대회 수정이 `approvalStatus` pending 리셋 유발 **금지**(재승인 트리거 없음). 현재 update 경로의 tournamentConfig 처리 실측으로 확정.
- 지원/급구 편집도 함께 이관(레거시 은퇴 조건 성립).

### S4 — 레거시 은퇴 (재구축 완결)
- `JobPostingScrollForm` · `draftAdapter` · `create.tsx`/`edit.tsx` legacy 분기 · `PostingTypeSelector`(레거시용) 제거 + **knip 데드코드 정리**(참조 무결성·빌드 green).
- **S2 이월 Minor 여기서 자연 정리**:
  1. `create.tsx`의 `legacyType`/`handleSwitchToLegacyForm`/`onSwitchToLegacyForm` 타입 `'fixed' | 'tournament'` 과대(S1 이후 fixed만 도달) — 레거시 분기 삭제로 소멸.
  2. `create.tsx:96-97` 프리셋 제외 주석(dated 대회는 S1 이후 throw 안 함 → 유효 preset로 노출, 기능 정상·주석만 stale) — 주석 정리.
- knip 보호: peer-only 네이티브(mmkv/nitro) `knip.ignoreDependencies`, 빌드설정(babel/expo-modules-core) 오탐 주의([[pitfall_knip_falsepositive_build_config]]).

---

## 세션 컨텍스트 (참고)

- **S1 완료 상태**: 브랜치 `docs/order-sheet-unification-design @ff262a250`, 코드 5커밋(`08021cf06`~`ff262a250`), 미push. `npm run quality` EXIT 0 · order-sheet+my-postings 22 suites/185 tests · 서버 무변경. 상세 원장 `.superpowers/sdd/progress.md`.
- **사용자 확정 6결정**: ①대회·고정 한 스펙·슬라이스 분리 ②전 타입 생성+편집 주문서화 ③고정 스케줄 현행 유지(주 N일) ④레거시 은퇴 마지막 슬라이스 ⑤스케줄 discriminated union ⑥대회 편집 승인상태 보존.
- 시각 설계안 아티팩트: https://claude.ai/code/artifact/bee7aa02-b57a-43fa-aeb2-fd8cbe9715ae
- 관련 위키: `wiki/decisions/order-sheet-form-contract.md` · `wiki/decisions/whitelist-silent-drop.md`(9지점 왕복 재발 클래스) · `wiki/sources/job-posting-kiosk-order-sheet.md`.
- 관련 메모리: `project_order_sheet_unification_all_types`(S1 완료 반영) · `project_schedule_schema_unification_sp1`(SP1 불변식) · `pitfall_shared_worktree_concurrent_branch_switch`.
