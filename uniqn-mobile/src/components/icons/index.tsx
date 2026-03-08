/**
 * UNIQN Mobile - 아이콘 컴포넌트
 *
 * @description Heroicons 스타일 아이콘 래퍼 (다크모드 자동 대응)
 * @version 2.0.0 - 팩토리 패턴으로 리팩토링
 */

import React from 'react';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

type IconProps = {
  size?: number;
  color?: string;
};

// 기본 아이콘 사이즈
const DEFAULT_SIZE = 24;

// 다크모드 대응 색상
const DEFAULT_COLOR_LIGHT = '#6B7280'; // gray-500
const DEFAULT_COLOR_DARK = '#9CA3AF'; // gray-400

/**
 * 다크모드 인식 기본 색상 훅
 * 명시적 color가 없으면 다크모드에 맞는 기본값 반환
 */
function useDefaultColor(explicitColor?: string): string {
  const { colorScheme } = useColorScheme();
  if (explicitColor) return explicitColor;
  return colorScheme === 'dark' ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;
}

// 레거시 호환성을 위한 DEFAULT_COLOR export (외부에서 사용할 수 있음)
export const DEFAULT_COLOR = DEFAULT_COLOR_LIGHT;

// ============================================================================
// 팩토리 함수
// ============================================================================

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type MaterialName = React.ComponentProps<typeof MaterialIcons>['name'];

function createFeatherIcon(name: FeatherName) {
  return function FeatherIconComponent({ size = DEFAULT_SIZE, color }: IconProps) {
    const resolvedColor = useDefaultColor(color);
    return <Feather name={name} size={size} color={resolvedColor} />;
  };
}

function createMaterialIcon(name: MaterialName) {
  return function MaterialIconComponent({ size = DEFAULT_SIZE, color }: IconProps) {
    const resolvedColor = useDefaultColor(color);
    return <MaterialIcons name={name} size={size} color={resolvedColor} />;
  };
}

// ============================================================================
// Navigation & UI
// ============================================================================

export const HomeIcon = createFeatherIcon('home');
export const SearchIcon = createFeatherIcon('search');
export const BellIcon = createFeatherIcon('bell');
export const UserIcon = createFeatherIcon('user');
export const UsersIcon = createFeatherIcon('users');
export const SettingsIcon = createFeatherIcon('settings');
export const MenuIcon = createFeatherIcon('menu');
export const XMarkIcon = createFeatherIcon('x');
export const ChevronLeftIcon = createFeatherIcon('chevron-left');
export const ChevronRightIcon = createFeatherIcon('chevron-right');
export const ChevronDownIcon = createFeatherIcon('chevron-down');
export const ChevronUpIcon = createFeatherIcon('chevron-up');

// ============================================================================
// Actions
// ============================================================================

export const PlusIcon = createFeatherIcon('plus');
export const MinusIcon = createFeatherIcon('minus');
export const EditIcon = createFeatherIcon('edit-2');
export const TrashIcon = createFeatherIcon('trash-2');
export const CopyIcon = createFeatherIcon('copy');
export const ShareIcon = createFeatherIcon('share-2');
export const FilterIcon = createFeatherIcon('filter');
export const RefreshIcon = createFeatherIcon('refresh-cw');

// ============================================================================
// Status & Feedback
// ============================================================================

export const CheckIcon = createFeatherIcon('check');
export const CheckCircleIcon = createFeatherIcon('check-circle');
export const AlertCircleIcon = createFeatherIcon('alert-circle');
export const ExclamationCircleIcon = createFeatherIcon('alert-circle');
export const ExclamationTriangleIcon = createFeatherIcon('alert-triangle');
export const InformationCircleIcon = createFeatherIcon('info');

// ============================================================================
// Content
// ============================================================================

export const CalendarIcon = createFeatherIcon('calendar');
export const ClockIcon = createFeatherIcon('clock');
export const MapPinIcon = createFeatherIcon('map-pin');
export const MapIcon = MapPinIcon;
export const PhoneIcon = createFeatherIcon('phone');
export const MailIcon = createFeatherIcon('mail');
export const CurrencyDollarIcon = createMaterialIcon('attach-money');
export const BriefcaseIcon = createFeatherIcon('briefcase');
export const DocumentIcon = createFeatherIcon('file-text');
export const ImageIcon = createFeatherIcon('image');
export const CameraIcon = createFeatherIcon('camera');

