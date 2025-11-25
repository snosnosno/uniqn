import { Timestamp } from 'firebase/firestore';

/**
 * 칩 타입 (파란칩 vs 빨간칩)
 */
export type ChipType = 'blue' | 'red';

/**
 * 칩 트랜잭션 타입
 */
export type ChipTransactionType =
  | 'grant'           // 지급 (구독 플랜)
  | 'purchase'        // 구매 (충전)
  | 'use'             // 사용 (지원 신청, 고정 공고)
  | 'expire'          // 소멸
  | 'refund';         // 환불

/**
 * 파란칩 (구독 칩)
 * - 구독 플랜 가입 시 매월 지급
 * - 매월 말일 24시 자동 소멸
 */
export interface BlueChip {
  type: 'blue';
  amount: number;
  grantedAt: Timestamp;
  expiresAt: Timestamp;        // 해당 월 말일 24시
  planType: 'free' | 'standard' | 'pro';
  isExpired: boolean;
}

/**
 * 빨간칩 (충전 칩)
 * - 사용자가 별도로 구매
 * - 구매일로부터 1년 후 만료
 */
export interface RedChip {
  type: 'red';
  amount: number;
  purchasedAt: Timestamp;
  expiresAt: Timestamp;        // 구매일 + 1년
  packageId: string;           // 충전 패키지 ID
  transactionId: string;       // 결제 트랜잭션 ID
  isExpired: boolean;
}

/**
 * 사용자 칩 잔액
 */
export interface UserChipBalance {
  userId: string;
  blueChips: number;           // 파란칩 잔액
  redChips: number;            // 빨간칩 잔액
  totalChips: number;          // 전체 칩 잔액
  lastUpdatedAt: Timestamp;
}

/**
 * 칩 잔액 (Date 타입 버전 - 프론트엔드용)
 */
export interface ChipBalance {
  userId: string;
  blueChips: number;
  redChips: number;
  totalChips: number;
  lastUpdated: Date;
}

/**
 * 칩 트랜잭션 기록 (Firestore 저장용)
 */
export interface ChipTransaction {
  id: string;
  userId: string;
  type: ChipTransactionType;
  chipType: ChipType;
  amount: number;              // 양수: 증가, 음수: 감소
  balanceBefore: number;       // 거래 전 잔액
  balanceAfter: number;        // 거래 후 잔액
  description: string;         // 트랜잭션 설명
  metadata?: {
    postingId?: string;        // 공고 ID (use 타입일 때)
    packageId?: string;        // 패키지 ID (purchase 타입일 때)
    transactionId?: string;    // 결제 ID (purchase 타입일 때)
    refundId?: string;         // 환불 ID (refund 타입일 때)
  };
  createdAt: Timestamp;
}

/**
 * 칩 트랜잭션 기록 (Date 타입 버전 - 프론트엔드용)
 */
export interface ChipTransactionView extends Omit<ChipTransaction, 'createdAt'> {
  createdAt: Date;
}

/**
 * 칩 만료 알림 단계
 */
export type ChipExpiryNotificationStage =
  | 'days_30'         // 30일 전
  | 'days_7'          // 7일 전
  | 'days_3'          // 3일 전
  | 'day_current';    // 당일

/**
 * 칩 만료 알림 기록
 */
export interface ChipExpiryNotification {
  id: string;
  userId: string;
  chipType: ChipType;
  amount: number;
  expiresAt: Timestamp;
  stage: ChipExpiryNotificationStage;
  sentAt: Timestamp;
  isRead: boolean;
}

/**
 * 칩 사용 내역 (지원 신청, 고정 공고 등)
 */
export interface ChipUsage {
  id: string;
  userId: string;
  chipType: ChipType;         // 사용된 칩 타입 (우선순위: 파란칩 먼저)
  amount: number;
  usageType: 'application' | 'fixed_posting' | 'urgent_posting';
  relatedId: string;          // 관련 문서 ID (postingId, applicationId 등)
  usedAt: Timestamp;
}
