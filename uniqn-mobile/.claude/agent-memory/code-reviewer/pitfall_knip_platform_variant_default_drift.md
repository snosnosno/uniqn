---
name: pitfall-knip-platform-variant-default-drift
description: knip 미사용 default export 정리 시 .web 플랫폼 변형이 미탐되어 base/web export 모양이 어긋남 — tsc는 base만 해석해 못잡음
metadata:
  type: project
---

knip 기반 "중복 Component|default 이중수출" 정리에서 `X.tsx`(네이티브 base)의 `export default X`는 제거되지만 짝인 `X.web.tsx`의 `export default X`는 knip 리포트에 안 잡혀 남는다 → base=named-only / web=named+default 로 export 모양이 어긋난다.

**Why:** knip은 Metro 플랫폼 확장자 해석(`.web`/`.native`)을 base와 동일 심볼로 완전 결합하지 못해, web 변형의 default를 "사용됨"으로 보수 판정하거나 스캔에서 빠뜨린다. tsc는 플랫폼 해석을 안 하고 **base(`.tsx`)만** 해석하므로 이 비대칭 자체를 절대 못 잡는다. 오직 `build:web`만이 web 변형을 실제 번들해 검증하는데, 그것도 해당 컴포넌트가 web 번들에서 **도달 가능**하고 **default를 import하는 소비처가 있을 때만** red가 된다.

이번 세션 실측(chore/knip-triage-exec, base 70983bcc6): 4쌍이 비대칭으로 남음 — `SheetProvider.web.tsx:11` · `PortOneIdentityVerification.web.tsx:348` · `QRCodeScanner.web.tsx:564` · `BottomSheet.web.tsx:158`. 전부 소비처가 named import라 **런타임/빌드 무해**(잔존 default는 죽은 코드). `sentryService`/`rootSentry` 쌍은 대칭 유지(전자 둘 다 default 보존, 후자 둘 다 named-only)라 문제없음.

**How to apply:** knip triage 배치(특히 예정된 Phase 4 컴포넌트 구간)에서 base `.tsx`의 default를 지울 때는 반드시 `*.web.tsx`/`*.native.tsx` 짝을 함께 grep해 export 모양을 대칭으로 맞춰라. 리뷰 시 "tsc·jest green"만으로 플랫폼 변형 정합을 신뢰하지 말 것 — tsc는 base만 본다. 짝 검증은 `grep -nE "export default|export (const|function|class)" X.tsx X.web.tsx` 대조가 최단. 소비처가 default를 import하는지(`import X from`)까지 확인하면 무해/유해가 갈린다.
