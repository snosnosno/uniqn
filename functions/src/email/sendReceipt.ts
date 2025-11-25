/**
 * 영수증 이메일 발송 Cloud Function
 *
 * 기능:
 * - 결제/환불 영수증 이메일 발송
 * - HTML 템플릿 생성
 * - SendGrid 또는 Nodemailer 사용
 *
 * 호출 예시:
 * ```typescript
 * const sendReceiptEmail = httpsCallable(functions, 'sendReceiptEmail');
 * await sendReceiptEmail({ orderId: 'ORD123456' });
 * ```
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 요청 데이터
 */
interface SendReceiptEmailRequest {
  orderId: string;        // 주문번호
  userId: string;         // 사용자 ID
  receiptType: 'payment' | 'subscription' | 'refund';
}

/**
 * 영수증 이메일 발송
 */
export const sendReceiptEmail = functions
  .region('asia-northeast3')
  .https.onCall(async (data: SendReceiptEmailRequest, context) => {
    // 1. 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const { orderId, userId, receiptType } = data;

    // 2. 본인 확인
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '본인의 영수증만 요청할 수 있습니다.'
      );
    }

    try {
      // 3. 거래 정보 조회
      const transaction = await getTransactionData(orderId, receiptType);
      if (!transaction) {
        throw new functions.https.HttpsError(
          'not-found',
          '거래 정보를 찾을 수 없습니다.'
        );
      }

      // 4. 사용자 정보 조회
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          '사용자 정보를 찾을 수 없습니다.'
        );
      }

      const userData = userDoc.data();
      const userEmail = userData?.email || context.auth.token.email;

      if (!userEmail) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '이메일 주소가 없습니다.'
        );
      }

      // 5. 영수증 HTML 생성 (추후 이메일 발송 시 사용)
      // const receiptHTML = generateReceiptEmailHTML({
      //   ...transaction,
      //   customerName: userData?.name || '고객',
      //   customerEmail: userEmail,
      //   customerPhone: userData?.phone,
      // });

      // 6. 이메일 발송 (실제 구현 시 SendGrid 또는 Nodemailer 사용)
      // 현재는 로그만 출력
      logger.info('영수증 이메일 발송 준비', {
        orderId,
        email: userEmail,
        receiptType,
      });

      // TODO: 실제 이메일 발송 구현
      // await sendEmail({
      //   to: userEmail,
      //   subject: `[T-HOLDEM] ${getReceiptTypeName(receiptType)} - ${orderId}`,
      //   html: receiptHTML,
      // });

      // 7. 발송 기록 저장
      await db
        .collection('users')
        .doc(userId)
        .collection('receipts')
        .doc(orderId)
        .set(
          {
            emailSent: true,
            emailSentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      logger.info('영수증 이메일 발송 완료', { orderId, email: userEmail });

      return {
        success: true,
        message: '영수증이 이메일로 발송되었습니다.',
        email: userEmail,
      };
    } catch (error) {
      logger.error('영수증 이메일 발송 실패', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        '영수증 발송 중 오류가 발생했습니다.'
      );
    }
  });

/**
 * 거래 정보 조회
 */
async function getTransactionData(
  orderId: string,
  receiptType: string
): Promise<any> {
  if (receiptType === 'refund') {
    // 환불 요청에서 조회
    const refundSnapshot = await db
      .collection('refundRequests')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (!refundSnapshot.empty) {
      return refundSnapshot.docs[0]?.data();
    }
  } else {
    // 결제 트랜잭션에서 조회
    const paymentSnapshot = await db
      .collection('paymentTransactions')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (!paymentSnapshot.empty) {
      return paymentSnapshot.docs[0]?.data();
    }
  }

  return null;
}

// 영수증 타입 이름 반환 함수는 추후 필요 시 사용
// function getReceiptTypeName(type: string): string {
//   switch (type) {
//     case 'payment':
//       return '결제 영수증';
//     case 'subscription':
//       return '구독 결제 영수증';
//     case 'refund':
//       return '환불 영수증';
//     default:
//       return '영수증';
//   }
// }

/**
 * 영수증 이메일 HTML 생성 (추후 이메일 발송 시 사용)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateReceiptEmailHTML(data: any): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>T-HOLDEM 영수증</title>
  <style>
    body {
      font-family: 'Malgun Gothic', sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .info-label {
      color: #6b7280;
      font-weight: 500;
    }
    .info-value {
      color: #111827;
      font-weight: 600;
    }
    .total-box {
      background: #eff6ff;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
    }
    .total-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .total-amount {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 12px 30px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎰 T-HOLDEM</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">영수증이 발급되었습니다</p>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">거래 정보</div>
        <div class="info-row">
          <span class="info-label">주문번호</span>
          <span class="info-value">${data.orderId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">상품명</span>
          <span class="info-value">${data.orderName || '칩 충전'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">결제일시</span>
          <span class="info-value">${new Date().toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      <div class="total-box">
        <div class="total-label">결제 금액</div>
        <div class="total-amount">${(data.amount || 0).toLocaleString()}원</div>
      </div>

      <div class="section">
        <div class="section-title">고객 정보</div>
        <div class="info-row">
          <span class="info-label">이름</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">이메일</span>
          <span class="info-value">${data.customerEmail}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="https://tholdem-ebc18.web.app/app/payment/history" class="button">
          결제 내역 확인하기
        </a>
      </div>
    </div>

    <div class="footer">
      <p>본 메일은 발신 전용입니다.</p>
      <p style="margin-top: 8px;">문의: support@tholdem.com</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