// ============================================================================
// Auth & Security
// ============================================================================

export const EyeIcon = createFeatherIcon('eye');
export const EyeSlashIcon = createFeatherIcon('eye-off');
export const LockIcon = createFeatherIcon('lock');
export const UnlockIcon = createFeatherIcon('unlock');
export const LogOutIcon = createFeatherIcon('log-out');
export const LogInIcon = createFeatherIcon('log-in');
export const ArrowRightIcon = createFeatherIcon('arrow-right');
export const ArrowLeftIcon = createFeatherIcon('arrow-left');

// ============================================================================
// Social & Communication
// ============================================================================

export const HeartIcon = createFeatherIcon('heart');

// 특수 케이스: 기본색이 다른 아이콘
export const HeartFilledIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = color || '#EF4444';
  return <MaterialIcons name="favorite" size={size} color={resolvedColor} />;
};

export const HeartOutlineIcon = createMaterialIcon('favorite-border');

// Bookmark Icons (즐겨찾기)
type BookmarkIconProps = IconProps & { filled?: boolean };

export const BookmarkIcon = ({ size = DEFAULT_SIZE, color, filled = false }: BookmarkIconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="bookmark" size={size} color={filled ? '#F59E0B' : resolvedColor} />;
};

export const BookmarkFilledIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = color || '#F59E0B';
  return <MaterialIcons name="bookmark" size={size} color={resolvedColor} />;
};

export const BookmarkOutlineIcon = createMaterialIcon('bookmark-outline');
export const StarIcon = createFeatherIcon('star');
export const MessageIcon = createFeatherIcon('message-circle');

// ============================================================================
// Loading & QR
// ============================================================================

export const LoaderIcon = createFeatherIcon('loader');
export const QrCodeIcon = createMaterialIcon('qr-code-2');
export const ScanIcon = createMaterialIcon('qr-code-scanner');

// ============================================================================
// Notification
// ============================================================================

export const BellSlashIcon = createFeatherIcon('bell-off');
export const UserPlusIcon = createFeatherIcon('user-plus');
export const UserMinusIcon = createFeatherIcon('user-minus');
export const XCircleIcon = createFeatherIcon('x-circle');
export const CalendarDaysIcon = createFeatherIcon('calendar');
export const BanknotesIcon = createMaterialIcon('payments');
export const MegaphoneIcon = createMaterialIcon('campaign');

// ============================================================================
// Misc
// ============================================================================

export const WrenchScrewdriverIcon = createFeatherIcon('tool');
export const ArrowPathIcon = createFeatherIcon('refresh-cw');
export const ChatBubbleLeftIcon = createFeatherIcon('message-square');
export const ShieldCheckIcon = createFeatherIcon('shield');
export const MoonIcon = createFeatherIcon('moon');
export const DevicePhoneMobileIcon = createFeatherIcon('smartphone');
export const GiftIcon = createFeatherIcon('gift');
export const TagIcon = createFeatherIcon('tag');
export const HashtagIcon = createFeatherIcon('hash');
export const WifiIcon = createFeatherIcon('wifi');
export const WifiOff = createFeatherIcon('wifi-off');
export const RefreshCw = createFeatherIcon('refresh-cw');
export const GlobeIcon = createFeatherIcon('globe');
export const ShieldIcon = createFeatherIcon('shield');
export const CreditCardIcon = createFeatherIcon('credit-card');
export const InboxIcon = createFeatherIcon('inbox');
export const CurrencyYenIcon = createMaterialIcon('currency-yen');
export const Squares2X2Icon = createFeatherIcon('grid');

// ============================================================================
// Aliases (호환성)
// ============================================================================

export const MagnifyingGlassIcon = SearchIcon;
export const EnvelopeIcon = MailIcon;
export const QRCodeIcon = QrCodeIcon;
export const AlertTriangleIcon = ExclamationTriangleIcon;
