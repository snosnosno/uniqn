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
export { CardStripe, type CardStripeTone, type CardStripeProps } from './CardStripe';
export { PressableCard, type PressableCardProps } from './PressableCard';
export { FocusablePressable, type FocusablePressableProps } from './FocusablePressable';
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
} from './error-boundary';

// ============================================================================
// Feedback Components
// ============================================================================

export { Toast } from './Toast';
export { ToastManager } from './ToastManager';
export { Modal, AlertModal, ConfirmModal, type ModalProps } from './Modal';
export { SheetModal, type SheetModalProps } from './SheetModal';
export { ModalFooterButtons, type ModalFooterButtonsProps } from './ModalFooterButtons';
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
// Numeric Input
// ============================================================================

export { NumericInput, type NumericInputProps } from './NumericInput';

// ============================================================================
// Numeric Text (tabular-nums)
// ============================================================================

export { NumericText, type NumericTextProps } from './NumericText';

// ============================================================================
// Form Components
// ============================================================================

export { FormField, FormSection, FormRow } from './FormField';
export { FormSelect, type SelectOption } from './FormSelect';
export { Checkbox, CheckboxGroup, type CheckboxProps, type CheckboxGroupProps } from './Checkbox';
export { GenderSegment, type GenderValue } from './GenderSegment';
export {
  DatePicker,
  DateRangePicker,
  type DatePickerProps,
  type DateRangePickerProps,
} from './DatePicker';
export { CalendarPicker, type CalendarPickerProps } from './CalendarPicker';
export { TimePicker, type TimePickerProps } from './TimePicker';
export { TimeWheelPicker, type TimeWheelPickerProps, type TimeValue } from './TimeWheelPicker';

// ============================================================================
// Progress Components
// ============================================================================

export { CircularProgress, type CircularProgressProps } from './CircularProgress';

// ============================================================================
// Loading / Skeleton Components
// ============================================================================

export { Loading, type LoadingProps } from './Loading';
export { OfflineStatusBar } from './OfflineStatusBar';

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonListItem,
  SkeletonBoardPostItem,
  SkeletonAvatar,
  SkeletonCircle,
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

export { ScreenSkeleton, type ScreenSkeletonType } from './ScreenSkeleton';

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
// Filter Components
// ============================================================================

export { FilterTabs, type FilterTabsProps, type FilterTabOption } from './FilterTabs';

// ============================================================================
// List Components
// ============================================================================

export { AppFlashList, type AppFlashListProps } from './AppFlashList';

// ============================================================================
// Password Components
// ============================================================================

export { PasswordStrength } from './PasswordStrength';
