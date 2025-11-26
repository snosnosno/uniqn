import { Timestamp } from 'firebase/firestore';

/**
 * 결제 방법
 */
export type PaymentMethod =
  | 'card' // 신용/체크카드
  | 'virtual_account' // 가상계좌
  | 'transfer' // 계좌이체
  | 'mobile' // 휴대폰 결제
  | 'kakao' // 카카오페이
  | 'naver' // 네이버페이
  | 'toss'; // 토스페이

/**
 * 결제 상태
 */
export type PaymentStatus =
  | 'pending' // 결제 대기
  | 'in_progress' // 결제 진행 중
  | 'completed' // 결제 완료
  | 'failed' // 결제 실패
  | 'cancelled' // 결제 취소
  | 'refunded' // 환불 완료
  | 'partial_refund'; // 부분 환불

/**
 * 결제 트랜잭션
 */
export interface PaymentTransaction {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;

  // 결제 정보
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amount: number; // 결제 금액 (원)

  // 결제 게이트웨이 정보
  paymentKey?: string; // Toss Payments 결제 키
  orderId: string; // 주문 ID
  orderName: string; // 주문명

  // 구매 항목
  itemType: 'chip_package' | 'subscription';
  itemId: string; // 패키지 ID 또는 구독 플랜 타입
  itemName: string;
  chipAmount?: number; // 칩 개수 (chip_package일 때)

  // 결제 승인 정보
  approvedAt?: Timestamp;
  receipt?: {
    url: string;
    issuer: string;
  };

  // 실패/취소 정보
  failureCode?: string;
  failureMessage?: string;
  cancelledAt?: Timestamp;
  cancelReason?: string;

  // 환불 정보
  refundedAt?: Timestamp;
  refundAmount?: number;
  refundReason?: string;

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 결제 검증 결과
 */
export interface PaymentVerification {
  isValid: boolean;
  orderId: string;
  amount: number;
  paymentKey?: string;
  errorMessage?: string;
}
