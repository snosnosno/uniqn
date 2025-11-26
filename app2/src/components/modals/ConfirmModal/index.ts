/**
 * ConfirmModal 모듈 진입점
 *
 * 기존 import 경로 호환성 유지:
 * - import ConfirmModal from '../modals/ConfirmModal'
 * - import { ConfirmModal } from '../modals/ConfirmModal'
 *
 * 새로운 세부 import 지원:
 * - import { useConfirmInput } from '../modals/ConfirmModal'
 * - import type { ConfirmModalProps } from '../modals/ConfirmModal'
 */

// 메인 컴포넌트
export { default } from './ConfirmModal';
export { default as ConfirmModal } from './ConfirmModal';

// 커스텀 훅
export { useConfirmInput } from './useConfirmInput';

// 타입 (타입 전용 export)
export type { ConfirmModalProps, TextInputValidation, UseConfirmInputReturn } from './types';

// 스타일 상수 (확장 필요시 사용)
export {
  OVERLAY_STYLES,
  CONTAINER_STYLES,
  HEADER_STYLES,
  BODY_STYLES,
  FOOTER_STYLES,
  INPUT_STYLES,
  ARIA_IDS,
  getInputClassName,
} from './styles';
