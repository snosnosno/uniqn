# 핸드오프 프롬프트 — 미사용 export triage 실행 (다음 세션 메인 프롬프트)

> 작성일: 2026-07-05 · 목적: 이 세션에서 작성·머지한 triage 로드맵을 검토하고 **Phase 0부터** 실행
> 선행 완료(PR #224 머지): 죽은 OG 공유 인프라 제거 + 미사용 export triage 로드맵 문서화
> 로드맵(플랜 본문): [`2026-07-05-unused-exports-triage-roadmap.md`](./2026-07-05-unused-exports-triage-roadmap.md)

---

## 0. 결론 먼저

knip 실측 ~3,000건(**unused exports 1,725 + exported types 977 + duplicate 320**) 중 상당수가 오탐(엔트리포인트·배럴 재수출·Zod 추론타입·테스트 인프라)이다. **일괄 삭제는 prod를 깨뜨린다.** 그래서 다음 세션은 코드를 지우기 전에 **Phase 0(knip config 하드닝으로 신호부터 정화 → 진짜 미사용 재측정)**을 먼저 실행한다. 순서(0→1→…→5)를 반드시 지킨다.

---

## 1. 붙여넣기용 프롬프트 (다음 세션 첫 메시지)

```
미사용 export ~3,000건 정리를 시작한다. 먼저 uniqn-mobile/docs/planning/2026-07-05-unused-exports-triage-roadmap.md 를 정독하고, 로드맵 Phase 0(knip config 하드닝 → 오탐 봉인 → baseline 재측정)을 검토·실행하라.

규칙(반드시 준수):
- 착수 전 `git status` — 내가 만들지 않은 미커밋 변경이 있으면 새 워크트리+브랜치로 격리한다. (이 프로젝트는 병렬 세션이 흔함: feat/weekly-grid-p0-ux, ops-1f 워크트리 등)
- master에서 새 브랜치(예: chore/knip-config-harden)를 만들어 작업. 로컬 커밋만, push/PR은 사용자 지시 전까지 금지. 커밋 메시지는 한글 `<type>(<scope>): <설명>`.
- Phase 0는 코드 삭제 0건 — package.json 의 knip 블록에 entry/project 만 추가해 엔트리포인트(app/**, functions/**, supabase/functions/*, e2e config, babel.config.js, scripts/**)·테스트 인프라 오탐을 리포트에서 제거한다.
- 검증(이 세션 안에서 직접 실행한 증거 필수): config 변경 후 `npm run type-check`·`npm test` 그린 유지 + `npx knip` 재실행해 엔트리포인트/테스트 오탐이 실제로 사라졌는지 확인.
- 결과 기록: 로드맵 §2 표 아래에 "Phase 0 후 baseline"으로 남은 카테고리별 건수를 적고, 그 재측정치로 Phase 3~5 세션 수를 재산정한다.
- Phase 0 완료 전에는 Phase 1 이하로 내려가지 말 것(순서 엄수).

먼저 로드맵을 읽고, Phase 0의 knip entry/project 초안(로드맵 §4.0)이 현재 저장소 구조에 맞는지 검토한 뒤, 조정안과 예상 효과(오탐 몇 건 제거)를 제시하고 내 승인을 받은 다음 적용하라.
```

---

## 2. 다음 세션이 알아야 할 컨텍스트

- **로드맵 구조**: §3 = 6유형 오탐 taxonomy(각 유형 grep 식별규칙+처리원칙), §4 = Phase 0~5 배치 계획(위험 오름차순), §5 = 배치 공통 검증 프로토콜(type-check + jest + knip 재측정 + git diff의 Red-Green), §7 = 프로젝트 특이 주의.
- **Phase 순서와 위험도**: 0(config·무위험) → 1(중복 default dedup·저위험) → 2(죽은 파일/deps·저위험) → 3(리프 구역·저~중) → 4(컴포넌트·중) → 5(services·repos·hooks·schemas·domains·errors·고위험, 심볼별 판단). 총 상한 21~29세션이나 **Phase 0 재측정 후 대폭 줄 수 있음**.
- **tsc 사각지대**: `tsconfig.json`이 `functions/`·`supabase/functions/`·`e2e/` exclude → 이 구역 변경은 `npm run type-check`로 회귀가 안 잡힘 → "삭제"가 아니라 "config 봉인"이 원칙(Phase 0가 처리).
- **knip 오탐 확정 이력**: `pitfall_knip_falsepositive_build_config`(babel/expo-modules-core 삭제 금지), 현행 `ignoreDependencies`(mmkv/nitro/intent-launcher = 네이티브 peer) 건드리지 말 것.
- **이번 세션 여파**: OG 엣지함수가 제거됐으므로 `functions/**`는 이제 대상 파일이 없고(Phase 0 entry 초안의 `functions/**`는 무해·불필요), `@cloudflare/workers-types` devDep은 실미사용이 됨 → Phase 2에서 제거(제거 시 `npm install`로 lock 동기화).

---

## 3. 완료 정의 (Phase 0 세션)

- [ ] knip `entry`/`project` 추가 후 `npx knip`에서 엔트리포인트(functions/supabase-functions/e2e config)·테스트 팩토리 오탐이 리포트에서 사라짐
- [ ] `npm run type-check` exit 0 + `npm test` 0 failures (config 변경이라 그린 유지)
- [ ] 로드맵 §2에 "Phase 0 후 baseline" 재측정치 기록 + Phase 3~5 세션 수 재산정
- [ ] 로컬 커밋(`chore(knip): 엔트리포인트 등록으로 knip 신호 정화`) — push/PR은 사용자 지시 시
