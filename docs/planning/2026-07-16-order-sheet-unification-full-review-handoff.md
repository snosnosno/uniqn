# 핸드오프 — 공고작성 주문서 통일 전체 리뷰(설계 → S1·S2 구현 종단) · 다음 세션 메인 프롬프트

> 이 파일 전체를 다음 세션 첫 프롬프트로 붙여넣으면 된다. 목적: **"공고작성 전면 주문서 통일"의 설계 SSOT부터 구현된 S1(대회 생성)+S2(고정 생성)까지를 종단(end-to-end)으로 리뷰**하고, 출하(실기기 QA·push/PR/OTA) 전에 반드시 고쳐야 할 것과 S3·S4로 이월할 것을 트리아지한다. **리뷰만 — 코드 수정은 트리아지 후 사용자 승인 시.**

---

## 0. 이 리뷰가 필요한 이유(중복 방지 · 종단 관점)

S1·S2는 각각 subagent-driven-development로 구현되며 **태스크별 리뷰 + 슬라이스별 최종 whole-branch 리뷰**를 이미 거쳤다(각 슬라이스 내부는 Critical 0·Important 0으로 종료). 따라서 이 리뷰는 **슬라이스 내부 재검이 아니라**:

1. **설계 의도 대비 종합 정합** — 설계 SSOT의 6개 사용자 확정 결정이 실제 코드에 반영됐는가.
2. **슬라이스 간 일관성·대칭** — 대회(S1)와 고정(S2)이 같은 union 골격 안에서 **일관된 방식**으로 처리되는가, 아니면 두 갈래가 서로 다른 관례로 갈라졌는가.
3. **누적 기술부채·미해결 Minor의 종합 트리아지** — 개별 슬라이스에서 "비차단"으로 넘긴 Minor가 합쳐졌을 때 출하 리스크가 되는가.
4. **회귀 표면** — dated(지원/급구)·tournament 경로가 두 슬라이스의 매퍼/스키마 변경으로 조용히 깨지지 않았는가.

---

## 1. 착수 전 확인(필수)

```bash
cd "C:/Users/user/Desktop/T-HOLDEM"
git status                       # 내가 안 만든 미커밋 변경 있으면 병렬세션 — 워크트리 격리
git branch --show-current        # = docs/order-sheet-unification-design 여야 함
git log --oneline -1             # HEAD = f66102983 여야 함(미push)
```

- 브랜치 `docs/order-sheet-unification-design`, HEAD `f66102983`, **로컬·미push**.
- ⚠️ 단일트리 동시세션이 워킹트리를 master로 되돌린 실증 있음 — 리뷰는 읽기 전용이라 무관하나, 트리아지 후 수정에 들어가면 **커밋 직전마다 브랜치 재확인**.

## 2. 리뷰 대상(정확한 경로·SHA)

### 2-1. 설계·계획 문서 (Read — 설계 의도의 진실원)
| 문서 | 경로 | 역할 |
|---|---|---|
| 설계 SSOT | `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` (112줄) | 전 타입 create+edit 단일 경로화 설계 v1 + **6개 사용자 확정 결정** |
| S1 계획 | `docs/superpowers/plans/2026-07-16-order-sheet-tournament-create.md` (555줄) | 대회 생성 5태스크 TDD |
| S2 계획 | `docs/superpowers/plans/2026-07-16-order-sheet-fixed-create.md` (1320줄) | 고정 생성 8태스크 TDD + Global Constraints |
| S2~S4 로드맵 | `docs/planning/2026-07-16-order-sheet-s2-s4-remaining-handoff.md` (71줄) | 잔여 슬라이스 경계(참고) |

### 2-2. 구현 코드 (리뷰 diff)
- **브랜치 시작(merge-base master)**: `869febacda`
- **HEAD**: `f66102983`
- **S1 코드 5커밋**: `08021cf06`(silent-coercion 제거) → `5c36329c5`(세그먼트 고정 전용화) → `52e3627ed`(승인 배너·라벨) → `f55e1b398`(완료화면 분기) → `ff262a250`(리뷰 후속 문구 수정)
- **S2 코드 9커밋**: `c86db34a1`(스키마 union 게이트) → `0a1632048`(매퍼 왕복) → `c06914477`(SP1 헬퍼 통합) → `6c2a6122e`(orderRowMeta) → `139949ea3`(WorkConditionSheet 신규) → `1b5b365a0`(협의 회귀 테스트) → `078063bb0`(OrderSheetScreen 배선) → `445c41a31`(완료요약) → `f66102983`(급여 토스트·회귀·정규식 정리)
- **코드 변경 규모**: 17 files, +1408/-130 (ts/tsx만).

