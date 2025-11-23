/**
 * 토스페이먼츠 결제 시스템 타입 정의
 * 공식 문서: https://docs.tosspayments.com/
 */

/**
 * 결제 방법
 */
export type TossPaymentMethod = '카드' | '가상계좌' | '간편결제' | '휴대폰' | '계좌이체' | '문화상품권' | '도서문화상품권' | '게임문화상품권';

/**
 * 결제 상태
 */
export type TossPaymentStatus =
  | 'READY'           // 결제 준비
  | 'IN_PROGRESS'     // 결제 진행 중
  | 'WAITING_FOR_DEPOSIT'  // 가상계좌 입금 대기
  | 'DONE'            // 결제 완료
  | 'CANCELED'        // 결제 취소
  | 'PARTIAL_CANCELED'  // 부분 취소
  | 'ABORTED'         // 결제 승인 실패
  | 'EXPIRED';        // 결제 만료

/**
 * 토스페이먼츠 결제 요청 파라미터
 */
export interface TossPaymentRequest {
  amount: number;                    // 결제 금액
  orderId: string;                   // 주문 ID (고유값, 영문/숫자/-_만 사용, 6-64자)
  orderName: string;                 // 주문명 (최대 100자)
  customerName?: string;             // 구매자 이름
  customerEmail?: string;            // 구매자 이메일
  customerMobilePhone?: string;      // 구매자 휴대폰 번호 (01012341234 형식)
  successUrl: string;                // 결제 성공 시 리다이렉트 URL
  failUrl: string;                   // 결제 실패 시 리다이렉트 URL
  flowMode?: 'DEFAULT' | 'DIRECT';   // 결제 흐름 (기본값: DEFAULT)
  easyPay?: string;                  // 간편결제 (카카오페이, 토스페이 등)
  maxCardInstallmentPlan?: number;   // 최대 할부 개월 수
  useEscrow?: boolean;               // 에스크로 사용 여부
  cultureExpense?: boolean;          // 문화비 소득공제 여부
  taxFreeAmount?: number;            // 면세 금액
}

/**
 * 토스페이먼츠 결제 성공 응답 (쿼리 파라미터)
 */
export interface TossPaymentSuccessQuery {
  paymentKey: string;                // 결제 키
  orderId: string;                   // 주문 ID
  amount: string;                    // 결제 금액
}

/**
 * 토스페이먼츠 결제 실패 응답 (쿼리 파라미터)
 */
export interface TossPaymentFailQuery {
  code: string;                      // 에러 코드
  message: string;                   // 에러 메시지
  orderId: string;                   // 주문 ID
}

/**
 * 토스페이먼츠 결제 승인 요청
 */
export interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

/**
 * 토스페이먼츠 결제 승인 응답 (Payment 객체)
 */
export interface TossPaymentConfirmResponse {
  version: string;                   // API 버전
  paymentKey: string;                // 결제 키
  type: string;                      // 결제 타입 (NORMAL, BILLING, BRANDPAY)
  orderId: string;                   // 주문 ID
  orderName: string;                 // 주문명
  mId: string;                       // 가맹점 ID
  currency: string;                  // 통화 (KRW)
  method: TossPaymentMethod;         // 결제 방법
  totalAmount: number;               // 총 결제 금액
  balanceAmount: number;             // 취소 가능 금액
  status: TossPaymentStatus;         // 결제 상태
  requestedAt: string;               // 결제 요청 시각 (ISO 8601)
  approvedAt: string;                // 결제 승인 시각 (ISO 8601)
  useEscrow: boolean;                // 에스크로 사용 여부
  lastTransactionKey: string | null; // 마지막 거래 키
  suppliedAmount: number;            // 공급가액
  vat: number;                       // 부가세
  cultureExpense: boolean;           // 문화비 소득공제 여부
  taxFreeAmount: number;             // 면세 금액
  taxExemptionAmount: number;        // 과세 제외 금액
  cancels: TossPaymentCancel[] | null;  // 취소 내역
  isPartialCancelable: boolean;      // 부분 취소 가능 여부
  card: TossPaymentCard | null;      // 카드 정보
  virtualAccount: TossVirtualAccount | null;  // 가상계좌 정보
  transfer: TossTransfer | null;     // 계좌이체 정보
  mobilePhone: TossMobilePhone | null;  // 휴대폰 결제 정보
  giftCertificate: TossGiftCertificate | null;  // 상품권 정보
  easyPay: TossEasyPay | null;       // 간편결제 정보
  country: string;                   // 결제 국가
  failure: TossPaymentFailure | null;  // 실패 정보
  cashReceipt: TossCashReceipt | null;  // 현금영수증 정보
  cashReceipts: TossCashReceipt[] | null;  // 현금영수증 발급/취소 내역
  discount: TossDiscount | null;     // 할인 정보
  secret: string | null;             // 가상계좌 웹훅 검증 값
}

