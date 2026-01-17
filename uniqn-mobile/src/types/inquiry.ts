/**
 * UNIQN Mobile - 문의(Inquiry) 타입 정의
 *
 * @description 고객센터 문의 및 FAQ 관련 타입
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument } from './common';

// ============================================================================
// 카테고리 및 상태
// ============================================================================

/**
 * 문의 카테고리
 */
export type InquiryCategory =
  | 'general' // 일반 문의
  | 'technical' // 기술 문의
  | 'payment' // 결제 문의
  | 'account' // 계정 문의
  | 'report' // 신고
  | 'other'; // 기타

/**
 * 문의 상태
 */
export type InquiryStatus =
  | 'open' // 접수됨
  | 'in_progress' // 처리중
  | 'closed'; // 답변 완료

// ============================================================================
// 문의 인터페이스
// ============================================================================

/**
 * 문의 인터페이스
 */
export interface Inquiry extends FirebaseDocument {
  /** 사용자 ID */
  userId: string;

  /** 사용자 이메일 */
  userEmail: string;

  /** 사용자 이름 */
  userName: string;

  /** 문의 카테고리 */
  category: InquiryCategory;

  /** 제목 */
  subject: string;

  /** 내용 */
  message: string;

  /** 상태 */
  status: InquiryStatus;

  /** 첨부파일 (선택) */
  attachments?: InquiryAttachment[];

  /** 관리자 응답 (선택) */
  response?: string;

  /** 응답자 ID (선택) */
  responderId?: string;

  /** 응답자 이름 (선택) */
  responderName?: string;

  /** 응답일시 (선택) */
  respondedAt?: Timestamp;
}

/**
 * 첨부파일 타입
 */
export interface InquiryAttachment {
  /** 파일 이름 */
  name: string;
  /** 다운로드 URL */
  url: string;
  /** MIME 타입 */
  type: string;
  /** 파일 크기 (bytes) */
  size?: number;
}

// ============================================================================
// 입력 타입
// ============================================================================

/**
 * 문의 생성 입력 (사용자)
 */
export interface CreateInquiryInput {
  category: InquiryCategory;
  subject: string;
  message: string;
  attachments?: InquiryAttachment[];
}

/**
 * 문의 응답 입력 (관리자)
 */
export interface RespondInquiryInput {
  response: string;
  status?: InquiryStatus; // 'in_progress' | 'closed'
}

/**
 * 문의 필터
 */
export interface InquiryFilters {
  status?: InquiryStatus | 'all';
  category?: InquiryCategory | 'all';
}

// ============================================================================
// FAQ 타입
// ============================================================================

/**
 * FAQ 항목
 */
export interface FAQItem {
  id: string;
  category: InquiryCategory;
  question: string;
  answer: string;
  order: number;
  isActive?: boolean;
}

// ============================================================================
// 상수 및 라벨
// ============================================================================

/**
 * 카테고리 정보
 */
export interface InquiryCategoryInfo {
  key: InquiryCategory;
  label: string;
  description: string;
}

/**
 * 카테고리 목록
 */
export const INQUIRY_CATEGORIES: InquiryCategoryInfo[] = [
  { key: 'general', label: '일반 문의', description: '서비스 이용 관련 문의' },
  { key: 'technical', label: '기술 문의', description: '앱 오류, 버그 신고' },
  { key: 'payment', label: '결제 문의', description: '결제, 환불 관련' },
  { key: 'account', label: '계정 문의', description: '로그인, 회원정보' },
  { key: 'report', label: '신고', description: '부적절한 콘텐츠/사용자 신고' },
  { key: 'other', label: '기타', description: '기타 문의사항' },
];

/**
 * 카테고리 라벨 맵
 */
export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  general: '일반 문의',
  technical: '기술 문의',
  payment: '결제 문의',
  account: '계정 문의',
  report: '신고',
  other: '기타',
};

/**
 * 상태 스타일 정보
 */
