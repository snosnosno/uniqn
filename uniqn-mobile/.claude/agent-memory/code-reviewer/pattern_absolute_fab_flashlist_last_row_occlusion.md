---
name: pattern-absolute-fab-flashlist-last-row-occlusion
description: absolute FAB 도입 리뷰 시 리스트 contentContainer 하단 패딩이 FAB 풋프린트 이상인지 대조 — 인라인폼→FAB 전환에서 흔한 누락
metadata:
  type: feedback
---

인라인 폼/버튼을 absolute FAB로 전환하는 커밋 리뷰에서 **리스트 스크롤 바닥의 마지막 행이 FAB에 가리는지** 반드시 대조하라.

**Why:** 인라인 폼은 리스트를 밀어내(밀림) 마지막 행 접근을 방해했지만, FAB는 `position:absolute`라 리스트 위에 떠서 스크롤 최하단 행을 덮는다. 전환 커밋은 폼을 지우면서 리스트의 `contentContainerStyle` 하단 패딩은 그대로 두기 쉽다(밀림 해소가 목표라 오히려 패딩을 줄이는 심리).

**How to apply:** ①FAB 풋프린트 계산 = `height + bottom offset + insets.bottom`(예: h-14=56 + bottom16 + insets). ②리스트 `contentContainerStyle` bottom 패딩이 그 값 이상인지 확인 — 미만이면 최하단 행이 가림. ③FAB가 `right:16`이면 마지막 행의 **우측 요소**(QR/체브론/액션 버튼)가 특히 겹쳐 탭 불가 위험 → MEDIUM. ④수정안 = contentContainer bottom 패딩을 ~88-96로 상향. 실증: OpsRegisterParticipantSheet L7(`2e515864e`) — PlayersTab 리스트 bottom 패딩 16 유지인데 FAB 풋프린트 ~72+insets, 마지막 참가자 PlayerClaimButton(QR) 겹침. 부수 체크: SafeAreaView `edges` 확인(top-only면 FAB의 `+insets.bottom`이 이중적용 아님 — 정상).
