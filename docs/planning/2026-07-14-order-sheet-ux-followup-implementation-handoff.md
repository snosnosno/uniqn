# 핸드오프 — 주문서 후속 UX 구현 (다음 세션 메인 프롬프트)

> 아래 "---" 블록을 다음 세션 첫 메시지로 그대로 사용.

---

주문서(공고작성 키오스크) 후속 UX 개선의 **설계가 SHIP-READY로 확정**됐다(리뷰 6보이스+최종 fresh-context 검증 완료). 설계 문서대로 **S3→S2→S1 순서로 끝까지 구현·검증·머지·OTA 재출하**해줘. push/PR/OTA는 이 프롬프트가 명시 승인이다. 실기기 QA만 내(사용자) 게이트다.

## 0. 단일 진실원 (재설계 금지)

**`docs/planning/2026-07-14-order-sheet-ux-followup-design.md`** — 상태 SHIP-READY. 이 문서가 스펙의 전부다: S1(일정 그룹)·S2(급여)·S3(카드 조건) 상세, 변경 파일 목록(§3), 아키텍처(§3b), **테스트 표 §3c+§4**(TDD 출발점), E/F 레지스트리(§7b/7c), 결정 감사 27건(§9d). 설계를 다시 열지 말 것 — 사용자 승인 3회(D1·D2·D3) + 최종 검증까지 끝났다.

⚠️ 이 설계 문서와 본 핸드오프는 **kiosk 워크트리에 미커밋 상태** — 첫 커밋에 포함하라.

## 1. 착수 (병렬세션 격리)

