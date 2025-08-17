import React from 'react';
import {
  UsersIcon,
  ClockIcon,
  TrophyIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  TableCellsIcon,
  PlusIcon,
  Cog6ToothIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusCircleIcon,
  QueueListIcon,
  UserPlusIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  StarIcon,
  UserIcon,
  PresentationChartLineIcon,
  UserCircleIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  QrCodeIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  CameraIcon,
  ListBulletIcon,
  MapPinIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  CheckBadgeIcon,
  ClockIcon as HourglassIcon
} from '@heroicons/react/24/solid';

// Google 아이콘을 위한 커스텀 SVG
export const FaGoogle: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// 아이콘 래퍼 컴포넌트 - className 지원을 위해
const createIconWrapper = (Icon: React.ComponentType<any>) => {
  return React.forwardRef<SVGSVGElement, { className?: string; onClick?: () => void }>((props, ref) => (
    <Icon ref={ref} {...props} />
  ));
};

// react-icons 스타일 매핑
export const FaUsers = createIconWrapper(UsersIcon);
export const FaClock = createIconWrapper(ClockIcon);
export const FaTrophy = createIconWrapper(TrophyIcon);
export const FaChevronUp = createIconWrapper(ChevronUpIcon);
export const FaChevronDown = createIconWrapper(ChevronDownIcon);
export const FaCalendarAlt = createIconWrapper(CalendarDaysIcon);
export const FaTable = createIconWrapper(TableCellsIcon);
export const FaPlus = createIconWrapper(PlusIcon);
export const FaCog = createIconWrapper(Cog6ToothIcon);
export const FaTrash = createIconWrapper(TrashIcon);
export const FaExclamationTriangle = createIconWrapper(ExclamationTriangleIcon);
export const FaCheckCircle = createIconWrapper(CheckCircleIcon);
export const FaInfoCircle = createIconWrapper(InformationCircleIcon);
export const FaInfo = createIconWrapper(InformationCircleIcon);
export const FaEye = createIconWrapper(EyeIcon);
export const FaEyeSlash = createIconWrapper(EyeSlashIcon);
export const FaUserPlus = createIconWrapper(UserPlusIcon);
export const FaThList = createIconWrapper(QueueListIcon);
export const FaPlusCircle = createIconWrapper(PlusCircleIcon);
export const FaTimes = createIconWrapper(XMarkIcon);
export const FaFileExport = createIconWrapper(ArrowDownTrayIcon);
export const FaMoneyBillWave = createIconWrapper(BanknotesIcon);
export const FaEllipsisV = createIconWrapper(EllipsisVerticalIcon);
export const FaSearch = createIconWrapper(MagnifyingGlassIcon);
export const FaFilter = createIconWrapper(FunnelIcon);
export const FaPhone = createIconWrapper(PhoneIcon);
export const FaEnvelope = createIconWrapper(EnvelopeIcon);
export const FaIdCard = createIconWrapper(IdentificationIcon);
export const FaStar = createIconWrapper(StarIcon);
export const FaUser = createIconWrapper(UserIcon);
export const FaTachometerAlt = createIconWrapper(PresentationChartLineIcon);
export const FaUserCircle = createIconWrapper(UserCircleIcon);
export const FaFileInvoice = createIconWrapper(DocumentTextIcon);
export const FaClipboardList = createIconWrapper(ClipboardDocumentListIcon);
export const FaQrcode = createIconWrapper(QrCodeIcon);
export const FaBars = createIconWrapper(Bars3Icon);
export const FaSignOutAlt = createIconWrapper(ArrowRightOnRectangleIcon);
export const FaUserCheck = createIconWrapper(CheckBadgeIcon);
export const FaSync = createIconWrapper(ArrowPathIcon);
export const FaCamera = createIconWrapper(CameraIcon);
export const FaList = createIconWrapper(ListBulletIcon);
export const FaMapMarkerAlt = createIconWrapper(MapPinIcon);
export const FaTimesCircle = createIconWrapper(XCircleIcon);
export const FaHourglassHalf = createIconWrapper(HourglassIcon);
export const FaCalendarCheck = createIconWrapper(CalendarDaysIcon);  // 캘린더 체크 아이콘 대체

// Solid 버전 (필요한 경우)
export const FaCheckCircleSolid = createIconWrapper(CheckCircleIconSolid);
export const FaExclamationTriangleSolid = createIconWrapper(ExclamationTriangleIconSolid);

// IconType 타입 대체 - heroicons와 호환되도록
export type IconType = React.ComponentType<any>;