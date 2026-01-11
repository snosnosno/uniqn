/**
 * UNIQN Mobile - 아이콘 컴포넌트
 *
 * @description Heroicons 스타일 아이콘 래퍼
 * @version 1.0.0
 */

// eslint-disable-next-line import/no-unresolved
import { Feather, MaterialIcons } from '@expo/vector-icons';

type IconProps = {
  size?: number;
  color?: string;
};

// 기본 아이콘 사이즈
const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = '#6B7280';

// Navigation & UI
export const HomeIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="home" size={size} color={color} />
);

export const SearchIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="search" size={size} color={color} />
);

export const BellIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="bell" size={size} color={color} />
);

export const UserIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="user" size={size} color={color} />
);

export const UsersIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="users" size={size} color={color} />
);

export const SettingsIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="settings" size={size} color={color} />
);

export const MenuIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="menu" size={size} color={color} />
);

export const XMarkIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="x" size={size} color={color} />
);

export const ChevronLeftIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="chevron-left" size={size} color={color} />
);

export const ChevronRightIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="chevron-right" size={size} color={color} />
);

export const ChevronDownIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="chevron-down" size={size} color={color} />
);

export const ChevronUpIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="chevron-up" size={size} color={color} />
);

// Actions
export const PlusIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="plus" size={size} color={color} />
);

export const MinusIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="minus" size={size} color={color} />
);

export const EditIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="edit-2" size={size} color={color} />
);

export const TrashIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="trash-2" size={size} color={color} />
);

export const CopyIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="copy" size={size} color={color} />
);

export const ShareIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="share-2" size={size} color={color} />
);

export const FilterIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="filter" size={size} color={color} />
);

export const RefreshIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="refresh-cw" size={size} color={color} />
);

// Status & Feedback
export const CheckIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="check" size={size} color={color} />
);

export const CheckCircleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="check-circle" size={size} color={color} />
);

export const AlertCircleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="alert-circle" size={size} color={color} />
);

export const ExclamationCircleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="alert-circle" size={size} color={color} />
);

export const ExclamationTriangleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="alert-triangle" size={size} color={color} />
);

export const InformationCircleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="info" size={size} color={color} />
);

// Content
export const CalendarIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="calendar" size={size} color={color} />
);

export const ClockIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="clock" size={size} color={color} />
);

export const MapPinIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="map-pin" size={size} color={color} />
);

// Alias for MapPinIcon
export const MapIcon = MapPinIcon;

export const PhoneIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="phone" size={size} color={color} />
);

export const MailIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="mail" size={size} color={color} />
);

export const CurrencyDollarIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="attach-money" size={size} color={color} />
);

export const BriefcaseIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="briefcase" size={size} color={color} />
);

export const DocumentIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="file-text" size={size} color={color} />
);

export const ImageIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="image" size={size} color={color} />
);

export const CameraIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="camera" size={size} color={color} />
);

// Auth & Security
export const EyeIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="eye" size={size} color={color} />
);

export const EyeSlashIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="eye-off" size={size} color={color} />
);

export const LockIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="lock" size={size} color={color} />
);

export const UnlockIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="unlock" size={size} color={color} />
);

export const LogOutIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="log-out" size={size} color={color} />
);

// Social & Communication
export const HeartIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="heart" size={size} color={color} />
);

export const StarIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="star" size={size} color={color} />
);

export const MessageIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="message-circle" size={size} color={color} />
);

// Loading
export const LoaderIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="loader" size={size} color={color} />
);

// QR Code
export const QrCodeIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="qr-code-2" size={size} color={color} />
);

export const ScanIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="qr-code-scanner" size={size} color={color} />
);

// Notification Icons
export const BellSlashIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="bell-off" size={size} color={color} />
);

export const UserPlusIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="user-plus" size={size} color={color} />
);

export const UserMinusIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="user-minus" size={size} color={color} />
);

export const XCircleIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="x-circle" size={size} color={color} />
);

export const CalendarDaysIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="calendar" size={size} color={color} />
);

export const BanknotesIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="payments" size={size} color={color} />
);

export const MegaphoneIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="campaign" size={size} color={color} />
);

export const WrenchScrewdriverIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="tool" size={size} color={color} />
);

export const ArrowPathIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="refresh-cw" size={size} color={color} />
);

export const ChatBubbleLeftIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="message-square" size={size} color={color} />
);

export const ShieldCheckIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="shield" size={size} color={color} />
);

export const MoonIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="moon" size={size} color={color} />
);

export const DevicePhoneMobileIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="smartphone" size={size} color={color} />
);

// Misc
export const GiftIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="gift" size={size} color={color} />
);

export const TagIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="tag" size={size} color={color} />
);

export const HashtagIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="hash" size={size} color={color} />
);

// Network Status
export const WifiIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="wifi" size={size} color={color} />
);

export const WifiOff = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="wifi-off" size={size} color={color} />
);

export const RefreshCw = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="refresh-cw" size={size} color={color} />
);

// Admin & Global
export const GlobeIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="globe" size={size} color={color} />
);

export const ShieldIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="shield" size={size} color={color} />
);

export const CreditCardIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="credit-card" size={size} color={color} />
);

// Inbox
export const InboxIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <Feather name="inbox" size={size} color={color} />
);

// Aliases for heroicons compatibility
export const MagnifyingGlassIcon = SearchIcon;
export const EnvelopeIcon = MailIcon;

// QR Icon Alias (대소문자 호환성)
export const QRCodeIcon = QrCodeIcon;

// Alert/Warning Icon Alias
export const AlertTriangleIcon = ExclamationTriangleIcon;

// Currency Icon (CurrencyDollarIcon의 엔화 버전)
export const CurrencyYenIcon = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
  <MaterialIcons name="currency-yen" size={size} color={color} />
);
