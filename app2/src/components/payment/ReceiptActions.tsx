/**
 * 영수증 액션 버튼 컴포넌트
 *
 * 기능:
 * - 영수증 인쇄
 * - 영수증 다운로드 (HTML)
 * - 영수증 이메일 발송
 */

import React, { useState } from 'react';
import { PrinterIcon, ArrowDownTrayIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { printReceipt, downloadReceiptHTML } from '../../utils/receiptGenerator';
import type { Receipt } from '../../types/payment/receipt';

interface ReceiptActionsProps {
  orderId: string;
  receiptType: 'payment' | 'subscription' | 'refund';
  receipt?: Receipt; // 영수증 데이터가 있으면 전달
  className?: string;
}

const ReceiptActions: React.FC<ReceiptActionsProps> = ({
  orderId,
  receiptType,
  receipt,
  className = '',
}) => {
  const { currentUser } = useAuth();
  const [sending, setSending] = useState(false);

  /**
   * 인쇄
   */
  const handlePrint = () => {
    if (!receipt) {
      toast.warning('영수증 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      printReceipt(receipt);
      logger.info('ReceiptActions: 인쇄 시작');
    } catch (error) {
      logger.error('ReceiptActions: 인쇄 실패', error as Error);
      toast.error('인쇄 중 오류가 발생했습니다.');
    }
  };

  /**
   * 다운로드
   */
  const handleDownload = () => {
    if (!receipt) {
      toast.warning('영수증 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      downloadReceiptHTML(receipt);
      logger.info('ReceiptActions: 다운로드 완료');
      toast.success('영수증이 다운로드되었습니다.');
    } catch (error) {
      logger.error('ReceiptActions: 다운로드 실패', error as Error);
      toast.error('다운로드 중 오류가 발생했습니다.');
    }
  };

  /**
   * 이메일 발송
   */
  const handleSendEmail = async () => {
    if (!currentUser) {
      toast.warning('로그인이 필요합니다.');
      return;
    }

    setSending(true);
    toast.info('영수증을 이메일로 발송하는 중입니다...');

    try {
      const sendReceiptEmail = httpsCallable(functions, 'sendReceiptEmail');
      const result = await sendReceiptEmail({
        orderId,
        userId: currentUser.uid,
        receiptType,
      });

      const data = result.data as { success: boolean; message: string; email?: string };

      if (data.success) {
        toast.success(`영수증이 ${data.email || '이메일'}로 발송되었습니다.`);
        logger.info('ReceiptActions: 이메일 발송 완료');
      } else {
        throw new Error(data.message || '이메일 발송 실패');
      }
    } catch (error) {
      logger.error('ReceiptActions: 이메일 발송 실패', error as Error);
      toast.error('이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 인쇄 */}
      <button
        onClick={handlePrint}
        disabled={!receipt}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="영수증 인쇄"
      >
        <PrinterIcon className="w-5 h-5" />
        <span className="hidden sm:inline">인쇄</span>
      </button>

      {/* 다운로드 */}
      <button
        onClick={handleDownload}
        disabled={!receipt}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="영수증 다운로드"
      >
        <ArrowDownTrayIcon className="w-5 h-5" />
        <span className="hidden sm:inline">다운로드</span>
      </button>

      {/* 이메일 발송 */}
      <button
        onClick={handleSendEmail}
        disabled={sending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="영수증 이메일 발송"
      >
        <EnvelopeIcon className="w-5 h-5" />
        <span className="hidden sm:inline">{sending ? '발송 중...' : '이메일 발송'}</span>
      </button>
    </div>
  );
};

export default ReceiptActions;
