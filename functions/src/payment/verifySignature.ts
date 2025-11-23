import * as crypto from 'crypto';
import * as functions from 'firebase-functions';

/**
 * 토스페이먼츠 웹훅 시그니처 검증
 *
 * 웹훅 요청이 토스페이먼츠에서 온 것인지 검증합니다.
 * 위조된 요청을 차단하여 보안을 강화합니다.
 *
 * @see https://docs.tosspayments.com/reference/webhook#webhook-signature
 */

/**
 * 시그니처 검증
 *
 * @param signature - 웹훅 요청 헤더의 X-Signature 값
 * @param payload - 웹훅 요청 본문 (JSON 문자열)
 * @returns 검증 성공 여부
 */
export function verifyWebhookSignature(signature: string, payload: string): boolean {
  try {
    const secretKey = functions.config().toss?.secret_key;

    if (!secretKey) {
      functions.logger.error('토스페이먼츠 Secret Key가 설정되지 않았습니다');
      return false;
    }

    // HMAC-SHA256 해시 생성
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(payload);
    const computedSignature = hmac.digest('hex');

    // 시그니처 비교 (타이밍 공격 방지를 위한 constant-time comparison)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    functions.logger.error('시그니처 검증 실패', error);
    return false;
  }
}

/**
 * 시그니처 검증 미들웨어
 *
 * Express 요청에서 시그니처를 추출하고 검증합니다.
 *
 * @param req - Express Request
 * @returns 검증 성공 여부
 */
export function verifyTossWebhookRequest(req: functions.https.Request): boolean {
  const signature = req.headers['x-signature'] as string;

  if (!signature) {
    functions.logger.warn('시그니처 헤더가 없습니다');
    return false;
  }

  // Express의 rawBody 또는 body를 JSON 문자열로 변환
  const payload = typeof req.body === 'string'
    ? req.body
    : JSON.stringify(req.body);

  return verifyWebhookSignature(signature, payload);
}

/**
 * 결제 금액 검증
 *
 * 클라이언트가 전송한 금액과 서버의 금액이 일치하는지 확인합니다.
 * 금액 조작 공격을 방지합니다.
 *
 * @param clientAmount - 클라이언트가 전송한 금액
 * @param serverAmount - 서버에서 계산한 실제 금액
 * @returns 검증 성공 여부
 */
export function verifyPaymentAmount(
  clientAmount: number,
  serverAmount: number
): boolean {
  if (clientAmount !== serverAmount) {
    functions.logger.warn('결제 금액 불일치', {
      clientAmount,
      serverAmount,
      difference: Math.abs(clientAmount - serverAmount),
    });
    return false;
  }

  return true;
}

/**
 * orderId 형식 검증
 *
 * orderId가 예상된 형식인지 확인합니다.
 * 형식: {userId}_{timestamp}_{packageId}
 *
 * @param orderId - 주문 ID
 * @returns 검증 성공 여부
 */
export function verifyOrderIdFormat(orderId: string): boolean {
  // 형식: {userId}_{timestamp}_{packageId}
  const pattern = /^[a-zA-Z0-9_-]+_\d+_[a-zA-Z0-9_-]+$/;

  if (!pattern.test(orderId)) {
    functions.logger.warn('orderId 형식이 올바르지 않습니다', { orderId });
    return false;
  }

  return true;
}

/**
 * orderId에서 userId 추출
 *
 * @param orderId - 주문 ID
 * @returns userId 또는 null
 */
export function extractUserIdFromOrderId(orderId: string): string | null {
  try {
    // 형식: {userId}_{timestamp}_{packageId}
    const parts = orderId.split('_');
    if (parts.length !== 3) {
      functions.logger.warn('orderId 파싱 실패', { orderId });
      return null;
    }

    return parts[0];
  } catch (error) {
    functions.logger.error('userId 추출 실패', error);
    return null;
  }
}

/**
 * orderId에서 packageId 추출
 *
 * @param orderId - 주문 ID
 * @returns packageId 또는 null
 */
export function extractPackageIdFromOrderId(orderId: string): string | null {
  try {
    // 형식: {userId}_{timestamp}_{packageId}
    const parts = orderId.split('_');
    if (parts.length !== 3) {
      functions.logger.warn('orderId 파싱 실패', { orderId });
      return null;
    }

    return parts[2];
  } catch (error) {
    functions.logger.error('packageId 추출 실패', error);
    return null;
  }
}

/**
 * 중복 결제 방지를 위한 타임스탬프 검증
 *
 * orderId의 타임스탬프가 유효한 범위 내에 있는지 확인합니다.
 * (현재 시각 기준 ±1시간)
 *
 * @param orderId - 주문 ID
 * @returns 검증 성공 여부
 */
export function verifyOrderIdTimestamp(orderId: string): boolean {
  try {
    const parts = orderId.split('_');
    if (parts.length !== 3) {
      return false;
    }

    const timestamp = parseInt(parts[1], 10);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1시간 (밀리초)

    // 타임스탬프가 현재 시각 기준 ±1시간 내에 있는지 확인
    if (Math.abs(now - timestamp) > oneHour) {
      functions.logger.warn('orderId 타임스탬프가 유효하지 않습니다', {
        orderId,
        timestamp: new Date(timestamp).toISOString(),
        now: new Date(now).toISOString(),
        difference: Math.abs(now - timestamp),
      });
      return false;
    }

    return true;
  } catch (error) {
    functions.logger.error('타임스탬프 검증 실패', error);
    return false;
  }
}

/**
 * 종합 보안 검증
 *
 * 결제 요청의 모든 보안 검증을 수행합니다.
 *
 * @param params - 검증 파라미터
 * @returns 검증 결과 및 에러 메시지
 */
export interface SecurityValidationParams {
  signature?: string;
  payload?: string;
  orderId: string;
  clientAmount: number;
  serverAmount: number;
  userId: string;
}

export interface SecurityValidationResult {
  success: boolean;
  error?: string;
}

export function validatePaymentSecurity(
  params: SecurityValidationParams
): SecurityValidationResult {
  const { signature, payload, orderId, clientAmount, serverAmount, userId } = params;

  // 1. 시그니처 검증 (웹훅인 경우)
  if (signature && payload) {
    if (!verifyWebhookSignature(signature, payload)) {
      return { success: false, error: '시그니처 검증 실패' };
    }
  }

  // 2. orderId 형식 검증
  if (!verifyOrderIdFormat(orderId)) {
    return { success: false, error: 'orderId 형식이 올바르지 않습니다' };
  }

  // 3. orderId 타임스탬프 검증
  if (!verifyOrderIdTimestamp(orderId)) {
    return { success: false, error: 'orderId 타임스탬프가 유효하지 않습니다' };
  }

  // 4. userId 일치 검증
  const extractedUserId = extractUserIdFromOrderId(orderId);
  if (!extractedUserId || extractedUserId !== userId) {
    return { success: false, error: '본인의 결제가 아닙니다' };
  }

  // 5. 금액 검증
  if (!verifyPaymentAmount(clientAmount, serverAmount)) {
    return { success: false, error: '결제 금액이 일치하지 않습니다' };
  }

  return { success: true };
}
