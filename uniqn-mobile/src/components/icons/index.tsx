/**
 * UNIQN Icons — Lucide wrapping layer
 *
 * 기존 export 이름은 100% 보존하며 내부 구현만 lucide-react-native로 전환한다.
 * 호출부는 수정하지 않는다.
 *
 * 외부 코드는 반드시 이 파일에서 import — ESLint 가드레일로 강제된다.
 * (see eslint.config.js `no-restricted-imports`)
 */

import type { LucideIcon, LucideProps } from 'lucide-react-native';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bed,
  Bell,
  BellOff,
  Bookmark,
  Briefcase,
  Bus,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  CircleX,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  File,
  FileText,
  Flag,
  Flashlight,
  Gem,
  Gift,
  Globe,
  Hash,
  Heart,
  House,
  Image as LucideImage,
  Images,
  Inbox,
  Info,
  LayoutGrid,
  LoaderCircle,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Ellipsis,
  MessageCircle,
  MessageCircleMore,
  MessageSquare,
  Minus,
  Moon,
  Pencil,
  Phone,
  Pin,
  Plus,
  QrCode,
  RotateCw,
  ScanLine,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Sun,
  Tag,
  Trash2,
  TriangleAlert,
  Trophy,
  User,
  UserMinus,
  UserPlus,
  Users,
  Utensils,
  Wifi,
  WifiOff as LucideWifiOff,
  Wrench,
  X,
} from 'lucide-react-native/icons';
import { useColorScheme } from 'nativewind';
import React from 'react';
import Svg, { Line, Polyline } from 'react-native-svg';

import { SECONDARY_PALETTE } from '@/constants/colors';

export type IconProps = Omit<LucideProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export type IconComponent = React.FunctionComponent<IconProps>;

const DEFAULT_SIZE = 24;

// Lucide 공식 stroke 값. 생태계 관례와 일치시켜 비주얼 일관성 확보.
const DEFAULT_STROKE = 2.0;

const DEFAULT_COLOR_LIGHT = SECONDARY_PALETTE[500];
const DEFAULT_COLOR_DARK = SECONDARY_PALETTE[400];

export const DEFAULT_COLOR = DEFAULT_COLOR_LIGHT;

export function getDefaultIconColor(
  colorScheme: 'light' | 'dark' | undefined,
  explicitColor?: string
): string {
  if (explicitColor) return explicitColor;
  return colorScheme === 'dark' ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;
}

function useDefaultColor(explicitColor?: string): string {
  const { colorScheme } = useColorScheme();
  return getDefaultIconColor(colorScheme, explicitColor);
}

function createIcon(Component: LucideIcon): IconComponent {
  const Wrapped: IconComponent = ({
    size = DEFAULT_SIZE,
    color,
    strokeWidth = DEFAULT_STROKE,
    ...rest
  }) => {
    const resolved = useDefaultColor(color);
    return <Component size={size} color={resolved} strokeWidth={strokeWidth} {...rest} />;
  };
  return Wrapped;
}

function createFilledIcon(Component: LucideIcon, defaultFill: string): IconComponent {
  const Wrapped: IconComponent = ({ size = DEFAULT_SIZE, color = defaultFill, ...rest }) => (
    <Component size={size} color={color} fill={color} {...rest} />
  );
  return Wrapped;
}

// ─── Navigation / UI chrome ────────────────────────────────────────────────
export const HomeIcon = createIcon(House);
export const SearchIcon = createIcon(Search);
export const BellIcon = createIcon(Bell);
export const BellSlashIcon = createIcon(BellOff);
export const UserIcon = createIcon(User);
export const UsersIcon = createIcon(Users);
export const UserPlusIcon = createIcon(UserPlus);
export const UserMinusIcon = createIcon(UserMinus);
export const SettingsIcon = createIcon(Settings);
export const MenuIcon = createIcon(Menu);
export const EllipsisHorizontalIcon = createIcon(Ellipsis);
export const XMarkIcon = createIcon(X);
export const ChevronLeftIcon = createIcon(ChevronLeft);
export const ChevronRightIcon = createIcon(ChevronRight);
export const ChevronUpIcon = createIcon(ChevronUp);
export const ChevronDownIcon = createIcon(ChevronDown);
export const PlusIcon = createIcon(Plus);
export const MinusIcon = createIcon(Minus);

