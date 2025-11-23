/**
 * 영수증 생성 유틸리티
 *
 * 기능:
 * - HTML 영수증 생성
 * - 브라우저 인쇄 다이얼로그 열기
 * - 영수증 데이터 포맷팅
 */

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Receipt } from '../types/payment/receipt';
import { logger } from './logger';

/**
 * 영수증 HTML 생성
 */
export function generateReceiptHTML(receipt: Receipt): string {
  const approvedDate = receipt.approvedAt
    ? format(receipt.approvedAt.toDate(), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })
    : '-';

  const refundedDate = receipt.refundedAt
    ? format(receipt.refundedAt.toDate(), 'yyyy년 MM월 dd일 HH:mm:ss', { locale: ko })
    : '-';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>영수증 - ${receipt.orderId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Malgun Gothic', sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }

    .receipt {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border: 1px solid #ddd;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #333;
    }

    .header .type {
      font-size: 18px;
      color: #666;
      font-weight: 500;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: #333;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .info-label {
      font-weight: 500;
      color: #666;
      width: 30%;
    }

    .info-value {
      color: #333;
      width: 70%;
      text-align: right;
    }

    .total-amount {
      background: #f8f9fa;
      padding: 20px;
      margin: 30px 0;
      border-radius: 8px;
      text-align: center;
    }

    .total-amount .label {
      font-size: 18px;
      color: #666;
      margin-bottom: 10px;
    }

    .total-amount .amount {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #333;
      text-align: center;
      color: #666;
      font-size: 14px;
    }

    .chips-info {
      background: #eff6ff;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }

    .chip-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
    }

    .chip-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .chip-icon {
      font-size: 20px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .receipt {
        box-shadow: none;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- 헤더 -->
    <div class="header">
      <h1>T-HOLDEM 영수증</h1>
      <div class="type">${getReceiptTypeName(receipt.type)}</div>
    </div>

    <!-- 거래 정보 -->
    <div class="section">
      <div class="section-title">거래 정보</div>
      <div class="info-row">
        <span class="info-label">주문번호</span>
        <span class="info-value">${receipt.orderId}</span>
      </div>
      ${receipt.paymentKey ? `
      <div class="info-row">
        <span class="info-label">결제키</span>
        <span class="info-value">${receipt.paymentKey}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">상품명</span>
        <span class="info-value">${receipt.orderName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">수량</span>
        <span class="info-value">${receipt.quantity}개</span>
      </div>
      ${receipt.approvedAt ? `
      <div class="info-row">
        <span class="info-label">승인일시</span>
        <span class="info-value">${approvedDate}</span>
      </div>
      ` : ''}
      ${receipt.refundedAt ? `
      <div class="info-row">
        <span class="info-label">환불일시</span>
        <span class="info-value">${refundedDate}</span>
      </div>
      ` : ''}
    </div>

    <!-- 결제 정보 -->
    ${receipt.method ? `
    <div class="section">
      <div class="section-title">결제 정보</div>
      <div class="info-row">
        <span class="info-label">결제수단</span>
        <span class="info-value">${getPaymentMethodName(receipt.method)}</span>
      </div>
      ${receipt.cardNumber ? `
      <div class="info-row">
        <span class="info-label">카드번호</span>
        <span class="info-value">${receipt.cardNumber}</span>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- 칩 정보 -->
    ${receipt.redChips || receipt.blueChips ? `
    <div class="chips-info">
      <div class="section-title">칩 정보</div>
      ${receipt.redChips ? `
      <div class="chip-item">
        <span class="chip-label">
          <span class="chip-icon">🔴</span>
          빨간칩
        </span>
        <span>${receipt.redChips.toLocaleString()}칩</span>
      </div>
      ` : ''}
      ${receipt.blueChips ? `
      <div class="chip-item">
        <span class="chip-label">
          <span class="chip-icon">🔵</span>
          파란칩
        </span>
        <span>${receipt.blueChips.toLocaleString()}칩</span>
      </div>
      ` : ''}
    </div>
    ` : ''}

    <!-- 환불 정보 -->
    ${receipt.type === 'refund' && receipt.refundReason ? `
    <div class="section">
      <div class="section-title">환불 정보</div>
      <div class="info-row">
        <span class="info-label">환불 사유</span>
        <span class="info-value">${receipt.refundReason}</span>
      </div>
    </div>
    ` : ''}

    <!-- 총 금액 -->
    <div class="total-amount">
      <div class="label">${receipt.type === 'refund' ? '환불 금액' : '결제 금액'}</div>
      <div class="amount">${receipt.amount.toLocaleString()}원</div>
    </div>

    <!-- 고객 정보 -->
    <div class="section">
      <div class="section-title">고객 정보</div>
      <div class="info-row">
        <span class="info-label">이름</span>
        <span class="info-value">${receipt.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">이메일</span>
        <span class="info-value">${receipt.customerEmail}</span>
      </div>
      ${receipt.customerPhone ? `
      <div class="info-row">
        <span class="info-label">연락처</span>
        <span class="info-value">${receipt.customerPhone}</span>
      </div>
      ` : ''}
    </div>

    <!-- 사업자 정보 -->
    <div class="section">
      <div class="section-title">사업자 정보</div>
      <div class="info-row">
        <span class="info-label">상호명</span>
        <span class="info-value">${receipt.businessName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">사업자등록번호</span>
        <span class="info-value">${receipt.businessNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">주소</span>
        <span class="info-value">${receipt.businessAddress}</span>
      </div>
    </div>

    <!-- 푸터 -->
    <div class="footer">
      <p>본 영수증은 전자상거래법에 의거하여 발행되었습니다.</p>
      <p style="margin-top: 10px;">문의: support@tholdem.com</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 영수증 타입 이름 반환
 */
function getReceiptTypeName(type: string): string {
  switch (type) {
    case 'payment':
      return '결제 영수증';
    case 'subscription':
      return '구독 결제 영수증';
    case 'refund':
      return '환불 영수증';
    default:
      return '영수증';
  }
}

/**
 * 결제수단 이름 반환
 */
function getPaymentMethodName(method: string): string {
  switch (method) {
    case 'card':
    case '카드':
      return '신용/체크카드';
    case 'virtualAccount':
    case '가상계좌':
      return '가상계좌';
    case 'transfer':
    case '계좌이체':
      return '계좌이체';
    case 'mobile':
    case '휴대폰':
      return '휴대폰 결제';
    default:
      return method;
  }
}

/**
 * 영수증 인쇄
 */
export function printReceipt(receipt: Receipt): void {
  try {
    const html = generateReceiptHTML(receipt);

    // 새 창 열기
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      throw new Error('팝업 차단으로 인해 영수증을 열 수 없습니다.');
    }

    // HTML 작성
    printWindow.document.write(html);
    printWindow.document.close();

    // 이미지 로딩 대기 후 인쇄
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };

    logger.info('영수증 인쇄 시작');
  } catch (error) {
    logger.error('영수증 인쇄 실패', error as Error);
    throw error;
  }
}

/**
 * 영수증 HTML 다운로드
 */
export function downloadReceiptHTML(receipt: Receipt): void {
  try {
    const html = generateReceiptHTML(receipt);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt_${receipt.orderId}.html`;
    link.click();

    URL.revokeObjectURL(url);

    logger.info('영수증 HTML 다운로드 완료');
  } catch (error) {
    logger.error('영수증 HTML 다운로드 실패', error as Error);
    throw error;
  }
}
