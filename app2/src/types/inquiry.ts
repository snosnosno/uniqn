/**
 * 문의(Inquiry) 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 문의 카테고리
 */
export type InquiryCategory =
  | 'general'   // 일반 문의
  | 'technical' // 기술 문의
  | 'payment'   // 결제 문의
  | 'account'   // 계정 문의
  | 'report'    // 신고
  | 'other';    // 기타

/**
 * 문의 상태
 */
export type InquiryStatus =
  | 'open'        // 열림
  | 'in_progress' // 처리중
  | 'closed';     // 완료

/**
 * 문의 인터페이스
 */
export interface Inquiry {
  /** 문의 ID */
  id: string;

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

  /** 신고 메타데이터 (카테고리가 'report'인 경우) */
  reportMetadata?: {
    type: string;        // 신고 유형
    reporterType: string; // 신고자 유형
    targetId: string;     // 신고 대상자 ID
    targetName: string;   // 신고 대상자 이름
    eventId: string;      // 이벤트 ID
    eventTitle: string;   // 이벤트 제목
    date: string;         // 날짜
  };

  /** 관리자 응답 (선택사항) */
  response?: string;

  /** 응답자 ID (선택사항) */
  responderId?: string;

  /** 응답자 이름 (선택사항) */
  responderName?: string;

  /** 생성일시 */
  createdAt: Timestamp;

  /** 수정일시 */
  updatedAt: Timestamp;

  /** 응답일시 (선택사항) */
  respondedAt?: Timestamp;
}

/**
 * 문의 생성 입력 타입
 */
export interface InquiryCreateInput {
  userId: string;
  userEmail: string;
  userName: string;
  category: InquiryCategory;
  subject: string;
  message: string;
}

/**
 * 문의 업데이트 입력 타입
 */
export interface InquiryUpdateInput {
  status?: InquiryStatus;
  response?: string;
  responderId?: string;
  responderName?: string;
}

/**
 * 문의 카테고리별 표시 정보
 */
export interface InquiryCategoryInfo {
  key: InquiryCategory;
  labelKey: string;
  descriptionKey: string;
  icon: string;
}

/**
 * 문의 카테고리별 정보 상수
 */
export const INQUIRY_CATEGORIES: InquiryCategoryInfo[] = [
  {
    key: 'general',
    labelKey: 'inquiry.categories.general.label',
    descriptionKey: 'inquiry.categories.general.description',
    icon: '💬'
  },
  {
    key: 'technical',
    labelKey: 'inquiry.categories.technical.label',
    descriptionKey: 'inquiry.categories.technical.description',
    icon: '🔧'
  },
  {
    key: 'payment',
    labelKey: 'inquiry.categories.payment.label',
    descriptionKey: 'inquiry.categories.payment.description',
    icon: '💳'
  },
  {
    key: 'account',
    labelKey: 'inquiry.categories.account.label',
    descriptionKey: 'inquiry.categories.account.description',
    icon: '👤'
  },
  {
    key: 'report',
    labelKey: 'inquiry.categories.report.label',
    descriptionKey: 'inquiry.categories.report.description',
    icon: '🚨'
  },
  {
    key: 'other',
    labelKey: 'common.other',
    descriptionKey: 'inquiry.categories.other.description',
    icon: '❓'
  }
];

/**
 * 문의 상태별 스타일 정보
 */
export const INQUIRY_STATUS_STYLES: Record<InquiryStatus, {
  color: string;
  bgColor: string;
  labelKey: string;
}> = {
  open: {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    labelKey: 'inquiry.status.open'
  },
  in_progress: {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    labelKey: 'inquiry.status.in_progress'
  },
  closed: {
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    labelKey: 'inquiry.status.closed'
  }
};

/**
 * FAQ 항목 인터페이스
 */
export interface FAQItem {
  id: string;
  category: InquiryCategory;
  questionKey: string;
  answerKey: string;
  order: number;
  isActive: boolean;
}

/**
 * FAQ 데이터 상수
 */
export const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'general',
    questionKey: 'faq.general.q1.question',
    answerKey: 'faq.general.q1.answer',
    order: 1,
    isActive: true
  },
  {
    id: 'faq-2',
    category: 'general',
    questionKey: 'faq.general.q2.question',
    answerKey: 'faq.general.q2.answer',
    order: 2,
    isActive: true
  },
  {
    id: 'faq-3',
    category: 'account',
    questionKey: 'faq.account.q1.question',
    answerKey: 'faq.account.q1.answer',
    order: 1,
    isActive: true
  },
  {
    id: 'faq-4',
    category: 'payment',
    questionKey: 'faq.payment.q1.question',
    answerKey: 'faq.payment.q1.answer',
    order: 1,
    isActive: true
  },
  {
    id: 'faq-5',
    category: 'technical',
    questionKey: 'faq.technical.q1.question',
    answerKey: 'faq.technical.q1.answer',
    order: 1,
    isActive: true
  }
];