// ─── Actions ───────────────────────────────────────────────────────────────
export const EditIcon = createIcon(Pencil);
export const TrashIcon = createIcon(Trash2);
export const CopyIcon = createIcon(Copy);
export const ShareIcon = createIcon(Share2);
export const FilterIcon = createIcon(SlidersHorizontal);
export const RefreshIcon = createIcon(RotateCw);
export const LogOutIcon = createIcon(LogOut);
export const LogInIcon = createIcon(LogIn);
export const ArrowRightIcon = createIcon(ArrowRight);
export const ArrowLeftIcon = createIcon(ArrowLeft);
export const PaperPlaneOutlineIcon = createIcon(Send);

// ─── Status / feedback ─────────────────────────────────────────────────────
export const CheckIcon = createIcon(Check);
export const CheckCircleIcon = createIcon(CircleCheck);
export const AlertCircleIcon = createIcon(CircleAlert);
export const ExclamationTriangleIcon = createIcon(TriangleAlert);
export const InformationCircleIcon = createIcon(Info);
export const XCircleIcon = createIcon(CircleX);
export const XIcon = createIcon(X);
export const CloseCircleOutlineIcon = createIcon(CircleX);
export const LoaderIcon = createIcon(LoaderCircle);

// ─── Time / calendar / location ────────────────────────────────────────────
export const CalendarIcon = createIcon(Calendar);
export const ClockIcon = createIcon(Clock);
export const MapPinIcon = createIcon(MapPin);
export const PhoneIcon = createIcon(Phone);
export const MailIcon = createIcon(Mail);

// ─── Business / money ──────────────────────────────────────────────────────
export const CurrencyDollarIcon = createIcon(DollarSign);
export const BriefcaseIcon = createIcon(Briefcase);
export const BanknotesIcon = createIcon(Banknote);
export const CreditCardIcon = createIcon(CreditCard);
export const TrophyOutlineIcon = createIcon(Trophy);
export const FlagOutlineIcon = createIcon(Flag);

// ─── Documents / media ─────────────────────────────────────────────────────
export const DocumentIcon = createIcon(File);
export const DocumentTextOutlineIcon = createIcon(FileText);
export const ImageIcon = createIcon(LucideImage);
export const ImagesOutlineIcon = createIcon(Images);
export const CameraIcon = createIcon(Camera);
export const EyeIcon = createIcon(Eye);
export const EyeSlashIcon = createIcon(EyeOff);
export const ArchiveOutlineIcon = createIcon(Archive);

// ─── Security ──────────────────────────────────────────────────────────────
export const LockIcon = createIcon(Lock);
export const UnlockIcon = createIcon(LockOpen);
export const ShieldIcon = createIcon(Shield);
export const ShieldCheckIcon = createIcon(ShieldCheck);

// ─── Communication ─────────────────────────────────────────────────────────
export const MessageIcon = createIcon(MessageSquare);
export const ChatBubbleLeftIcon = createIcon(MessageCircle);
export const ChatbubbleEllipsesOutlineIcon = createIcon(MessageCircleMore);
export const MegaphoneIcon = createIcon(Megaphone);
export const MegaphoneOutlineIcon = createIcon(Megaphone);
export const InboxIcon = createIcon(Inbox);

// ─── QR / scan ─────────────────────────────────────────────────────────────
export const QrCodeIcon = createIcon(QrCode);
export const ScanIcon = createIcon(ScanLine);
export const FlashlightIcon = createIcon(Flashlight);

// ─── Device / system ───────────────────────────────────────────────────────
export const MoonIcon = createIcon(Moon);
export const SunIcon = createIcon(Sun);
export const DevicePhoneMobileIcon = createIcon(Smartphone);
export const WifiIcon = createIcon(Wifi);
export const WifiOff = createIcon(LucideWifiOff);
export const GlobeIcon = createIcon(Globe);

