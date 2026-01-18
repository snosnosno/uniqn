/**
 * UNIQN Mobile - UI 컴포넌트 배럴 Export
 *
 * @description 재사용 가능한 UI 컴포넌트 모음
 * @version 1.0.0
 */

// ============================================================================
// Core Components
// ============================================================================

export { Button, type ButtonProps } from './Button';
export { Input, type InputProps } from './Input';
export { Card, type CardProps } from './Card';
export { Badge, type BadgeProps } from './Badge';
export { Avatar, type AvatarProps } from './Avatar';
export { Divider } from './Divider';
export {
  Accordion,
  AccordionItem,
  AccordionGroup,
  type AccordionItemProps,
  type AccordionGroupProps,
} from './Accordion';

// ============================================================================
// State Components
// ============================================================================

export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState } from './ErrorState';

// ============================================================================
// Error Boundary
// ============================================================================

export {
  // 기본 에러 바운더리
  ErrorBoundary,
  withErrorBoundary,
  ScreenErrorBoundary,
  FeatureErrorBoundary,
  // 세분화된 에러 바운더리
  NetworkErrorBoundary,
  AuthErrorBoundary,
  FormErrorBoundary,
  DataFetchErrorBoundary,
  CompositeErrorBoundary,
  // 타입
  type ErrorBoundaryProps,
} from './ErrorBoundary';

// ============================================================================
// Feedback Components
// ============================================================================

export { Toast } from './Toast';
export { ToastManager } from './ToastManager';
export { Modal, AlertModal, ConfirmModal, type ModalProps } from './Modal';
export { ActionSheet, type ActionSheetProps, type ActionSheetOption } from './ActionSheet';
export {
  BottomSheet,
  SelectBottomSheet,
  type BottomSheetProps,
  type BottomSheetRef,
  type SelectBottomSheetProps,
} from './BottomSheet';
export { ModalManager } from './ModalManager';

// ============================================================================
// Form Components
// ============================================================================

export { FormField, FormSection, FormRow } from './FormField';
export { FormSelect, type SelectOption } from './FormSelect';
export {
  Checkbox,
  CheckboxGroup,
  type CheckboxProps,
  type CheckboxGroupProps,
} from './Checkbox';
export { Radio, type RadioProps, type RadioOption } from './Radio';
export {
  DatePicker,
  DateRangePicker,
  type DatePickerProps,
  type DateRangePickerProps,
} from './DatePicker';
export {
  CalendarPicker,
  type CalendarPickerProps,
} from './CalendarPicker';
export {
  TimePicker,
  TimePickerGrid,
  type TimePickerProps,
  type TimePickerGridProps,
} from './TimePicker';
export {
  TimeWheelPicker,
  type TimeWheelPickerProps,
  type TimeValue,
} from './TimeWheelPicker';

// ============================================================================
// Progress Components
// ============================================================================

export { CircularProgress, type CircularProgressProps } from './CircularProgress';

// ============================================================================
// Loading / Skeleton Components
// ============================================================================

export { Loading, type LoadingProps } from './Loading';
export { LoadingOverlay, InlineLoadingOverlay } from './LoadingOverlay';
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonListItem,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonJobCard,
  SkeletonScheduleCard,
  // Phase 2A 추가 프리셋
  SkeletonNotificationItem,
  SkeletonApplicantCard,
  SkeletonProfileHeader,
  SkeletonStatsCard,
  SkeletonSettlementRow,
} from './Skeleton';

// ============================================================================
// Image Components
// ============================================================================

export {
  OptimizedImage,
  AvatarImage,
  BannerImage,
  ProductImage,
  DEFAULT_BLURHASH,
  type OptimizedImageProps,
  type BlurhashPreset,
} from './OptimizedImage';

// ============================================================================
// Layout Components
// ============================================================================

export { MobileHeader, HeaderAction, LargeHeader } from './MobileHeader';

// ============================================================================
// In-App Message Components
// ============================================================================

export { InAppBanner } from './InAppBanner';
export { InAppModal } from './InAppModal';
export { InAppMessageManager } from './InAppMessageManager';
