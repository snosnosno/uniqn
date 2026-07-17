---
area: sources
updated: 2026-07-17
status: current
sources:
  - docs/analysis/2026-07-16-full-codebase-cleanup-analysis.md
  - uniqn-mobile/src/repositories/supabase/workLogColumns.ts
  - uniqn-mobile/src/domains/settlement/helpers.ts
  - uniqn-mobile/package.json
  - PR#263
  - PR#239
  - memory/project_full_codebase_cleanup_analysis_20260716
tags: [cleanup, dead-code, bugs, duplication, knip, settlement, timezone]
---

# 소스: 전체 코드 정리 — 버그 8종·죽은코드·중복 수렴 (PR #263, 2026-07-16~17)

## 무엇을 했나
`uniqn-mobile/` 전역(ops·`__tests__` 제외, 약 165k 라인)을 읽기 리더 7개(haiku/sonnet Explore)로 훑고 메인 세션이 grep/Read로 재검증한 뒤, 중요 발견만 fable 적대검증 3축(money·datasec·types, zod 4.3.6 실물 재현 포함)으로 판정한 정리 작업. **버그 수정과 정리를 분리 커밋**, 서버 무변경(OTA 가능). `+1,501/−3,393`, knip 래칫 2344→**2209**(#261 S4·#262 오프라인UI 재통합 후 실측). 게이트: `tsc` EXIT 0·jest 284스위트 3,990 PASS·`knip:gate`(package.json:16) EXIT 0.

## 확정 버그 8종 (fable 검증 — 정리가 아니라 수정)
- **A1 P0 유저가시**: 정산 확인 모달이 **세전**, 목록·저장값은 세후 — 같은 화면에 갈라진 3숫자. 원인=`SalaryConfig`에 taxSettings 필드 부재로 미전달, `SettlementRepository`가 mismatch를 warn 로깅(설계자 인지 방증).
- **A2 P1 침묵 DB 부패**: `Assignment.duration`이 경과시간용 `durationSchema`에 오배선 — zod가 `{type:'consecutive',…}`를 `{}`로 파싱, 확정 1회에 DB duration을 `{}`로 영구 되쓰기. 현재 소비자 0이라 미가시이나 **읽는 기능 추가 즉시 P0**.
- **A3 Med~High 프라이버시**: 로그아웃이 서버 푸시토큰을 해제 안 함 — 공용기기에서 이전 계정 푸시 계속 수신·계정 간 알림 노출.
- **A4 Med(admin)**: `AdminRepository.getUsers` 검색을 **페이지네이션 이후** 클라에서 적용 — 타 페이지 매칭 유저 누락(검색 사실상 오작동).
- **A5 Low/Med잠복**: 지원서 조인 화이트리스트에 `conditions`·`venue_id` 누락(3벌째 사본). 조건 표시가 붙는 순간 조용한 미표시 → **[[whitelist-silent-drop]] 클래스**. 근본해소=TABLE_COLUMNS 단일 소스 import.
- **A6~A8 P2**: `E6080` 이중 할당 · `status:'deactivated'`가 유니온 부재(strict zod 붙는 순간 재발) · 세금 미리보기 항목별 제외 미반영(컴포넌트 기본값 true라 신규 사용처서 갈라진 금액).

기각(재제기 방지): 초대 딥링크 workspaceId 소실·승인 게이트 발산·users.status 증발·정산 산식 현행 드리프트 — 모두 반증(현행 동치, 계약-구현 스멜만).

## 중복 수렴·주석 정정
- **컬럼 화이트리스트 단일화**: 35컬럼 `TABLE_COLUMNS` 3파일 바이트 동일 복제 → `src/repositories/supabase/workLogColumns.ts`로 수렴(A5 근본해소).
- 정산 helpers 계열을 Calculator 위임으로, formatters 파일/디렉토리 그림자 해소.
- `@deprecated` 마커 **역전 3종** 정정(그대로 삭제하면 사고): `subscribeByStaffId*`는 "polling 전환됨" 주석과 달리 실사용 중, `FirebaseDocument`/`FirestoreUserProfile`가 실제 정본. "Legacy alias" `JobPostingCard`가 실은 주력(22파일 70회) — **오삭제 최우선 경고**.

## ★실발산 발견 (통합은 후속)
`getSalaryForRole`(useSameSalary 반영) vs `getRoleSalaryFromRoles`(미반영)가 `useSameSalary=true`에서 12000 vs 20000으로 발산. 정정 대신 `domains/settlement/helpers.test.ts`에 `.not.toEqual`로 **발산을 문서화 잠금**(재발 이력 실재).

## 죽은 코드 −3,464줄
`crashlyticsService` 전체 · `UserRepository.registerAsEmployer`(즉시 role 승격 RPC 래퍼 — 보안상 삭제 가치) · `subscribeByDate` · boardSchedule 3함수 등 호출 0 확인분.

## 선행 정리 #239 (병기)
삭제 위주 diff. **유일한 동작 변화 = "오늘" 계산 UTC→로컬 8곳** — KST 00~09시에 하루 밀리는 off-by-one 교정.

## 교훈
- **"호출 0" 판정은 `src`+`app`+배럴 재수출 전수 grep 필수**. 사전분석이 src 한정 grep으로 9건 오판(useAllowances·costCalculator·basicInfoSchema 등 전부 실사용) — 삭제 직전 프로토콜이 전건 차단, SKIP 처리.
- **CI E2E 59m·57실패는 러너 경합 플레이크**: retry 2.2s 통과 + 166 통과 혼재로 실증(ubuntu 2vCPU, [[e2e-runner-contention]] 클래스).

## 관련
- [[alert-web-noop]] — 같은 시기 별개 정리(웹 Alert no-op 전수 교정)
- [[whitelist-silent-drop]] — A5가 인스턴스인 조용한 증발 클래스
- [[knip-unused-export-triage]] — knip 래칫 연속(2313→2209)
- [[nativewind-rn-pitfalls]] — 프레젠테이션 레이어 재발 함정 이웃
- [[layers]] — Service→Repository 경계(컬럼 화이트리스트가 사는 곳)
