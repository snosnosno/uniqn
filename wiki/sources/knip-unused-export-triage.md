---
area: sources
updated: 2026-07-08
status: current
sources:
  - uniqn-mobile/docs/planning/2026-07-05-unused-exports-triage-roadmap.md
  - uniqn-mobile/docs/planning/2026-07-05-unused-exports-triage-handoff-prompt.md
  - uniqn-mobile/package.json
  - PR#231
  - PR#224
  - memory/project_knip_triage_execution.md
tags: [knip, dead-code, triage, ratchet, refactor]
---

# 소스: 미사용 export triage (2026-07-05~08)

knip이 보고한 미사용 심볼 ~3,000건을 **단계별로 정리한 캠페인**의 요약. **✅ PR#231 master 머지완료(`c75d78add`)** — 신호 정화(래칫 게이트) + 저위험 리프 죽은코드 제거. 재사용 규칙·프로토콜은 [[knip-signal-hygiene]].

## 배경 (why)
- knip 미사용 ~3,000건에 오탐이 대량 → 진짜 죽은코드를 가려낼 수 없어 CI 게이트로 무용. 신호 대 잡음비 회복이 목표.
- 원안 "0→5 전 Phase 완주(21~29세션)"는 **폐기**(로드맵 개정 2): §1 목표는 래칫 도입 시 달성되므로 Phase 1~3만 확정, P4/P5는 재결정. 대량삭제는 런타임 이득 0 + prod 회귀 위험.

## 실행 (2951 → 2313, −638)
- **Phase 0** — knip config 하드닝(테스트 인프라·바이너리 오탐 봉인). 파일/deps/바이너리 0.
- **STEP A/B** — `knip@6.25.0` devDeps 핀(floating 제거) + `knip:gate = knip --max-issues=<N>` 래칫 배선(`uniqn-mobile/package.json`).
- **Phase 1** — 중복 `Component|default` 이중수출 **277개** 잉여 default 제거(named 유지). Duplicate 313→36.
- **Phase 2** — 죽은 dep `@cloudflare/workers-types` 제거(OG 엣지 인프라 [[knip-unused-export-triage]] 선행 삭제 PR#224로 소비 0).
- **Phase 3 (리프 (a)죽음)** — utils/types/constants/lib/shared 죽은 export. 배럴 협응삭제 + 전량 죽은 파일 `constants/location.ts`·`database.ts` `git rm`. 세션 2에서 4배치 −80.

## 핵심 실측 (P4/P5 판단 근거)
- **knip 미사용의 ~65%는 삭제 불가**(로컬사용/의도적 계약/SSOT). 리프 SELF 109후보 중 (a)삭제가능 ~39(35%). stores/lib/shared/constants/security 구역 SELF는 삭제가능 0건.
- 검증: 각 배치 `type-check EXIT0` · 전체 `jest` · `knip` 재측정(캐스케이드 0) · code-reviewer **전 배치 APPROVE**. 병합 트리 최종: tsc0 · jest **4886** · quality0 · knip **2344** · CI 8/8 green.

## 병합 노트 (stale-base)
브랜치가 구 master 기반이라 그새 머지된 #227~#230(ops-1e 등)과 정합 필요. 3-way 병합 자동해소됐으나 `tsc`가 **stale-base 회귀 1건** 적발: 구 base서 죽어 삭제한 `getStaffRoleLabel`을 #230 신규 소비 → 복원. 래칫 재baseline 2313→2344(유입 master 미사용 +31). 상세 원리 [[knip-signal-hygiene]].

## 잔여 (다음 세션)
- **OTHER 버킷 69** — 단순 죽음 아니라 중복/잉여 재수출 disambiguation(`utils/job-posting/dateUtils.ts`↔`utils/date/*` 중복파일 통합·`types/supabase.ts` Json/Tables/Enums=**생성타입 불가촉**·정본 재수출 타입). 이중파일 분석·위험 높아 전용 세션 권장.
- **BARREL 계약타입** — `types/index.ts` 47(auth DTO·엔티티, Phase5-adjacent)·`useRealtimeSubscription` 훅 추상화(100% 死지만 문서화 공개모듈, 사인오프 권장).
- **P4/P5** — 로드맵 비권장. 착수점은 핸드오프 문서(`uniqn-mobile/docs/planning/2026-07-05-unused-exports-triage-handoff-prompt.md`).

## 관련
- [[knip-signal-hygiene]] — 재사용 규칙·안전 삭제 프로토콜·래칫 (decisions)
- [[layers]] — 리프 vs 계약 레이어 = 삭제 위험도 (architecture)
- [[enum-divergence]] — 정적 그래프가 못 보는 사용 공통 클래스 (decisions)
