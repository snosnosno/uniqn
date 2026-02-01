/**
 * UNIQN Mobile - 아이콘 컴포넌트
 *
 * @description Heroicons 스타일 아이콘 래퍼 (다크모드 자동 대응)
 * @version 1.1.0 - 다크모드 자동 대응 추가
 */

import React from 'react';
// eslint-disable-next-line import/no-unresolved
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

// Navigation & UI (다크모드 자동 대응)
export const HomeIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="home" size={size} color={resolvedColor} />;
};

export const SearchIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="search" size={size} color={resolvedColor} />;
};

export const BellIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="bell" size={size} color={resolvedColor} />;
};

export const UserIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="user" size={size} color={resolvedColor} />;
};

export const UsersIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="users" size={size} color={resolvedColor} />;
};

export const SettingsIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="settings" size={size} color={resolvedColor} />;
};

export const MenuIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="menu" size={size} color={resolvedColor} />;
};

export const XMarkIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="x" size={size} color={resolvedColor} />;
};

export const ChevronLeftIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="chevron-left" size={size} color={resolvedColor} />;
};

export const ChevronRightIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="chevron-right" size={size} color={resolvedColor} />;
};

export const ChevronDownIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="chevron-down" size={size} color={resolvedColor} />;
};

export const ChevronUpIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="chevron-up" size={size} color={resolvedColor} />;
};

// Actions (다크모드 자동 대응)
export const PlusIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="plus" size={size} color={resolvedColor} />;
};

export const MinusIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="minus" size={size} color={resolvedColor} />;
};

export const EditIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="edit-2" size={size} color={resolvedColor} />;
};

export const TrashIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="trash-2" size={size} color={resolvedColor} />;
};

export const CopyIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="copy" size={size} color={resolvedColor} />;
};

export const ShareIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="share-2" size={size} color={resolvedColor} />;
};

export const FilterIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="filter" size={size} color={resolvedColor} />;
};

export const RefreshIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="refresh-cw" size={size} color={resolvedColor} />;
};

// Status & Feedback (다크모드 자동 대응)
export const CheckIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="check" size={size} color={resolvedColor} />;
};

export const CheckCircleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="check-circle" size={size} color={resolvedColor} />;
};

export const AlertCircleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="alert-circle" size={size} color={resolvedColor} />;
};

export const ExclamationCircleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="alert-circle" size={size} color={resolvedColor} />;
};

export const ExclamationTriangleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="alert-triangle" size={size} color={resolvedColor} />;
};

export const InformationCircleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="info" size={size} color={resolvedColor} />;
};

// Content (다크모드 자동 대응)
export const CalendarIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="calendar" size={size} color={resolvedColor} />;
};

export const ClockIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="clock" size={size} color={resolvedColor} />;
};

export const MapPinIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="map-pin" size={size} color={resolvedColor} />;
};

// Alias for MapPinIcon
export const MapIcon = MapPinIcon;

export const PhoneIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="phone" size={size} color={resolvedColor} />;
};

export const MailIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="mail" size={size} color={resolvedColor} />;
};

export const CurrencyDollarIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="attach-money" size={size} color={resolvedColor} />;
};

export const BriefcaseIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="briefcase" size={size} color={resolvedColor} />;
};

export const DocumentIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="file-text" size={size} color={resolvedColor} />;
};

export const ImageIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="image" size={size} color={resolvedColor} />;
};

export const CameraIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="camera" size={size} color={resolvedColor} />;
};

// Auth & Security (다크모드 자동 대응)
export const EyeIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="eye" size={size} color={resolvedColor} />;
};

export const EyeSlashIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="eye-off" size={size} color={resolvedColor} />;
};

export const LockIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="lock" size={size} color={resolvedColor} />;
};

export const UnlockIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="unlock" size={size} color={resolvedColor} />;
};

export const LogOutIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="log-out" size={size} color={resolvedColor} />;
};

export const LogInIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="log-in" size={size} color={resolvedColor} />;
};

export const ArrowRightIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="arrow-right" size={size} color={resolvedColor} />;
};

export const ArrowLeftIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="arrow-left" size={size} color={resolvedColor} />;
};

// Social & Communication (다크모드 자동 대응)
export const HeartIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="heart" size={size} color={resolvedColor} />;
};

