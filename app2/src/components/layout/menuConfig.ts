import {
  FaUsers,
  FaTable,
  FaClock,
  FaTrophy,
  FaUserCircle,
  FaFileInvoice,
  FaClipboardList,
  FaCalendarAlt,
  FaQuestionCircle,
  FaBell,
  FaCoins,
  FaCreditCard,
  FaHistory,
  FaStar,
  FaCog,
  FaExclamationTriangle,
  FaEnvelope,
} from '../Icons/ReactIconsReplacement';

export interface MenuItem {
  to: string;
  labelKey: string;
  labelDefault: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export interface MenuGroup {
  id: string;
  type: 'item' | 'dropdown';
  labelKey?: string;
  labelDefault?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  items?: MenuItem[];
  to?: string;
  roles?: ('admin' | 'manager' | 'staff' | 'user')[];
  requireAuth?: boolean;
}

// 기본 메뉴 (모든 사용자)
export const BASE_MENU: MenuGroup[] = [
  {
    id: 'profile',
    type: 'item',
    to: '/app/profile',
    labelKey: 'nav.myProfile',
    labelDefault: 'My Profile',
    Icon: FaUserCircle,
  },
  {
    id: 'my-schedule',
    type: 'item',
    to: '/app/my-schedule',
    labelKey: 'nav.mySchedule',
    labelDefault: '내 스케줄',
    Icon: FaCalendarAlt,
  },
  {
    id: 'jobs',
    type: 'item',
    to: '/app/jobs',
    labelKey: 'nav.jobBoard',
    labelDefault: 'Job Board',
    Icon: FaClipboardList,
  },
];

// 고객 센터 메뉴
export const CUSTOMER_CENTER_MENU: MenuGroup = {
  id: 'customer-center',
  type: 'dropdown',
  labelKey: 'nav.customerCenter',
  labelDefault: '고객 센터',
  Icon: FaQuestionCircle,
  items: [
    {
      to: '/app/announcements',
      labelKey: 'nav.announcements',
      labelDefault: '공지사항',
      Icon: FaBell,
    },
    {
      to: '/app/support',
      labelKey: 'nav.support',
      labelDefault: '고객지원',
      Icon: FaQuestionCircle,
    },
  ],
};

// 결제 및 칩 관리 메뉴
export const PAYMENT_MENU: MenuGroup = {
  id: 'payment',
  type: 'dropdown',
  labelKey: 'nav.paymentAndChip',
  labelDefault: '결제 및 칩 관리',
  Icon: FaCreditCard,
  items: [
    {
      to: '/app/chip/recharge',
      labelKey: 'nav.chipRecharge',
      labelDefault: '칩 충전',
      Icon: FaCoins,
    },
    {
      to: '/app/payment/history',
      labelKey: 'nav.paymentHistory',
      labelDefault: '결제 내역',
      Icon: FaCreditCard,
    },
    {
      to: '/app/chip/history',
      labelKey: 'nav.chipHistory',
      labelDefault: '칩 사용 내역',
      Icon: FaHistory,
    },
    {
      to: '/app/subscription',
      labelKey: 'nav.subscription',
      labelDefault: '구독 플랜',
      Icon: FaStar,
    },
  ],
};

// 인증된 사용자 메뉴
export const AUTH_MENU: MenuGroup = {
  id: 'job-postings',
  type: 'item',
  to: '/app/admin/job-postings',
  labelKey: 'nav.managePostings',
  labelDefault: 'Manage Postings',
  Icon: FaFileInvoice,
  requireAuth: true,
};

// 토너먼트 관리 기본 아이템
export const TOURNAMENT_BASE_ITEMS: MenuItem[] = [
  {
    to: '/app/tournaments',
    labelKey: 'nav.tournaments',
    labelDefault: '토너먼트',
    Icon: FaTrophy,
  },
  {
    to: '/app/participants',
    labelKey: 'nav.participantManagement',
    labelDefault: '참가자 관리',
    Icon: FaUsers,
  },
  {
    to: '/app/tables',
    labelKey: 'common.table',
    labelDefault: '테이블',
    Icon: FaTable,
  },
];

// Admin/Manager 전용 토너먼트 아이템
export const TOURNAMENT_ADMIN_ITEMS: MenuItem[] = [
  {
    to: '/app/admin/shift-schedule',
    labelKey: 'nav.shiftSchedule',
    labelDefault: 'Shift Schedule',
    Icon: FaClock,
  },
  {
    to: '/app/admin/prizes',
    labelKey: 'nav.prizes',
    labelDefault: 'Prizes',
    Icon: FaTrophy,
  },
];

// Admin 전용 메뉴
export const ADMIN_MENU: MenuGroup[] = [
  {
    id: 'user-management',
    type: 'item',
    to: '/app/admin/user-management',
    labelKey: 'nav.userManagement',
    labelDefault: 'User Management',
    Icon: FaUsers,
    roles: ['admin'],
  },
  {
    id: 'inquiries',
    type: 'item',
    to: '/app/admin/inquiries',
    labelKey: 'nav.inquiryManagement',
    labelDefault: '문의 관리',
    Icon: FaEnvelope,
    roles: ['admin'],
  },
  {
    id: 'job-posting-approvals',
    type: 'item',
    to: '/app/admin/job-posting-approvals',
    labelKey: 'nav.tournamentApprovals',
    labelDefault: '대회 공고 승인',
    Icon: FaTrophy,
    roles: ['admin'],
  },
];

// Admin 결제 시스템 관리
export const ADMIN_PAYMENT_MENU: MenuGroup = {
  id: 'admin-payment',
  type: 'dropdown',
  labelKey: 'nav.paymentSystemManagement',
  labelDefault: '결제 시스템 관리',
  Icon: FaCog,
  roles: ['admin'],
  items: [
    {
      to: '/app/admin/chip-management',
      labelKey: 'nav.chipManagement',
      labelDefault: '칩 관리',
      Icon: FaCog,
    },
    {
      to: '/app/admin/refund-blacklist',
      labelKey: 'nav.refundBlacklist',
      labelDefault: '환불 블랙리스트',
      Icon: FaExclamationTriangle,
    },
  ],
};
