import React from 'react';
import { View } from 'react-native';

/**
 * 연쇄 전환 딤 — 호스트(SafeAreaView) 레벨 (B1).
 *
 * OrderSheetScreen 내부 딤은 자신의 영역만 덮어 형제인 StackHeader·VenueSelectChips 가
 * 스왑 갭(SHEET_CHAIN_SWAP_MS) 동안 밝게 번쩍인다. 호스트가 OrderSheetScreen 에
 * onChainSwappingChange 를 넘기고 이 컴포넌트를 SafeAreaView 마지막 자식으로 렌더하면
 * 헤더까지 한 장으로 덮인다(OrderSheetScreen 은 위임 시 내부 딤을 렌더하지 않는다).
 *
 * 다음 시트 백드롭과 같은 black/50 — 인수인계 이음매 없음. pointerEvents none 이라
 * 대기 창의 사용자 탭(연쇄 예약 취소 경로)을 막지 않는다. RN Modal 이 아니므로
 * 다음 시트 마운트와 겹쳐도 중첩 Modal(#244) 위험이 없다.
 */
export function OrderSheetChainScrim({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 dark:bg-black/50"
      pointerEvents="none"
      testID="order-sheet-host-chain-scrim"
    />
  );
}
