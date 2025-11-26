import { Timestamp } from 'firebase/firestore';

/**
 * 구독 플랜 타입
 */
export type SubscriptionPlanType = 'free' | 'standard' | 'pro';

/**
 * 구독 상태
 */
export type SubscriptionStatus =
  | 'active' // 활성
  | 'cancelled' // 취소됨
  | 'expired' // 만료됨
  | 'pending'; // 결제 대기

/**
 * 구독 플랜 정보
 */
export interface SubscriptionPlan {
  type: SubscriptionPlanType;
  name: string;
  nameEn: string;
  description: string;
  price: number; // 월 가격 (원)
  monthlyChips: number; // 매월 지급 칩 개수
  features: string[]; // 기능 목록
  accessRights: {
    mySchedule: boolean; // 내 스케줄 접근
    tournamentManagement: boolean; // 토너먼트 관리
  };
}

/**
 * 사용자 구독 정보
 */
export interface UserSubscription {
  id: string;
  userId: string;
  planType: SubscriptionPlanType;
  status: SubscriptionStatus;

  // 구독 기간
  startedAt: Timestamp;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;

  // 결제 정보
  billingCycleAnchor: Timestamp; // 결제 주기 기준일
  nextBillingDate?: Timestamp; // 다음 결제일

  // 취소 정보
  cancelledAt?: Timestamp;
  cancelReason?: string;

  // 갱신 정보
  autoRenew: boolean;

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 구독 플랜 설정 (중앙 관리)
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanType, SubscriptionPlan> = {
  free: {
    type: 'free',
    name: '프리 플랜',
    nameEn: 'Free Plan',
    description: '무료 체험 플랜',
    price: 0,
    monthlyChips: 5,
    features: ['파란칩 5개', '내 스케줄만 접근'],
    accessRights: {
      mySchedule: true,
      tournamentManagement: false,
    },
  },
  standard: {
    type: 'standard',
    name: '일반 플랜',
    nameEn: 'Standard Plan',
    description: '기본 기능 제공',
    price: 5500,
    monthlyChips: 30,
    features: ['파란칩 30개', '내 스케줄 무제한'],
    accessRights: {
      mySchedule: true,
      tournamentManagement: false,
    },
  },
  pro: {
    type: 'pro',
    name: '프로 플랜',
    nameEn: 'Pro Plan',
    description: '모든 기능 제공',
    price: 14900,
    monthlyChips: 80,
    features: ['파란칩 80개', '토너먼트 관리', '모든 기능 접근'],
    accessRights: {
      mySchedule: true,
      tournamentManagement: true,
    },
  },
};

/**
 * 구독 변경 이력
 */
export interface SubscriptionHistory {
  id: string;
  userId: string;
  subscriptionId: string;
  previousPlan: SubscriptionPlanType;
  newPlan: SubscriptionPlanType;
  changeReason: string;
  changedAt: Timestamp;
}
