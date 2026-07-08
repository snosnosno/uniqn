---
area: decisions
updated: 2026-07-08
status: current
sources:
  - uniqn-mobile/package.json
  - uniqn-mobile/src/constants/statusValues.ts
  - uniqn-mobile/src/utils/security.ts
  - uniqn-mobile/src/types/role.ts
  - PR#231
  - memory/project_knip_triage_execution.md
  - memory/pitfall_knip_falsepositive_build_config.md
tags: [decisions, knip, dead-code, ratchet, tsc-oracle, pitfall]
---

# 결정: knip 신호 정화 — 래칫 게이트 + 안전 삭제 프로토콜

**맥락:** knip이 미사용 심볼 ~3,000건을 보고했으나 **오탐(엔트리포인트·배럴 재수출·Zod 추론타입·테스트 인프라·로컬사용·의도적 계약)이 대량 섞여** knip을 CI 게이트로 신뢰할 수 없었다. PR#231(2951→2313, master `c75d78add`)에서 신호 정화 + 저위험 리프 죽은코드 제거. 상세 실행 요약은 [[knip-unused-export-triage]].

## 핵심 원리 (실측, PR#231)

> **knip "unused export" = "외부에서 import 안 됨"일 뿐, "죽었다"가 아니다.** 리프 SELF 후보 109개 중 실제 삭제 가능한 (a)진짜죽음은 **~39개(약 35%)뿐**이었다. 나머지 ~65%는 삭제 불가.

삭제 전 6유형 판별(오탐 taxonomy는 로드맵 §3):
- **(a) 진짜 죽음** — 정의+배럴 외 참조 0 → 삭제 대상.
- **로컬 사용** — 살아있는(미플래그) 형제가 같은 파일에서 값/타입 위치로 참조. `export`만 잉여, 삭제하면 tsc red. 예: `SQL_INJECTION_PATTERNS`(`uniqn-mobile/src/utils/security.ts:191`)는 살아있는 `hasSQLInjectionPattern`이 소비.
- **(b) 의도적 계약/SSOT** — 미구현 계약 표면·DB enum 정합 SSOT. 예: `statusValues.ts`의 13 `*_VALUES`(`uniqn-mobile/src/constants/statusValues.ts`)는 로컬 STATUS 구성 + enum 정합 → **보존**. 관련 [[enum-divergence]].
- **(d) 배럴 재수출 / (f) 타입-포지션** — 소비자가 정본 경로로 직접 import → 배럴 재수출만 잉여.

## 안전 삭제 프로토콜 (검증됨: PR#231, code-reviewer 전 배치 APPROVE)

1. **grep 사전분류**: 심볼명 전체 저장소 grep(`.web/.native`·`scripts`·`app.config`·`__tests__` 포함) → 정의+배럴 외 참조 0 확인. 동명 로컬 const 오탐 주의(import 경로/스코프까지).
2. **안전 오라클 = 선언 전체 수동 삭제 → `tsc --noEmit`**. green=진짜죽음(유지), **red=타입/로컬 실사용(즉시 리버트)**. tsc가 하드 오라클.
   - ⚠️ `knip --fix`는 `export` 키워드만 떼고 선언을 남겨 `noUnusedLocals`가 무조건 red를 만든다 → 오라클과 **양립 불가**. 리프에선 수동 전체 삭제.
3. **전체 jest + knip 재측정**: 런타임/동적 사용 배제 + 카운트 감소·**새 미사용(캐스케이드) 0** 확인.
4. **배럴 협응 삭제**: 배럴만 재수출하고 아무도 import 안 하면 **소스 선언 + 배럴 named 재수출 라인 둘 다** 제거해야 tsc green. dead-coupled 클러스터(서로만 호출하는 죽은 함수쌍)는 **묶음 삭제**. 파일 전량 죽으면 `git rm`.
5. 삭제 배치마다 code-reviewer 독립 검증(grep 결정적 + 독립 tsc).

## 래칫 게이트 (A1)

`uniqn-mobile/package.json`: `"knip:gate": "knip --max-issues=<N>"`. N은 **knip 자체 출력 총계**(exports+types+duplicates, hints 미포함). 배치마다 실측 총계로 하향하는 **단조감소** 게이트 → 미래의 미사용 증가를 CI가 차단. **phase 경계·병합 시 재baseline**(캐스케이드로 비단조 이동 시 "새 미사용" vs "캐스케이드" 구분 판독).

## 🔑 병합 시 stale-base 안전망 (PR#231 실사례)

브랜치가 **오래된 base**에서 삭제한 심볼을, 그 사이 master에 머지된 코드가 **새로 소비**하면 병합 트리에서 깨진다. 3-way 병합은 텍스트로 자동 해소되지만 **의미 충돌은 tsc가 잡는다**:
- PR#231 병합 시 구 base에서 죽어 삭제했던 `getStaffRoleLabel`을 master #230(ops-1e) 신규 소비자(`DealerPickerSheet`·`StaffRow`)가 사용 → `tsc` TS2305 적발 → **삭제 되돌려 복원**(`uniqn-mobile/src/types/role.ts`). `getUserRoleLabel`은 여전히 소비 0이라 삭제 유지.
- **교훈**: 죽은코드 삭제 브랜치는 머지 전 `origin/master` 통합 + `tsc`로 stale-base 회귀를 반드시 확인.

## 종착점 (로드맵 개정 2)

§1 목표(knip을 CI 게이트로 신뢰)는 **래칫 도입 시점에 달성**(죽은 export 런타임 비용 0). 따라서 **P4(컴포넌트)·P5(공개 API 계약: services/repos/hooks/schemas/domains/errors) 대량 삭제는 비권장** — 런타임 이득 0 + prod 계약·Zod 보안경계 회귀 위험. 계약 표면 위험도는 레이어로 결정([[layers]]: 리프 constants/utils는 저위험, Service·Repository 경계는 계약). 잔여 리프 OTHER 버킷 69는 단순 죽음이 아니라 **중복/잉여 재수출 disambiguation**(생성타입 `types/supabase.ts`는 불가촉).

## 관련
- [[knip-unused-export-triage]] — 실행 세션·배치·수치 상세 (sources)
- [[layers]] — 리프 vs 계약 레이어 경계가 삭제 위험도를 결정 (architecture)
- [[enum-divergence]] — 정적 그래프가 못 보는 사용(Zod read tolerance ↔ knip 미사용 오탐) 공통 클래스