/**
 * 카드 결제 정보
 */
export interface TossPaymentCard {
  amount: number;                    // 카드 결제 금액
  issuerCode: string;                // 카드 발급사 코드
  acquirerCode?: string;             // 카드 매입사 코드
  number: string;                    // 카드 번호 (일부 마스킹)
  installmentPlanMonths: number;     // 할부 개월 수 (0이면 일시불)
  approveNo: string;                 // 카드사 승인 번호
  useCardPoint: boolean;             // 카드 포인트 사용 여부
  cardType: string;                  // 카드 종류 (신용, 체크, 기프트 등)
  ownerType: string;                 // 카드 소유자 (개인, 법인)
  acquireStatus: string;             // 매입 상태 (READY, REQUESTED, COMPLETED, CANCEL_REQUESTED, CANCELED)
  isInterestFree: boolean;           // 무이자 할부 여부
  interestPayer: string | null;      // 무이자 할부 부담자 (BUYER, CARD_COMPANY, MERCHANT)
}

/**
 * 가상계좌 정보
 */
export interface TossVirtualAccount {
  accountType: string;               // 계좌 타입 (일반, 고정)
  accountNumber: string;             // 가상계좌 번호
  bankCode: string;                  // 은행 코드
  customerName: string;              // 입금자명
  dueDate: string;                   // 입금 기한 (ISO 8601)
  refundStatus: string;              // 환불 처리 상태
  expired: boolean;                  // 만료 여부
  settlementStatus: string;          // 정산 상태
  refundReceiveAccount: TossRefundAccount | null;  // 환불 계좌
}

/**
 * 환불 계좌 정보
 */
export interface TossRefundAccount {
  bankCode: string;                  // 은행 코드
  accountNumber: string;             // 계좌번호
  holderName: string;                // 예금주명
}

/**
 * 계좌이체 정보
 */
export interface TossTransfer {
  bankCode: string;                  // 은행 코드
  settlementStatus: string;          // 정산 상태
}

/**
 * 휴대폰 결제 정보
 */
export interface TossMobilePhone {
  customerMobilePhone: string;       // 구매자 휴대폰 번호
  settlementStatus: string;          // 정산 상태
  receiptUrl: string;                // 영수증 URL
}

/**
 * 상품권 결제 정보
 */
export interface TossGiftCertificate {
  approveNo: string;                 // 승인 번호
  settlementStatus: string;          // 정산 상태
}

/**
 * 간편결제 정보
 */
export interface TossEasyPay {
  provider: string;                  // 간편결제사 (토스페이, 네이버페이 등)
  amount: number;                    // 간편결제 금액
  discountAmount: number;            // 간편결제 할인 금액
}

/**
 * 취소 내역
 */
export interface TossPaymentCancel {
  cancelAmount: number;              // 취소 금액
  cancelReason: string;              // 취소 이유
  taxFreeAmount: number;             // 면세 금액
  taxExemptionAmount: number;        // 과세 제외 금액
  refundableAmount: number;          // 환불 가능 금액
  easyPayDiscountAmount: number;     // 간편결제 할인 금액
  canceledAt: string;                // 취소 시각 (ISO 8601)
  transactionKey: string;            // 취소 거래 키
  receiptKey: string | null;         // 취소 영수증 키
}

