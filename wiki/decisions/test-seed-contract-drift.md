---
area: decisions
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/e2e/tests/p0-critical/cancellation-lifecycle.spec.ts
  - uniqn-mobile/e2e/tests/p2-standard/employer-posting-capacity-recovery.spec.ts
  - uniqn-mobile/supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql
  - PR#269
  - PR#275
tags: [decisions, testing, e2e, vacuous-green, contract-change, recurrence-class]
---

# 결정: DB 계약 소유권 이관 시 테스트 시드 전수 점검 — vacuous green 재발 클래스

**맥락:** DB 값의 **유지 주체**(어느 트리거/RPC가 그 값을 쓰는가)를 바꾸면, 그 값을 단언하는 테스트의 **시드**가 전부 낙오 후보가 된다. 시드가 프로덕션 경로를 우회해 테이블에 직접 INSERT할 때 특히 그렇다. (검증됨: [[seat-basis-e2e-seed-drift]], PR#269→#275)

## 규칙

1. **계약 이관 PR은 그 계약을 단언하는 테스트를 전수 스캔한다.** 파일 하나 고치고 끝내지 않는다.
   - 실행 가능한 스캔: 단언 지점(`grep -rn "<컬럼명>" e2e/ | grep -E "expect|toBe"`) → 각 파일이 새 구동 경로(예: `work_logs` INSERT)를 갖는지 확인.
   - #269는 이 스캔 없이 스펙 1개만 전환했고, PR#196 이후 미변경이던 스펙 1개를 놓쳐 P0가 이틀간 깨졌다.

2. **시드가 RPC를 우회하면 계약 변경에 취약하다.** 테이블 직접 INSERT는 빠르지만, 트리거 소유권이 바뀌는 순간 조용히 무의미해진다. 시드는 가능하면 프로덕션 RPC(`confirm_application` 등)를 타거나, 못 타면 **어느 트리거가 이 값을 구동하는지 주석에 명시**한다.

3. **red보다 vacuous green을 먼저 의심한다.** ⭐ 핵심
   - 시드가 전제(`filled=1`)를 못 만들면, 사후 단언(`toBe(0)`)은 **처음부터 0이라 영원히 통과**한다.
   - #275 시점 실측: `:493`이 red로 터진 덕에 발견됐지만, 같은 파일 `:313`·`:434`의 "취소 후 정원 복원" 단언 2건은 **green으로 통과하며 아무것도 검증하지 않고 있었다.**
   - 즉 **빨간 테스트가 오히려 다행**이었다. 사전조건을 명시적으로 단언하는 테스트가 없었다면 P0 복원 경로는 무기한 무방비였다.

4. **수정 후 비-공허성을 red-green으로 증명한다.** 시드를 고쳤으면 green만 보고 끝내지 말고, **복원 경로를 일부러 깨서 red가 나는지** 확인한다. green만으로는 "진짜 검증한다"와 "여전히 공허하다"를 구분할 수 없다.
   - #275 실측: 좌석의 `application_id` 연결을 끊자 `new_filled_positions` Expected 0/Received 1로 RED → 비-공허성 확인.

## 사전조건 단언을 남겨라 (설계 함의)

이번 건에서 유일하게 작동한 안전망은 WF-08-3의 `취소 전 filled_positions = 1임을 확인`이었다. 사후 상태만 단언하는 테스트는 시드가 죽어도 조용하지만, **사전조건을 단언하는 테스트는 시드가 죽는 순간 소리를 낸다.** 상태 전이를 검증하는 테스트에는 "전이 전" 단언을 남기는 편이 낫다.

## 진단 신호

- 전 브랜치가 같은 테스트에서 동일하게 실패 → 브랜치 결함이 아니라 **공유 base의 계약 변경**을 의심
- 회귀 브래킷: 마지막 성공 런 ↔ 첫 실패 런 사이에 머지된 PR을 본다(#269는 성공 `07-17T12:29Z`와 실패 `07-17T18:08Z` 사이 `16:15Z`에 착지)
- "테스트 노후화 vs 라이브 결함" 판정은 **prod 실측**으로: 함수 본문(`pg_proc.prosrc`)·불변식 쿼리·pgTAP·prod↔로컬 본문 md5 대조

## 관련

- [[seat-basis-e2e-seed-drift]] — 이 클래스를 정의한 사건 기록(PR#269→#275)
- [[whitelist-silent-drop]] — 형제 재발 클래스. 저쪽은 **쓰기 경로** 신규 필드 누락, 이쪽은 **테스트 시드** 계약 낙오. 공통 처방은 "지점 전수"
- [[capacity-full]] — 본 건이 교정한 전이 규칙 페이지
- [[test-db-grants]] — 테스트 하네스가 프로덕션과 다른 전제로 도는 또 다른 함정
- [[data-flow]] — 카운터가 트리거로 유지되는 흐름
