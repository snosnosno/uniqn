# 핸드오프 — 인원카운트 하루 기준 표시 SDD 구현 (다음 세션 메인 프롬프트)

> 작성 2026-07-23 · 설계·계획 세션 완료(코드 변경 0, 문서만 커밋) · 다음 세션 = **워크트리 격리 + SDD 구현 끝까지**

## 시작 문장

```
docs/planning/2026-07-23-headcount-daily-display-sdd-handoff.md 읽고 인원카운트 표시 통일 SDD 구현 진행
```

---

## 0. 한 줄 상태

설계·표시 형식 전부 **사용자 확정 완료**(재논의 불필요), 구현 계획 8태스크 작성·커밋 완료. 남은 것 = 워크트리 격리 → `superpowers:subagent-driven-development`로 계획 실행 → 품질 게이트 → 보고.

---

## 1. 격리 절차 (먼저, 순서대로)

⚠️ **주의**: 이 작업의 문서 커밋 4개가 공유 워크트리의 `feat/order-sheet-chain-polish` 브랜치에 얹혀 있다(병렬 세션이 브랜치를 전환한 사고 — 그 브랜치의 다른 커밋과 무관). 그 브랜치에서 작업하지 말고 아래로 회수한다.

```bash
# 1) 메인 레포에서 최신 master 확보
git -C C:/Users/user/Desktop/T-HOLDEM fetch origin

# 2) 새 워크트리 + 새 브랜치
git -C C:/Users/user/Desktop/T-HOLDEM worktree add ../T-HOLDEM-headcount -b feat/headcount-daily-display origin/master

# 3) 설계·계획 문서 4커밋 회수 (순서 엄수 — 뒤 커밋이 앞 커밋 파일을 편집)
cd ../T-HOLDEM-headcount
git cherry-pick c17600635 8415f3e61 1f7d56182 7ef180b3d
#  c17600635 = 스펙 원본 · 8415f3e61 = 구현 계획 · 1f7d56182 = 일수 인라인 · 7ef180b3d = 상세 행 정렬

# 4) node_modules junction (5분 npm install 절약 — 관리자 불필요한 /J)
cmd /c mklink /J "C:\경로\T-HOLDEM-headcount\uniqn-mobile\node_modules" "C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules"
```

- cherry-pick 충돌 시: 스펙/계획 파일뿐이므로 **우리 쪽(cherry-pick 버전) 채택**.
- 실기기/웹 QA로 `expo start` 할 경우: junction 워크트리는 라우트 0 함정 → `EXPO_ROUTER_APP_ROOT=<워크트리>/app` 절대경로 + `--clear` (메모리 `pitfall_worktree_junction_expo_router_empty_routes`).

---

## 2. SDD 실행

1. `superpowers:subagent-driven-development` 스킬 호출.
2. 계획: `uniqn-mobile/docs/superpowers/plans/2026-07-23-headcount-daily-basis-display.md` — **태스크 8개**: 1(요약 max) → 2(시간 정렬) → 2b(일수 인라인) → 2c(상세 행 정렬) → 3(지원화면 주입+대기지원) → 4(그룹 경계) → 5(자리 총계 병기) → 6(주석+품질 게이트). 각 태스크에 RED→GREEN 스텝·실제 코드·커밋 명령 포함 — 계획 밖 재설계 금지.
3. 모델 라우팅: 구현 서브에이전트 `opus` · 태스크 리뷰/최종 판정 `fable` (429 시 fable→opus→sonnet 폴백, 보고에 명시).
4. 서브에이전트 디스패치 프롬프트에 금지사항 명시: `mcp__supabase__*` 직접 호출 금지 · 기존 마이그레이션 수정 금지 · PROD 우회 금지 · **커밋은 태스크 명시 파일만 개별 스테이징**(`git add -A` 금지, 병렬 세션 상존).
5. 에이전트 "성공" 보고는 diff·테스트 실행으로 독립 검증 후 체크(전역 verification).

---

## 3. 확정된 설계 결정 (전부 사용자 확정 — 재논의 금지)

| 결정 | 내용 |
|---|---|
| 표시 형식 | **C안: 분수 유지** — `딜러 5명 (2/5)`. "남은 자리" 표기 **금지** |
| 기준 | 전 화면 **하루 기준** — 카드 곱셈(`65명 (0/65)`) 폐기, 분모=하루 요구 |
| 분자 | **날짜별 확정의 max** (통지원 전제: 분모−분자=실제 추가 수용). min/합/평균 아님 |
| 마감 | `max ≥ 하루요구` → 마감 표시, **지원은 계속 허용**(대기 성격, 자동 승계 문구 금지). RoleCheckbox 비활성화 제거 |
| 구인자 병기 | 카드에만 `자리 M/T 채움` 한 줄 (구직자 카드 불변, 상세 `배정 현황` 불변) |
| 일수 | 날짜와 **같은 행** `8/22(토) ~ 8/23(일) · 2일` — `formatDateRangeWithCount` 단일 행화 |
| 상세 일별 | 시간·역할 **한 행**, 들여쓰기 두 단, 시간 열 최소폭 고정 (계단식 폐기) |
| 시간 순서 | 시작시간 오름차순, TBA 뒤 (스크린샷 실측 `10:00→11:00→10:30` 버그) |
| DB | **완전 불변** — 마이그레이션·트리거·저장형식·`MAX_CAPACITY_REACHED` 손대지 않음 |

핵심 함정(계획에 반영됨): 기존 `postingSurfaceModel.hydrate.test.ts:103`이 곱셈 계약(`count=9`)을 단언 — 의도적 갱신 대상. 요약이 아닌 **일별(day) 단언은 불변**.

---

## 4. 완료 게이트 (exit proof)

- `npm run quality` 통과 + `npx jest src/components/jobs src/utils/date src/utils/assignment` 전건 PASS 출력 제시.
- 스펙 §7 RED 6항목이 테스트로 존재하고 GREEN임을 태스크별 실행 출력으로 증빙.
- **push/PR은 사용자 명시 요청 시에만** — 로컬 커밋까지가 이 세션 범위. 완료 보고에 커밋 SHA 목록 + 실기기/웹 QA 잔여 항목(상세 행 정렬·카드 밀도) 명시.

## 5. 참조

- 스펙: `uniqn-mobile/docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md` (§6에 최신 결정 3건 반영됨)
- 계획: `uniqn-mobile/docs/superpowers/plans/2026-07-23-headcount-daily-basis-display.md`
- 목업(사용자 승인한 최종 모습): https://claude.ai/code/artifact/e282a78c-e803-4889-8d90-9c6479d504a0
- 이전 설계 핸드오프(배경): `docs/planning/2026-07-23-headcount-display-design-continue-handoff.md`