// Bookmark Icons (즐겨찾기)
type BookmarkIconProps = IconProps & { filled?: boolean };

export const BookmarkIcon = ({ size = DEFAULT_SIZE, color, filled = false }: BookmarkIconProps) => {
  const resolvedColor = useDefaultColor(color);
  // filled일 때는 채워진 아이콘 (bookmark-filled가 없으므로 heart로 대체하거나 다른 방식 사용)
  return (
    <Feather
      name={filled ? 'bookmark' : 'bookmark'}
      size={size}
      color={filled ? '#F59E0B' : resolvedColor}
    />
  );
};

export const BookmarkFilledIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = color || '#F59E0B'; // 노란색 기본
  return <MaterialIcons name="bookmark" size={size} color={resolvedColor} />;
};

export const BookmarkOutlineIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="bookmark-outline" size={size} color={resolvedColor} />;
};

export const StarIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="star" size={size} color={resolvedColor} />;
};

export const MessageIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="message-circle" size={size} color={resolvedColor} />;
};

// Loading (다크모드 자동 대응)
export const LoaderIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="loader" size={size} color={resolvedColor} />;
};

// QR Code (다크모드 자동 대응)
export const QrCodeIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="qr-code-2" size={size} color={resolvedColor} />;
};

export const ScanIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="qr-code-scanner" size={size} color={resolvedColor} />;
};

// Notification Icons (다크모드 자동 대응)
export const BellSlashIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="bell-off" size={size} color={resolvedColor} />;
};

export const UserPlusIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="user-plus" size={size} color={resolvedColor} />;
};

export const UserMinusIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="user-minus" size={size} color={resolvedColor} />;
};

export const XCircleIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="x-circle" size={size} color={resolvedColor} />;
};

export const CalendarDaysIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="calendar" size={size} color={resolvedColor} />;
};

export const BanknotesIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="payments" size={size} color={resolvedColor} />;
};

export const MegaphoneIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="campaign" size={size} color={resolvedColor} />;
};

export const WrenchScrewdriverIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="tool" size={size} color={resolvedColor} />;
};

export const ArrowPathIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="refresh-cw" size={size} color={resolvedColor} />;
};

export const ChatBubbleLeftIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="message-square" size={size} color={resolvedColor} />;
};

export const ShieldCheckIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="shield" size={size} color={resolvedColor} />;
};

export const MoonIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="moon" size={size} color={resolvedColor} />;
};

export const DevicePhoneMobileIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="smartphone" size={size} color={resolvedColor} />;
};

// Misc (다크모드 자동 대응)
export const GiftIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="gift" size={size} color={resolvedColor} />;
};

export const TagIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="tag" size={size} color={resolvedColor} />;
};

export const HashtagIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="hash" size={size} color={resolvedColor} />;
};

// Network Status (다크모드 자동 대응)
export const WifiIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="wifi" size={size} color={resolvedColor} />;
};

export const WifiOff = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="wifi-off" size={size} color={resolvedColor} />;
};

export const RefreshCw = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="refresh-cw" size={size} color={resolvedColor} />;
};

// Admin & Global (다크모드 자동 대응)
export const GlobeIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="globe" size={size} color={resolvedColor} />;
};

export const ShieldIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="shield" size={size} color={resolvedColor} />;
};

export const CreditCardIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="credit-card" size={size} color={resolvedColor} />;
};

// Inbox (다크모드 자동 대응)
export const InboxIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="inbox" size={size} color={resolvedColor} />;
};

// Aliases for heroicons compatibility
export const MagnifyingGlassIcon = SearchIcon;
export const EnvelopeIcon = MailIcon;

// QR Icon Alias (대소문자 호환성)
export const QRCodeIcon = QrCodeIcon;

// Alert/Warning Icon Alias
export const AlertTriangleIcon = ExclamationTriangleIcon;

// Currency Icon (다크모드 자동 대응)
export const CurrencyYenIcon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <MaterialIcons name="currency-yen" size={size} color={resolvedColor} />;
};

// Squares (Grid/Grouping) Icon (다크모드 자동 대응)
export const Squares2X2Icon = ({ size = DEFAULT_SIZE, color }: IconProps) => {
  const resolvedColor = useDefaultColor(color);
  return <Feather name="grid" size={size} color={resolvedColor} />;
};
