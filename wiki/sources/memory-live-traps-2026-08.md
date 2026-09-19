---
area: sources
updated: 2026-08-25
status: current
sources:
  - memory/MEMORY.md
  - uniqn-mobile/scripts/obsidian-context.mjs
  - uniqn-mobile/eslint.config.js
  - PR#353
  - PR#474
  - PR#481
tags: [memory, graduation, traps, knowledge-system]
---

# 원천: MEMORY.md 「라이브 함정」 섹션 — 2026-08-25 졸업분

## 이 소스가 무엇인가

`memory/MEMORY.md`(항상-로딩 인덱스)의 `🚨 라이브 함정` 섹션. 2026-08 웨이브에서
"다음 작업에서 물릴 것"으로 적어둔 25항목, 2,978자. MEMORY.md 예산(14,000자)이
**7번째로 초과**(18,288자)한 정리 과정에서 졸업 대상으로 선별됐다.

앞선 6회(07-19·07-24·07-27·08-03·08-07·08-10)는 항목을 잘라내는 가지치기였고 매번
재발했다. 이번에는 **섹션을 통째로 옮기는 구조 분리**를 택했다 → [[knowledge-layer-budget]]

## 무엇이 졸업했나

**영속적 사실(도구·플랫폼의 성질, 재발 클래스)** 만 wiki 로 보냈다. 대부분이 하나의
개념으로 수렴했다 → [[vacuous-verification]]

| 원 항목 | 유형 |
|---|---|
| 테스트 목이 `footer` 를 버려 제출 버튼 미렌더 (08-11, 3건) | 단언 미도달 |
| 신버전 계측으로 구버전 잔존 카운트 = 항상 0 | 구조적 0 |
| RLS 테이블 pgTAP "0건" = "안 보인다"일 수 있음 | 구조적 0 |
| anon 계측 `job_share_opened` 이중 차단, 무음 유실 | 구조적 0 |
| `docker exec -i` 누락 → 출력 0줄 성공처럼 (08-14 거짓 green) | 미실행 성공 |
| CHECK 제약 이름 오지정 → 제약 2개 AND 결합 | 미실행 성공 |
| 파리티 `201 = 201` 이 반대방향 드리프트 상쇄 | 미실행 성공 |
| `accessibilityState` 웹 무효 (rnw `^0.21.0`) | 판정축 오류 |
| `total - checkedIn` 이 퇴근자를 미출근으로 셈 | 판정축 오류 |
| eslint ignores 로 `e2e/` 가 `npm run quality` 밖 (PR#353) | 도구 사각지대 |
| `supabase` 클라 `Database` 제네릭 부재 → 오타 RPC 통과 | 도구 사각지대 |
| `postgrest-js` 가 fetch 예외의 `code` 를 빈 문자열로 버림 | 도구 사각지대 |

## 무엇이 MEMORY.md 에 남았나 (졸업 대상 아님)

§10 졸업 규칙상 **"아직 살아있는 관심사"** 는 인덱스에 남는다. 영속 지식이 아니라
현재 상태이기 때문이다.

- **현재 웨이브 한정 계약**: `weekly_grid_enabled` DB 키·딥링크 `weekly-grid` 세그먼트
  리네임 금지 · 서버·RLS 는 여전히 fixed 공고 지원 허용(의도적)
- **현재 플래그 상태**: `ops_hub_enabled` OFF 회귀 · 구 빌드 QR 거부 고지 필요
- **삭제 금지 자산**: Firebase `tholdem-ebc18`(FCM) · `supabase/setup-cli@v1` 은
  움직이는 브랜치
- **환경 운영 규칙**: 워크트리 `npm install` 금지 · 워크트리 웹배포 빈 번들 ·
  긴 배포 도중 메인 체크아웃이 바뀐다 · `protection` 켜면 열린 PR 즉시 BLOCKED
- 이미 memory 토픽 파일로 링크된 항목(배럴 삭제·bash grep 0건·Workflow 한도
  `verdict=null`·runtimeVersion·knip)은 **링크 한 줄이 이미 최소 형태**라 그대로 둠

## 직접 인용 (≤3줄)

> 🚨 **테스트 목이 계약 일부를 빠뜨리면 그 경로는 테스트가 있어도 검증되지 않는다**
> 🚨 **RLS 테이블의 pgTAP "0건"은 "행이 없다"가 아니라 "안 보인다"일 수 있다**
> 🚨 **`-i` 없으면 출력 0줄 성공처럼 끝난다**

## 관련

[[vacuous-verification]] · [[knowledge-layer-budget]] · [[semantic-merge-conflicts]] ·
[[prod-parity-baseline]] · [[rollout-instrumentation-gap]]
