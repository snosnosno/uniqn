/**
 * Staff Hooks Barrel Export (SSOT)
 *
 * @description
 * 스태프 관련 커스텀 훅을 통합 export합니다.
 * 이 폴더의 훅들이 스태프 기능의 단일 진실 소스(SSOT)입니다.
 *
 * @version 1.0.0
 * @since 2025-02-04
 *
 * @example
 * ```typescript
 * // 권장 방식: staff 폴더에서 직접 import
 * import {
 *   useStaffSelection,
 *   useStaffData,
 *   useStaffActions,
 *   useStaffModals,
 * } from '@/hooks/staff';
 *
 * // 또는 메인 hooks에서 import (V2 suffix 사용)
 * import { useStaffSelectionV2 } from '@/hooks';
 * ```
 */

// =============================================================================
// Staff Selection
// =============================================================================

export { useStaffSelection } from './useStaffSelection';
export type { UseStaffSelectionReturn } from './useStaffSelection';

// =============================================================================
// Staff Data
// =============================================================================

export { useStaffData } from './useStaffData';
export type { UseStaffDataParams, UseStaffDataReturn } from './useStaffData';

// =============================================================================
// Staff Actions
// =============================================================================

export { useStaffActions } from './useStaffActions';
export type { UseStaffActionsParams, UseStaffActionsReturn } from './useStaffActions';

// =============================================================================
// Staff Modals
// =============================================================================

export { useStaffModals } from './useStaffModals';
export type { DeleteConfirmData, ReportTarget, UseStaffModalsReturn } from './useStaffModals';
