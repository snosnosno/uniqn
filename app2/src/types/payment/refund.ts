import { Timestamp } from 'firebase/firestore';

/**
 * 환불 상태
 */
export type RefundStatus =
  | 'pending'         // 환불 요청 대기
  | 'approved'        // 승인됨
  | 'rejected'        // 거부됨
  | 'processing'      // 처리 중
  | 'completed';      // 완료

/**
 * 환불 사유
 */
export type RefundReason =
  | 'unused'          // 미사용
  | 'partial_use'     // 부분 사용
  | 'dissatisfaction' // 서비스 불만
  | 'error'           // 오류
  | 'other';          // 기타

/**
 * 환불 요청
 */
export interface RefundRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;

  // 원 거래 정보
  transactionId: string;      // 원 결제 트랜잭션 ID
  packageId: string;          // 충전 패키지 ID
  purchasedAmount: number;    // 구매 금액 (원)
  purchasedChips: number;     // 구매 칩 개수

  // 환불 정보
  status: RefundStatus;
  reason: RefundReason;
  reasonDetail: string;       // 상세 사유

  // 사용 내역
  usedChips: number;          // 사용한 칩
  remainingChips: number;     // 남은 칩

  // 환불 금액 계산
  refundAmount: number;       // 환불 금액
  refundChips: number;        // 환불되는 칩
  feeAmount: number;          // 수수료 (20%)
  feePercentage: number;      // 수수료율

  // 환불 가능 여부 검증
  isEligible: boolean;
  ineligibleReason?: string;

  // 환불 제한 체크
  monthlyRefundCount: number; // 이번 달 환불 횟수
  yearlyRefundCount: number;  // 올해 환불 횟수

  // 처리 정보
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: string;       // 처리자 ID
  completedAt?: Timestamp;

  // 거부 정보
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 환불 정책
 */
export interface RefundPolicy {
  // 환불 가능 기간
  eligibleDays: number;       // 구매 후 7일 이내

  // 수수료
  fullRefundFee: number;      // 미사용 시 0%
  partialRefundFee: number;   // 부분 사용 시 20%

  // 환불 횟수 제한
  monthlyLimit: number;       // 월 1회
  yearlyLimit: number;        // 연 3회

  // 블랙리스트 기준
  blacklistThreshold: number; // 환불 3회 초과 시
}

/**
 * 환불 정책 상수
 */
export const REFUND_POLICY: RefundPolicy = {
  eligibleDays: 7,
  fullRefundFee: 0,           // 0%
  partialRefundFee: 0.2,      // 20%
  monthlyLimit: 1,
  yearlyLimit: 3,
  blacklistThreshold: 3,
};

/**
 * 환불 가능 여부 검증 결과
 */
export interface RefundEligibility {
  isEligible: boolean;
  reason?: string;
  remainingMonthlyRefunds: number;
  remainingYearlyRefunds: number;
  isBlacklisted: boolean;
}

/**
 * 환불 블랙리스트
 */
export interface RefundBlacklist {
  id: string;
  userId: string;
  userEmail: string;
  reason: string;
  refundCount: number;
  blacklistedAt: Timestamp;
  isPermanent: boolean;       // 영구 환불 불가
}