1. `git status` 확인. **메인 체크아웃은 detached HEAD + 타 세션 미커밋 — 건드리지 말 것.**
2. 워크트리 `.claude/worktrees/job-posting-kiosk-ux` 재사용(node_modules junction 연결, **origin/master `9ec830acc`로 ff 완료** — #250 지역필터·#251 역할급여필터 포함 상태에서 설계 재검증됨). `git fetch origin` 후 최신 origin/master 기준 **새 브랜치**(예: `feat/order-sheet-schedule-groups`).
3. 주문서 코드 위치: `src/components/employer/order-sheet/`(스크린·orderRowMeta·sheets 11종) · `src/schemas/orderSheet.schema.ts` · `src/utils/order-sheet/mappers.ts` · 카드 파이프 `src/domains/job-posting/facts.ts`→`projections.ts`→`src/components/jobs/shared/PostingCardSurface.tsx`.

## 2. 구현 순서 (슬라이스별 커밋, PR 분리 가능)

| 순서 | 슬라이스 | 요지 | 위험도 |
|---|---|---|---|
| ① | **S3 카드 조건** | facts→projectCard→PostingCardSurface 3단 배선(복지 줄 다음, 값 없으면 생략) | 최소 — 독립 |
| ② | **S2 급여** | useSameSalary 기본 OFF(**5지점 전수** §S2.1)·DEFAULT_ROLE_HOURLY(딜러2만/플로어3만/기타2만)·syncRoleSalaries(고아 잔류!)·'기본값' 배지·역할별 스테퍼+인라인 직접입력(완료버튼·blur=이전값 복원)·금액 max 1억·defaultSalary=by_role 최저값 | 중 — 현행 평탄 모델 위에서 가능 |
| ③ | **S1 일정 그룹** | scheduleGroups 폼 계약·3지 세그먼트(수명주기 §S1 FIX-2)·그룹 서브그룹 UI·RHF 경로 워커·매퍼 그룹핑(쓰기 grouped 조건 기록/읽기 연속+isGrouped 경계 보존)·M8 throw 제거 | 최대 — 단독 PR 권장 |

- 각 슬라이스: **TDD**(§3c 해당 행 RED 먼저) → 구현 → `code-reviewer`(fable) 리뷰 → CRITICAL/HIGH 반영. 구현 서브에이전트는 opus, 판정은 fable(429 시 fable→opus→sonnet 폴백·보고 명시).
- 리뷰/검증 서브에이전트는 **동기 디스패치(`run_in_background: false`) 권장** — 이 프로젝트에서 백그라운드 에이전트 완료 알림이 ~50분 지연된 실측 있음.

## 3. 🔑 치명 함정 (설계 리뷰가 적발한 것 — 어기면 재작업)

1. **isGrouped = 묶음지원 축**(시간·역할 공유와 별개!): `isGrouped:true`→`usesGroupedDateRanges`(selectors.ts:35-38)→지원자 화면이 묶음지원(AssignmentSelector 분기)으로 뒤집힘. **그룹크기>1 자동 설정 절대 금지** — 세그먼트 ②(연속 날짜 묶음 지원) 명시 선택 그룹만 `grouped=true`. AssignmentSelector 스모크 필수.
2. **useSameSalary 반전 = 5지점 동시**: schema `.default` · `initialOrderSheetValues` · `formValuesToDraft ?? true` · `orderRowMeta.ts:169` · `OrderSheetScreen.tsx:367` — 하나라도 남으면 "이대로 등록인데 제출 침묵 실패"(H5).
3. **syncRoleSalaries 고아는 제거 말고 잔류**(사용자 수정 금액 침묵 리셋 방지) + 호출 지점에 `gridParamsToValues`·`handleApplyPreset` reset 직전 포함(빠지면 주간그리드 출하 플로우 회귀). effect 호출 금지(무한루프).
4. **flatMap 시 timeSlots deepClone**(참조 공유=타 날짜 오염) · 그룹 간 날짜 중복 superRefine + **합산 ≤ maxDates**(타입별 상수) · requirements 날짜 전역 정렬.
5. 테스트 날짜는 **고정 리터럴**(KST 00~09시 toISOString 플레이크) · 기존 SalarySheet 테스트 5개 전부 `useSameSalary=true` 명시라 기본값 전환 시 재작성 · 신구 등가성은 `singleGroup()` 헬퍼+draft 스냅샷 동결로.
6. 스테퍼가 이미 3곳 인라인 복제(SalarySheet·RolesSheet×2) — 4번째 추가 전 공용 `Stepper` 추출 권장(강제 아님).

## 4. 완료 게이트 (슬라이스마다)

`npm run quality`(exit 0) + 관련 `npx jest` **이 세션 fresh 실행** 증거 없이 완료 주장 금지. 새 동작엔 회귀 테스트. DB 마이그레이션 없음(프리미스 ② — 스키마 변경 요구가 생기면 그건 설계 위반이니 멈추고 보고).

## 5. 배포 (전 슬라이스 머지 후 — 순서 엄수)

1. PR 생성 → CI **9/9 green** → CHANGELOG Unreleased 갱신 → squash 머지. 머지 직전 최신 master 재통합+재검증(stale-base 함정).
2. **OTA 재출하**: 직전 `git fetch` + 로컬 master ff-merge → OTA 출력 `Commit`=origin HEAD 확인 후:
   ```bash
   cd uniqn-mobile
   EXPO_PUBLIC_RELEASE_CHANNEL=production npx eas-cli update \
     --channel production --environment production \
     --message "주문서 일정그룹·역할별급여·카드조건" --non-interactive
   ```
   env 검증: dist `.hbc` 번들 + `eas env:list production`에 `EXPO_PUBLIC_SUPABASE_URL` prod 일치.
3. OTA 혼재기 노트: 신 클라의 다중그룹 템플릿을 구 클라가 열면 M8 throw→프리셋 skip 안전 강등(설계 수용 — 버그 아님).
4. 실기기 QA 항목 정리해서 사용자에게 인계(그룹 2개+ 흐름·역할별 스테퍼·카드 조건 줄·주간그리드 프리필 경로).

## 6. 규율

- 커밋 사전승인(한글 `<type>(scope): …`). **리뷰 디스패치된 커밋 amend 금지**(append 커밋). 기존 마이그레이션 수정 금지. Workflow 도구 옵트인 없음. `mcp__supabase__*` 서브에이전트 직접 호출 금지.
- 로컬 웹 테스트: `.env.local`(=prod) 있음 — `EXPO_PUBLIC_RELEASE_CHANNEL=development npx expo start --web --port 8090`. ⚠️최종 "공고 등록" 제출은 prod 실공고 생성 — 만들면 즉시 삭제/마감. iOS 터치·시트 전환(#244)은 웹 재현 불가 — 실기기로만.
- 관련 지식: memory `project_order_sheet_ux_followup_design_20260714` · wiki `decisions/order-sheet-form-contract`·`decisions/whitelist-silent-drop` · 세션끝 `/session-wrap`.

---