**리뷰 패키지 생성**(코드만; 문서 커밋 제외):
```bash
cd "C:/Users/user/Desktop/T-HOLDEM"
git diff 869febacda..f66102983 -- 'uniqn-mobile/**/*.ts' 'uniqn-mobile/**/*.tsx' \
  > .superpowers/sdd/full-review-order-sheet.diff
git diff --stat 869febacda..f66102983 -- 'uniqn-mobile/**/*.ts' 'uniqn-mobile/**/*.tsx'
```
리뷰어에게는 이 diff 파일 경로를 넘긴다(diff의 컨텍스트 라인이 곧 변경 파일 상태 — 잘린 hunk만 원본 Read).

**핵심 코드 파일(17개)**:
- 스키마/매퍼: `src/schemas/orderSheet.schema.ts`, `src/utils/order-sheet/mappers.ts`, `src/utils/job-posting/draftAdapter.ts`, `src/types/jobTemplate.ts`
- 주문서 화면/메타: `src/components/employer/order-sheet/OrderSheetScreen.tsx`, `orderRowMeta.ts`, `TypeSegment.tsx`, `sheets/WorkConditionSheet.tsx`(신규)
- 진입: `app/(employer)/my-postings/create.tsx`, `create-success.tsx`
- 테스트 7종(orderSheet.schema·mappers·orderRowMeta.fixed·OrderSheetScreen.fixed·OrderSheetScreen.tournament·WorkConditionSheet·create-success.tournament)

## 3. 리뷰 관점(다관점 — 병렬 디스패치 권장)

각 관점을 **독립 서브에이전트**로 병렬 디스패치(같은 리뷰 패키지 파일 공유). 판정은 아래 seam을 파일:라인 근거로.

1. **설계 정합(설계 SSOT §결정 대조)** — 6결정 반영 검증:
   - ①대회·고정 한 스펙, 슬라이스 분리 ✓/✗ · ②전 타입 create+edit 주문서화(S1·S2는 create만; edit=S3) · ③**고정 스케줄 현행 유지(주 N일 daysPerWeek, 요일 개별선택 미도입, 무마이그)** — `fixedSchedule` 필드 구성이 이 결정과 일치하는가 · ④레거시 은퇴 마지막(S4) · ⑤**스케줄 discriminated union(dated|fixed, 스케줄만 분기)** — 폼이 평탄 유지 + superRefine 게이트로 구현됐는가, 축 상호배타가 실제 강제되는가 · ⑥편집 시 approvalStatus 보존(S3, 미구현 — 설계에만 존재하는지 확인).
