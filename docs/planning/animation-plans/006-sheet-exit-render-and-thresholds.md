# 006 — 시트 퇴장 렌더 보장(지연 언마운트) + 드래그 임계 시트높이 스케일

- **Status**: TODO (2026-07-17 /review Red Team 발견 — 실기기 관찰 선행 필수)
- **Audit base**: 44b30e1d7 (/review 시점 HEAD)
- **Severity**: 구조 (확신도 6/10 — 실기기 확인 전 구현 금지)
- **Category**: 중단가능성·제스처 / 이징 렌더 보장
- **Depends on**: 004(퇴장 커브), 005(드래그 dismiss)

## Problem

### A. 네이티브 퇴장 애니메이션이 렌더되지 않을 가능성 (004 리뷰 LOW → Red Team 격상)

`NativeSheetModal`/`Modal`은 RN `Modal`에 `visible={visible}` 직결 + `animationType="none"`이라,
`visible=false` 순간 네이티브 모달이 콘텐츠를 즉시 제거한다. 004가 튜닝한 225ms `exitTravel`
퇴장과 005 드래그 dismiss의 "closing useEffect가 현재 위치에서 이어받아 퇴장" 전제가
화면에 렌더되지 않고, 드래그 dismiss는 슬라이드 아웃이 아닌 **팝 소멸**로 보일 수 있다.
방증: 같은 파일 `WebSheetModal`은 퇴장을 보이게 하려고 `shouldRender` 지연 언마운트를 쓴다.

### B. 짧은 시트의 거리 임계·백드롭 스케일 불일치 (Red Team)

거리 임계가 `windowHeight * 0.25`라, 비-fullHeight 짧은 시트(예: 200px)는 시트 전체 높이보다
임계가 커서 사실상 플릭으로만 닫힌다. 백드롭 interpolate 입력 범위도 `[0, windowHeight]`라
짧은 시트를 끝까지 끌어도 백드롭이 절반쯤 잔존한다.

## Target (초안 — 실기기 관찰 후 확정)

- A: `isClosing` 상태로 RNModal `visible`을 퇴장 duration(225ms)만큼 지연 언마운트
  (WebSheetModal의 `shouldRender` 패턴을 네이티브로 이식). Modal.tsx bottom 분기 동일 검토.
- B: `onLayout`으로 시트 실측 높이를 잡아 거리 임계·백드롭 범위를 시트 높이 기준으로 스케일
  (예: `0.35 × sheetHeight`), 또는 절대 px 임계.

## Boundaries / 선행 게이트

- **실기기 관찰이 선행 게이트**: ①일반 닫기/드래그 dismiss의 퇴장이 실제로 어떻게 보이는지
  ②짧은 시트(예: 필터 시트)의 드래그 체감. 관찰 결과가 문제없으면 이 계획은 폐기한다.
- 지연 언마운트는 키보드·`overlay` prop(중첩 모달 iOS 터치 함정)·`SHEET_DISMISS_ANIMATION_MS`
  대기 로직과 교차하므로 별도 브랜치에서 단독 수행.

## Verification

- Mechanical: quality EXIT 0 + ui jest.
- Feel check(필수): 드래그 dismiss가 슬라이드 아웃으로 보이는지, 확인형(지원하기) 흐름 회귀 없는지,
  짧은 시트 거리-dismiss 가능한지.
