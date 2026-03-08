/**
 * UNIQN Mobile - WebPortal 공통 컴포넌트
 *
 * @description 웹에서 DOM 최상위(document.body)에 렌더링하기 위한 Portal 래퍼.
 *              모달, 바텀시트, QR 스캐너 등에서 z-index 문제 해결에 사용.
 * @version 1.0.0
 */

import React from 'react';
// @ts-expect-error - react-dom 타입 없음 (Expo 웹에서 런타임에는 사용 가능)
import { createPortal } from 'react-dom';

interface WebPortalProps {
  children: React.ReactNode;
  /** false일 경우 렌더링하지 않음 (기본: true) */
  visible?: boolean;
}

/**
 * SSR 안전한 Portal 래퍼
 * - visible=false: null 반환
 * - SSR(document 없음): children 그대로 반환
 * - 웹: document.body에 Portal 렌더링
 */
export function WebPortal({ children, visible = true }: WebPortalProps) {
  if (!visible) return null;
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
}
