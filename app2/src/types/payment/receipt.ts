import { Timestamp } from 'firebase/firestore';

/**
 * 영수증 타입
 */
export type ReceiptType =
  | 'payment'       // 일반 결제
  | 'subscription'  // 구독 결제
  | 'refund';       // 환불

/**
 * 영수증 정보
 */
export interface Receipt {
  id: string;
  userId: string;
  type: ReceiptType;

  // 거래 정보
  orderId: string;
  paymentKey?: string;
  amount: number;

  // 상품 정보
  orderName: string;
  quantity: number;

  // 칩 정보 (결제/구독인 경우)
  redChips?: number;
  blueChips?: number;

  // 결제 정보
  method?: string;          // 결제수단 (카드, 가상계좌 등)
  cardNumber?: string;      // 카드번호 (마스킹)
  approvedAt?: Timestamp;   // 승인일시

  // 환불 정보 (환불인 경우)
  refundReason?: string;
  refundedAt?: Timestamp;

  // 사업자 정보
  businessName: string;
  businessNumber: string;
  businessAddress: string;

  // 고객 정보
  customerName: string;
  customerEmail: string;
  customerPhone?: string;

  // 생성 정보
  createdAt: Timestamp;

  // 이메일 발송 여부
  emailSent: boolean;
  emailSentAt?: Timestamp;
}

/**
 * 영수증 생성 요청
 */
export interface ReceiptGenerationRequest {
  userId: string;
  type: ReceiptType;
  orderId: string;
  paymentKey?: string;
  sendEmail?: boolean;  // 이메일 발송 여부 (기본: true)
}

/**
 * 영수증 다운로드 옵션
 */
export interface ReceiptDownloadOptions {
  format: 'pdf' | 'html';
  includeDetails: boolean;  // 상세 정보 포함 여부
}