2. **아키텍처 일관·슬라이스 대칭** — 대회는 `JobPostingRepository`가 postingType='tournament'이면 승인 자동 주입(폼 입력 0), 고정은 `buildFixedSyntheticRequirement`로 `requirements:[{date:null,...}]` synthetic 조립. **두 특수 케이스가 같은 union 골격에서 일관된 관례인가, 아니면 이질적으로 갈라졌는가.** Presentation→Hooks→Service→Repository 레이어 경계 준수.
3. **회귀 표면(#194 whitelist-silent-drop 재발 클래스)** — 신규 필드(postingType='fixed', `fixedSchedule.*`)가 **전 매핑 지점**(valuesToDraft/draftToValues/formValuesToDraft/templateToDraft/valuesToCreateInput)을 왕복하며 조용히 증발하지 않는가. dated/tournament 무회귀. own-property red-green 테스트 실재.
4. **서버 무변경 계약** — 마이그레이션·RLS·Edge Function·직렬화(`serialization.ts`/`jobPosting.schema.ts`) 변경 0 실측(`git diff --name-only 869febacda..f66102983 | grep -E 'migrations|serialization|jobPosting.schema|functions/|\.sql'` = 0). JSON-only → OTA 가능이 진실인가.
5. **폼 계약·타입 안전** — `useForm<z.input, unknown, z.output>` 3제네릭 불변, z.input/z.output 2형 유지, `guaranteedHours` PROVIDED_FLAG(-1) 금지. tsc strict 0 errors.
6. **UX·디자인 일관(impeccable/nativewind)** — WorkConditionSheet·근무조건 행·완료요약이 dark 토큰·아이콘(@/components/icons stroke 2.0)·터치 타깃·중첩 Modal 회피·한글 문구 규약 준수. 대회/고정 안내 문구의 사용자 모순 없음(S1에서 create.tsx 문구 stale 적발 이력).

## 4. 방법론

- **모델 라우팅(전역 agents-v2 + orchestration)**: 리뷰·판정 = **fable**. fable 토큰 부재 시 **opus 폴백 + 다운그레이드 명시**(S1·S2 두 세션 모두 fable 미가용으로 전량 opus였음). 한도 시 fable→opus→sonnet.
- **병렬**: 관점 3~6개를 한 메시지에 병렬 디스패치(대규모면 5개 배치). 종합은 메인 세션이.
- **독립 검증(전역 verification)**: 에이전트 "성공"·"이상 없음" 보고 그대로 신뢰 금지 — VCS diff·`npm run quality`·`npx jest` 실측으로 판정 확인.
- **검증 게이트 재실행(현재 상태 스냅샷)**: `cd uniqn-mobile && npm run quality`(tsc+eslint+prettier) + 초점 스위트. jest 경로에 괄호 `(employer)`가 있으면 Windows 매칭 0건 → 괄호 없는 부분경로(예: `my-postings`)로 실행.

## 5. 불변 계약 · 금지사항(수정 단계 진입 시)

- 한글(주석·커밋·문구) · `logger`(console.log 금지) · `dark:` · `@/` 경로 · toast/Alert · camelCase · 아이콘 `@/components/icons` stroke 2.0(이모지 금지) · 커밋 `<type>(<scope>): 한글`.
- **금지**: `mcp__supabase__*` 직접 호출 · 기존 마이그레이션 수정 · PROD 우회 · **범위 밖 리팩터·추상화**. 리뷰 디스패치된 커밋 amend 금지(append 커밋).
- push/PR/OTA는 **명시 요청 시에만**. master 직접 커밋 금지(기본 브랜치면 feature 먼저).

## 6. 산출물

1. **종단 리뷰 리포트** — 관점별 findings, 심각도(Critical/Important/Minor), 각 파일:라인 근거.
2. **출하 전 트리아지** — 실기기 QA·push/PR/OTA 전에 **반드시 고칠 것** vs **S3·S4로 이월** vs **의도된 설계라 무조치**. plan-mandated 결함은 사람 결정 사항으로 표기.
3. Critical/Important가 나오면: 단일 fix 서브에이전트(opus, 구현 계약 준수 — 커버 테스트 재실행) 디스패치 후 재검. Minor는 사용자 승인 후 배치 정리.

## 7. 컨텍스트 — 이미 통과한 게이트 · 알려진 미해결 Minor(트리아지 입력)

**이전 세션이 실측한 상태(재검 대상, 맹신 금지)**:
- S1·S2 각 최종 whole-branch 리뷰 = Ready to merge, Critical 0·Important 0.
- 최종 검증(S2 완료 시점): `npm run quality` EXIT 0(tsc 0·eslint 0 errors/56 warnings 전부 기존·prettier clean), 초점 5스위트 94 tests EXIT 0, my-postings 13/13.
- 아키텍처 체인 실측: `JobPostingRepository.ts:484-485` tournament면 {approvalStatus:PENDING,submittedAt} 자동 주입, 공개조회 `:233-236` APPROVED만 노출 → PENDING 대회 검색 비노출.

**알려진 미해결 Minor(종합 트리아지 대상)**:
- `orderSheet.schema.test.ts:365` — `fixedSchedule` unused-var 경고(비차단, quality 0 errors).
- `OrderSheetScreen.tsx` fixed 역할 시트가 dated 슬롯용 `RolesSheet` 재사용 — S3(편집 이관) 재점검 후보.
- `create.tsx` `legacyType`/`handleSwitchToLegacyForm`/`onSwitchToLegacyForm` 타입 `'fixed'|'tournament'` 과대(이제 fixed만 레거시 도달) · `create.tsx:96-97` 프리셋 제외 주석 stale(dated 대회 이제 throw 안 함) — **S4 레거시 은퇴 때 자연 정리 예정**.
- 테스트 목의 `require('react-native')` no-require-imports 경고(코드베이스 전반 관례, lint --max-warnings 0 아님).

## 8. 범위 밖(리뷰 대상 아님 — 로드맵으로만 언급)

- **S3(전 타입 편집)**: `draftToValues` 전 타입 + `valuesToUpdateInput` + 편집 시 approvalStatus 보존(설계 결정 ⑥). **미착수·별도 계획.**
- **S4(레거시 은퇴)**: `JobPostingScrollForm`+`draftAdapter` 제거. **미착수·별도 계획.**
- 실기기 수동 QA는 **사용자 게이트**(리뷰가 대신하지 않음).

---

**요약**: 읽기 전용 종단 리뷰 → 설계 6결정 대비 정합 + 슬라이스 대칭 + 회귀/서버무변경 실측 + 미해결 Minor 종합 → 출하 전 트리아지. 코드 수정은 트리아지·사용자 승인 후. 모델 라우팅 fable(부재 시 opus 명시).