export const INQUIRY_STATUS_CONFIG: Record<
  InquiryStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  open: {
    label: '접수됨',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  in_progress: {
    label: '처리중',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  closed: {
    label: '답변 완료',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
};

/**
 * 상태 라벨 맵
 */
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  open: '접수됨',
  in_progress: '처리중',
  closed: '답변 완료',
};

// ============================================================================
// FAQ 데이터 (하드코딩)
// ============================================================================

/**
 * FAQ 데이터
 */
export const FAQ_DATA: FAQItem[] = [
  // 일반 문의
  {
    id: 'faq-general-1',
    category: 'general',
    question: 'UNIQN은 어떤 서비스인가요?',
    answer:
      'UNIQN은 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼입니다. 구인자와 스태프를 연결하고, 스케줄 관리, 출퇴근 관리, 정산 등의 기능을 제공합니다.',
    order: 1,
  },
  {
    id: 'faq-general-2',
    category: 'general',
    question: '앱 사용료가 있나요?',
    answer: '기본 기능은 무료로 이용 가능합니다. 일부 프리미엄 기능은 추후 유료로 제공될 수 있습니다.',
    order: 2,
  },
  // 계정 문의
  {
    id: 'faq-account-1',
    category: 'account',
    question: '비밀번호를 잊어버렸어요.',
    answer:
      '로그인 화면에서 "비밀번호 찾기"를 탭하세요. 가입 시 사용한 이메일로 비밀번호 재설정 링크가 발송됩니다.',
    order: 1,
  },
  {
    id: 'faq-account-2',
    category: 'account',
    question: '회원 탈퇴는 어떻게 하나요?',
    answer:
      '프로필 > 설정 > 계정 삭제에서 탈퇴할 수 있습니다. 탈퇴 시 모든 데이터가 삭제되며 복구가 불가능합니다.',
    order: 2,
  },
  // 결제 문의
  {
    id: 'faq-payment-1',
    category: 'payment',
    question: '정산은 언제 받을 수 있나요?',
    answer:
      '정산은 근무 완료 후 구인자가 정산 처리를 진행합니다. 정산 시기는 구인자별로 다를 수 있으며, UNIQN은 정산 금액 계산을 도와드릴 뿐 실제 정산에는 관여하지 않습니다.',
    order: 1,
  },
  // 기술 문의
  {
    id: 'faq-technical-1',
    category: 'technical',
    question: 'QR 코드가 인식되지 않아요.',
    answer:
      '카메라 권한이 허용되어 있는지 확인해주세요. 화면 밝기를 높이고, QR 코드가 화면 중앙에 오도록 위치를 조정해보세요.',
    order: 1,
  },
  {
    id: 'faq-technical-2',
    category: 'technical',
    question: '알림이 오지 않아요.',
    answer:
      '설정 > 알림 설정에서 알림이 켜져 있는지 확인해주세요. 또한 기기의 알림 설정에서 UNIQN 앱의 알림이 허용되어 있어야 합니다.',
    order: 2,
  },
  // 기타
  {
    id: 'faq-other-1',
    category: 'other',
    question: '문의에 대한 답변은 얼마나 걸리나요?',
    answer: '문의 접수 후 영업일 기준 1-2일 내에 답변드립니다. 주말 및 공휴일에는 답변이 지연될 수 있습니다.',
    order: 1,
  },
];

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 카테고리별 FAQ 필터링
 */
export function filterFAQByCategory(
  items: FAQItem[],
  category: InquiryCategory | 'all'
): FAQItem[] {
  if (category === 'all') {
    return items.filter((item) => item.isActive !== false);
  }
  return items.filter((item) => item.category === category && item.isActive !== false);
}

/**
 * 카테고리 정보 조회
 */
export function getCategoryInfo(category: InquiryCategory): InquiryCategoryInfo | undefined {
  return INQUIRY_CATEGORIES.find((c) => c.key === category);
}