// ─── Misc ──────────────────────────────────────────────────────────────────
export const GiftIcon = createIcon(Gift);
export const TagIcon = createIcon(Tag);
export const HashtagIcon = createIcon(Hash);
export const Squares2X2Icon = createIcon(LayoutGrid);
export const AddCircleOutlineIcon = createIcon(CirclePlus);
export const PinIcon = createIcon(Pin);
export const RestaurantOutlineIcon = createIcon(Utensils);
export const BusOutlineIcon = createIcon(Bus);
export const BedOutlineIcon = createIcon(Bed);
export const WrenchScrewdriverIcon = createIcon(Wrench);
export const StarIcon = createIcon(Star);

// ─── Toggle icons (outline + filled) ───────────────────────────────────────
export const HeartIcon = createIcon(Heart);
export const HeartFilledIcon = createFilledIcon(Heart, '#DC2626');
export const GemIcon = createIcon(Gem);
export const BookmarkOutlineIcon = createIcon(Bookmark);
export const BookmarkFilledIcon = createFilledIcon(Bookmark, '#D4A017');

type BookmarkIconProps = IconProps & { filled?: boolean };
export const BookmarkIcon = ({ filled, ...props }: BookmarkIconProps) =>
  filled ? <BookmarkFilledIcon {...props} /> : <BookmarkOutlineIcon {...props} />;

// ─── Korean Won (custom) ───────────────────────────────────────────────────
// Lucide 1.8.0에 KoreanWon 아이콘이 없어 커스텀 SVG 유지.
// Lucide 업스트림 추가 시 `createIcon(KoreanWon)`으로 치환 가능.
export const CurrencyWonIcon: IconComponent = ({
  size = DEFAULT_SIZE,
  color,
  strokeWidth = DEFAULT_STROKE,
  ...rest
}) => {
  const resolved = useDefaultColor(color);
  const stroke = {
    stroke: resolved,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <Polyline points="5 4 8 14 12 4 16 14 19 4" {...stroke} />
      <Line x1="4" y1="11" x2="20" y2="11" {...stroke} />
      <Line x1="4" y1="15" x2="20" y2="15" {...stroke} />
    </Svg>
  );
};

// ─── Deprecated aliases ────────────────────────────────────────────────────
/**
 * @deprecated 한국 서비스에서 ¥ 심볼은 의미 오류 — `CurrencyWonIcon` 사용.
 *             1 릴리스 후 제거 예정.
 */
export const CurrencyYenIcon = CurrencyWonIcon;

// ─── Legacy aliases (기존 호출부 호환) ─────────────────────────────────────
export const HeartOutlineIcon = HeartIcon;
export const MapIcon = MapPinIcon;
export const ExclamationCircleIcon = AlertCircleIcon;
export const CalendarDaysIcon = CalendarIcon;
export const ArrowPathIcon = RefreshIcon;
export const RefreshCw = RefreshIcon;
export const MagnifyingGlassIcon = SearchIcon;
export const EnvelopeIcon = MailIcon;
export const QRCodeIcon = QrCodeIcon;
export const AlertTriangleIcon = ExclamationTriangleIcon;
export const AddIcon = PlusIcon;
export const CloseIcon = XMarkIcon;
export const CheckmarkIcon = CheckIcon;
export const CheckmarkCircleIcon = CheckCircleIcon;
export const CheckmarkCircleOutlineIcon = CheckCircleIcon;
export const AlertCircleOutlineIcon = AlertCircleIcon;
export const CalendarOutlineIcon = CalendarIcon;
export const LocationOutlineIcon = MapPinIcon;
export const PersonOutlineIcon = UserIcon;
export const PeopleOutlineIcon = UsersIcon;
export const EyeOutlineIcon = EyeIcon;
export const CreateOutlineIcon = EditIcon;
export const CloseCircleIcon = XCircleIcon;
export const TrashOutlineIcon = TrashIcon;
export const NotificationsIcon = BellIcon;
