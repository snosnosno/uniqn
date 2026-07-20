---
name: rn-flex-to-flexshrink-review
description: RN에서 flex:1 → maxHeight/flexShrink 전환 리뷰 레시피 — flexShrink 기본값 0 이라 부모가 줄면 오버플로, insets 패딩은 배경 갖는 View에 얹어야 함
metadata:
  type: project
---

`flex: 1` 을 "내용 기반 높이"로 바꾸는 RN 레이아웃 리팩터를 리뷰할 때 반드시 보는 2가지.

**Why:** 2026-07-19 SheetModal/Modal 리팩터(`fix/ui-foundation-6roots`)에서 둘 다 실제로 발생했고, 전역 insets 목(=0) 때문에 테스트로는 안 잡혔다.

**How to apply:**

1. **`flexShrink` 기본값은 0** (웹 CSS 의 1 과 다름). `{ maxHeight: X }` 만 남기고 `flex:1` 을 빼면 그 노드는 부모가 줄어도 **안 줄어들고 오버플로한다**. 부모가 줄어드는 실제 트리거는 `KeyboardAvoidingView`(iOS `behavior="padding"` / Android `"height"`) — 키보드가 뜬 순간만 재현된다. `justifyContent:'flex-end'` 면 오버플로는 **위쪽(헤더)** 으로 밀려 나가 제목·닫기 버튼이 화면 밖으로 사라진다. 판정: `maxHeight` 만 있고 `flexShrink` 가 없으면 → `flexShrink: 1` 추가 권고.

2. **`paddingBottom: insets.bottom` 은 배경(`bg-*`)을 가진 View 에 얹어야 한다.** 배경 없는 래퍼에 얹으면 카드가 화면 바닥에서 인셋만큼 떠서 그 틈으로 백드롭이 비친다(`rounded-t-*` 카드는 아래 모서리가 각져 더 도드라짐). 같은 PR 안에서도 SheetModal 은 배경 있는 View 에 얹어 정상, Modal 은 배경 없는 래퍼에 얹어 결함 — **한 PR 안의 두 구현을 나란히 대조**하는 게 가장 빠른 판별법.

`useSafeAreaInsets()` 자체는 RNModal 안에서도 안전하다(순수 React context → 루트 provider 값). `SafeAreaView` 는 네이티브 뷰라 모달 윈도우를 자기 기준 측정해서 0 이 되는 것. 단 `presentationStyle="pageSheet"/"formSheet"` 면 루트 인셋 ≠ 모달 인셋이라 훅 값이 과대 패딩이 된다 — 현재 레포는 전부 fullScreen/overFullScreen 이라 무해.
