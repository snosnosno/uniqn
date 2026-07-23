/**
 * SheetChainContext — 주문서 연쇄 입력의 시트 전환 연출 신호
 *
 * @description 연쇄로 열리는 시트는 아래에서 슬라이드하지 않고 제자리에서 fade-in 해야
 * "시트가 자리를 지킨 채 내용만 갈린다"는 느낌이 난다. 이 신호를 시트 컴포넌트 12개에
 * prop 으로 흘리면 계약이 12곳으로 번지므로, SheetModal 이 직접 읽는 Context 로 둔다.
 * 기본값 null = 연쇄 아님 → 앱 전역의 다른 SheetModal 사용처는 동작이 바뀌지 않는다.
 */
import { createContext, useContext } from 'react';

export interface SheetChainValue {
  /** 지금 마운트되는 시트가 연쇄로 열린 것인가 */
  entering: boolean;
  /** 시트가 화면에 올라온 시점 통지 — 호출부가 딤 레이어를 걷는다 */
  onEntered: () => void;
}

export const SheetChainContext = createContext<SheetChainValue | null>(null);

export function useSheetChain(): SheetChainValue | null {
  return useContext(SheetChainContext);
}