/**
 * 결제 실패 정보
 */
export interface TossPaymentFailure {
  code: string;                      // 실패 코드
  message: string;                   // 실패 메시지
}

/**
 * 현금영수증 정보
 */
export interface TossCashReceipt {
  type: string;                      // 현금영수증 타입 (소득공제, 지출증빙)
  receiptKey: string;                // 현금영수증 키
  issueNumber: string;               // 현금영수증 발급 번호
  receiptUrl: string;                // 현금영수증 URL
  amount: number;                    // 현금영수증 발급 금액
  taxFreeAmount: number;             // 면세 금액
}

/**
 * 할인 정보
 */
export interface TossDiscount {
  amount: number;                    // 할인 금액
}

/**
 * 토스페이먼츠 환불 요청
 */
export interface TossRefundRequest {
  cancelReason: string;              // 환불 사유 (최대 200자)
  cancelAmount?: number;             // 환불 금액 (없으면 전액 환불)
  refundReceiveAccount?: {           // 가상계좌 환불 시 필수
    bank: string;                    // 은행 코드
    accountNumber: string;           // 계좌번호 (숫자만, 최대 20자)
    holderName: string;              // 예금주명 (최대 60자)
  };
  taxFreeAmount?: number;            // 면세 금액
  currency?: string;                 // 통화 (해외 결제 시 필수)
}

/**
 * 토스페이먼츠 환불 상태
 */
export type TossCancelStatus =
  | 'DONE'                           // 환불 완료
  | 'ABORTED';                       // 환불 실패

/**
 * 토스페이먼츠 환불 응답
 */
export interface TossRefundResponse {
  // 기본 정보
  mId: string;
  version: string;
  paymentKey: string;
  orderId: string;
  orderName: string;

  // 금액 정보
  totalAmount: number;               // 원 결제 금액
  balanceAmount: number;             // 남은 금액
  suppliedAmount: number;
  vat: number;
  taxFreeAmount: number;
  taxExemptionAmount: number;

  // 상태 정보
  status: TossPaymentStatus;         // CANCELED or PARTIAL_CANCELED
  currency: string;
  method: TossPaymentMethod;

  // 취소 내역
  cancels: Array<{
    cancelReason: string;            // 환불 사유
    canceledAt: string;              // 환불 시각 (ISO 8601)
    cancelAmount: number;            // 환불 금액
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;        // 환불 가능 금액
    transferDiscountAmount: number;
    easyPayDiscountAmount: number;
    transactionKey: string;          // 거래 키
    receiptKey: string | null;       // 영수증 키
    cancelStatus: TossCancelStatus;  // 환불 상태
    cancelRequestId: string | null;  // 환불 요청 ID
  }>;

  // 결제 수단별 정보
  card: TossPaymentCard | null;
  virtualAccount: TossVirtualAccount | null;
  transfer: TossTransfer | null;
  mobilePhone: TossMobilePhone | null;
  giftCertificate: TossGiftCertificate | null;
  easyPay: TossEasyPay | null;

  // 기타
  requestedAt: string;
  approvedAt: string;
  useEscrow: boolean;
  cultureExpense: boolean;
  lastTransactionKey: string | null;
  isPartialCancelable: boolean;
  country: string;
  failure: TossPaymentFailure | null;
  cashReceipt: TossCashReceipt | null;
  cashReceipts: TossCashReceipt[] | null;
  discount: TossDiscount | null;
  secret: string | null;
  type: string;
  checkout: {
    url: string;
  };
  metadata: Record<string, unknown> | null;
}

/**
 * 토스페이먼츠 에러 응답
 */
export interface TossPaymentError {
  code: string;                      // 에러 코드
  message: string;                   // 에러 메시지
}
