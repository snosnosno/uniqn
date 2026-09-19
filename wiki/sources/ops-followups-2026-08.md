---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/src/components/ops/ChipCountSheet.tsx
  - uniqn-mobile/src/components/ops/OpsParticipantActionSheet.tsx
  - uniqn-mobile/src/constants/__tests__/ops.test.ts
  - PR#435
  - PR#438
tags: [ops, tournament, chip-count, realtime, deeplink]
---

# 소스: ops 후속 — 공개 링크 도메인 · 칩 카운트 (PR#435·#438)

## 존재하지 않는 도메인을 가리키고 있었다 (PR#435)

전광판 링크·플레이어 QR 슬립이 `https://ops.uniqn.app` 로 나갔는데
**그 도메인은 DNS 가 해석되지 않는다**(2026-08-07 실측). ops 전용 2nd Cloudflare Pages
프로젝트는 1c 설계에서 "브랜딩용·비차단"으로 잡혔다가 **끝내 만들어지지 않았고**,
공개 라우트(`/monitor/:token`·`/live/:token`)는 처음부터 메인 도메인의 SPA fallback 으로
서빙되고 있었다.

> 🔑 설계 문서에서 "선택적·나중에"로 분류된 인프라가 **코드에는 이미 전제로 박히는** 전형이다.
> 폴백 문자열을 새로 쓰지 않고 인증 콜백이 쓰던 `APP_WEB_ORIGIN` 상수를 재사용해 닫았다.

함께: AASA 에 `/jobs` 추가. 기존 패턴 `/jobs/*` 는 슬래시 뒤 세그먼트를 요구해
공고 목록 공유 링크만 iOS 에서 앱으로 안 열렸다. **AASA 는 네이티브 바이너리가 아니라
`public/` 의 웹 배포물이라 새 빌드 없이 나간다**(Apple CDN 캐시 지연은 있음).

## 관용구를 복제할 때 원본의 전제까지 복제됐는지 봐라 (PR#438)

참가자 칩 카운트 수동 입력에서, 시드 effect 의 deps 에 **인라인 객체**가 들어가
realtime refetch 마다 **입력 중이던 값이 되돌아갔다**. zod 도 서버도 통과하는 조용한 오입력이다.

> 🔑 다른 컴포넌트의 effect 관용구를 복사할 때, 원본이 "재렌더가 드물다"를 전제로 하고 있었다면
> realtime 이 붙은 화면에서는 그 전제가 깨진다. **deps 안정성**을 원본과 함께 옮겨야 한다.

> 🚨 **카운트 가드는 숫자가 우연히 같으면 머지 충돌이 안 난다.** 두 레인이 각각 +1 을 해서
> 둘 다 "201" 을 적으면 git 이 리터럴을 자동 병합해 버린다(정답은 202).
> 파리티 기대값 같은 **숫자 상수는 충돌 감지가 안 되는 종류의 계약**이다.

## 연결

- ops 엔진 구조: [[ops-engine]]
- ops 는 돈 흐름에 관여하지 않는다: [[ops-no-money-flow]]
- 파리티 기대값 관리: [[prod-parity-baseline]]
- 딥링크/AASA 축: [[address-geocoding-2026-08]]
