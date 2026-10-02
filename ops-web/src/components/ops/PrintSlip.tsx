/**
 * 인쇄 전용 영역 — body 직속 포털로 그려 화면에는 보이지 않고, 인쇄할 때는 **이것만** 나온다
 * (index.css `.print-slip` 규칙). 대화상자(Radix 포털) 안에서 `window.print()` 를 불러도
 * 대화상자·콘솔은 인쇄되지 않는다.
 */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function PrintSlip({ children }: { children: ReactNode }) {
  return createPortal(<div className="print-slip">{children}</div>, document.body);
}
