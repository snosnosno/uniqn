---
area: sources
updated: 2026-07-17
status: current
sources:
  - uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx
  - uniqn-mobile/src/utils/order-sheet/mappers.ts
  - uniqn-mobile/src/utils/job-posting/draftAdapter.ts
  - uniqn-mobile/src/domains/job-posting/serialization.ts
  - uniqn-mobile/src/hooks/useUnsavedChangesGuard.ts
  - uniqn-mobile/src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx
  - uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts
  - docs/planning/2026-07-16-order-sheet-unification-all-types-design.md
  - PR#261
  - PR#252
  - PR#253
tags: [order-sheet, job-posting, form, mapper, legacy-retirement, ota]
---

# 소스: 공고작성 전면 주문서 통일 (S1~S4) + 후속 UX

주문서(order-sheet) 키오스크를 **모든 공고 타입(지원·급구·대회·고정)의 생성·편집 단일 경로**로 확장하고, 레거시 섹션 폼 체인을 완전 은퇴시킨 작업. 계약의 "왜"는 [[order-sheet-form-contract]], 재발 클래스는 [[whitelist-silent-drop]] 참조. 이 페이지는 무엇이 언제 바뀌었는지의 원천 요약이다.

## 결과 (PR #261, ✅머지 2026-07-17)
- 진입점: `app/(employer)/my-postings/create.tsx` + `[id]/edit.tsx` → 전 타입이 `OrderSheetScreen.tsx` 단일 경로.
- 규모: 약 +4665/−7153. **서버 무변경**(마이그·RLS·EF·직렬화 계약 0) = JSON-only OTA 가능.
- 사용자 확정 6결정: ①대회·고정 한 스펙, 슬라이스만 분리 ②전 타입 create+edit 주문서화 ③고정 스케줄 현행 유지(주 N일, 요일 개별선택 미도입, 무마이그) ④레거시 은퇴는 마지막 슬라이스 ⑤스케줄 discriminated union(dated|fixed, 스케줄만 분기) ⑥대회 편집 시 approvalStatus 보존(재승인 없음).

## 슬라이스 요약
- **S1 대회 생성**: 대회 = regular + 30일 + 자동승인. 대회 특화필드(대회명/바이인/상금) 위젯은 코드베이스에 없음 — 승인은 `JobPostingRepository.ts`가 `postingType='tournament'`일 때 PENDING 자동 주입(폼 입력 0), 공개 조회는 APPROVED만. 🔑`mappers.ts:278` 프리셋 로드 시 **대회→regular 조용한 치환**을 근절(red-green) — [[whitelist-silent-drop]] 클래스의 변형.
- **S2 고정 생성**: fixed discriminated union(`fixedSchedule`). **WorkConditionSheet 신설** — 주 N일 칩(0=협의)·출근시간 휠·협의 토글. `handleTypeChange` 불변식 = fixed 전환 시 `fixedSchedule` 필수 초기화(미초기화면 매퍼 오분기 → reload 시 fixed→regular 소실).
- **S3 전 타입 편집**: `mappers.ts:525` `valuesToUpdateInput` 신설 — `draftToUpdateJobPostingInput`(`draftAdapter.ts:401`)에 위임해 `valuesToCreateInput`과 동형(등가성 구조 보장). `OrderSheetScreen` `mode='edit'`(TypeSegment disabled·배너 숨김·'이대로 수정' 라벨)+`scheduleLocked`(확정 지원자 있으면 일정/시간/역할/근무조건 잠금, **급여는 미잠금** — 서버 identity 가드가 역할 키 집합만 비교). 🔑아래 conditions 침묵 소실 2건 적발·수정.
- **S4 레거시 은퇴**: 레거시 폼 30파일 삭제(−4773)·`draftAdapter` formData **읽기 방향** 은퇴(180줄). **markClean 신설**(`useUnsavedChangesGuard.ts` — 저장 직후 같은 틱 `back()`의 stale 미저장 경고 제거, TDD). 고아 salary 모듈 은퇴.

## 라이브 존치 — 오삭제 금지
S4가 폼 체인을 지웠지만 **`TemplateModal`·`DatePickerModal`·`formDataToDraft`는 라이브**(템플릿 백컴팻·직접 경로 소비). knip "호출 0" 오판으로 지우지 말 것 — "호출 0" 판정은 src+app+배럴 재수출 전수 grep 필수.

## 🔑 conditions patch 침묵 소실 2건 (S3 계획 결함 → 확정 계약)
주문서가 새로 연 conditions 편집 표면 vs `serialization.ts:360-365`의 **update patch 시맨틱(생략=현행 유지)**이 충돌 — 축소 payload에서 conditions를 빼거나 전량 해제 키를 생략하면 serialize가 `current.conditions`로 폴백 → "성공 토스트 + 침묵 소실". fix = `mappers.ts:303`(update 분기)·`:397`(update input 분기) **양쪽 `conditions: { ...(draft.conditions ?? {}) }` 상시 전달**. **create의 키 생략 관례를 update에 승계하면 해제 계열이 전부 침묵 무시된다.** 되돌리기 금지 계약. 상세=[[order-sheet-form-contract]] §7.

## 후속 UX (PR #252 + #253, ✅머지·OTA e01cdfc0)
- **#252**: 카드 조건 표시(S3) + 역할별 급여 기본화(S2, `useSameSalary` 기본 false). 함정 = 고아 `roleSalaries` 엔트리의 `defaultSalary` 유출(H-1, 활성 최저값만 산정)·**스토어 계약 필드 ≠ 렌더 배선**(`toastStore.action` 존재하나 Toast.tsx 미렌더 = false-green, 소비처 grep+실렌더 테스트 필수)·`generateId` ms 경계 플레이크(stripIds 후 비교).
- **#253**: `scheduleGroups[]` 폼 계약 신설 — 구형 폼 일정 표현력 100% 회복(평평한 slot 배열 → 그룹 배열). 계약 상세=[[order-sheet-form-contract]] §6.

## knip 래칫 드리프트 (후속 백로그)
#261은 master 대비 −11 조여 게이트 2349. 🔑origin/master 자체가 실측 ~2360으로 게이트 대비 이미 RED(기준선 드리프트) — 근본 원인은 `.github/workflows`에 knip 미배선. **후속 = knip CI 배선**.

## 잔여 (사용자 게이트)
실기기 최소 스모크 5항목: 전 타입 편집 왕복·조건 전량 해제 재진입(침묵 소실 회귀)·확정 지원자 잠금 편집·**저장 직후 뒤로가기 경고 미출현(markClean)**·생성 4타입 무회귀. OTA는 직전 origin/master 재fetch·ff 필수.

관련: [[order-sheet-form-contract]] · [[whitelist-silent-drop]] · [[job-posting-kiosk-order-sheet]] · [[layers]] · [[ios-userflow-fixes]]
