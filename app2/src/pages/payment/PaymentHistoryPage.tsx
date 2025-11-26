/**
 * 결제 내역 페이지 (개선 버전)
 *
 * 기능:
 * - 실시간 결제 내역 조회 (usePaymentHistory Hook)
 * - 환불 내역 조회
 * - 날짜 필터링
 * - 상태별 필터링
 * - 통계 정보 표시
 * - 다국어 지원 (i18n)
 * - 다크모드 지원
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ReceiptActions from '../../components/payment/ReceiptActions';
import RefundRequestModal from '../../components/payment/RefundRequestModal';
import { usePaymentHistory } from '../../hooks/usePaymentHistory';
import type { Receipt } from '../../types/payment/receipt';
import type { PaymentStatus } from '../../types/payment';

const PaymentHistoryPage: React.FC = () => {
  const { t } = useTranslation('payment');
  const { currentUser } = useAuth();
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [refundModal, setRefundModal] = useState<{
    isOpen: boolean;
    transactionId: string;
    orderId: string;
    amount: number;
  }>({
    isOpen: false,
    transactionId: '',
    orderId: '',
    amount: 0,
  });

  // 실시간 결제 내역 조회
  const { transactions, statistics, isLoading, error } = usePaymentHistory(
    currentUser?.uid || null,
    {
      status: filterStatus,
      startDate,
      endDate,
    }
  );

  const getStatusBadge = (status: PaymentStatus) => {
    const statusText = t(`paymentHistory.status.${status}`);

    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
            {statusText}
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
            {statusText}
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
            {statusText}
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            {statusText}
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {t('paymentHistory.error.loadFailed')}
          </p>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('paymentHistory.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            총 {statistics.totalTransactions}건 | 완료 {statistics.completedCount}건 | 실패{' '}
            {statistics.failedCount}건
          </p>
        </div>

        {/* 필터 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 상태 필터 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('paymentHistory.filter.all')}
              </label>
              <select
                value={filterStatus || 'all'}
                onChange={(e) => {
                  setFilterStatus(
                    e.target.value === 'all' ? undefined : (e.target.value as PaymentStatus)
                  );
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">{t('paymentHistory.filter.all')}</option>
                <option value="completed">{t('paymentHistory.filter.success')}</option>
                <option value="pending">{t('paymentHistory.filter.pending')}</option>
                <option value="failed">{t('paymentHistory.filter.failed')}</option>
              </select>
            </div>

            {/* 시작 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                시작 날짜
              </label>
              <input
                type="date"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) =>
                  setStartDate(e.target.value ? new Date(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            {/* 종료 날짜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                종료 날짜
              </label>
              <input
                type="date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* 결제 내역 테이블 */}
        {transactions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">{t('paymentHistory.empty')}</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.date')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.amount')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.method')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.orderId')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('paymentHistory.table.receipt')}
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        환불
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((transaction) => {
                      // 영수증 타입 매핑
                      const receiptType =
                        transaction.itemType === 'chip_package' ? 'payment' : 'subscription';

                      // 영수증 데이터 생성
                      const receipt: Receipt = {
                        id: transaction.id,
                        userId: transaction.userId,
                        type: receiptType,
                        orderId: transaction.orderId,
                        paymentKey: transaction.paymentKey,
                        amount: transaction.amount,
                        orderName: transaction.orderName,
                        quantity: transaction.chipAmount || 0,
                        redChips: transaction.chipAmount,
                        method: transaction.paymentMethod,
                        approvedAt: transaction.approvedAt,
                        refundReason: transaction.refundReason,
                        businessName: 'T-HOLDEM',
                        businessNumber: '000-00-00000',
                        businessAddress: '서울특별시 강남구',
                        customerName: currentUser?.displayName || '고객',
                        customerEmail: currentUser?.email || '',
                        createdAt: transaction.createdAt,
                        emailSent: false,
                      };

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {format(transaction.createdAt.toDate(), 'yyyy.MM.dd HH:mm', {
                              locale: ko,
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {transaction.amount.toLocaleString()}
                            {t('common.currency.krw')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {transaction.paymentMethod}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(transaction.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {transaction.orderId?.substring(0, 20)}...
                          </td>
                          <td className="px-6 py-4">
                            <ReceiptActions
                              orderId={transaction.orderId}
                              receiptType={receiptType}
                              receipt={receipt}
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {transaction.status === 'completed' && (
                              <button
                                onClick={() =>
                                  setRefundModal({
                                    isOpen: true,
                                    transactionId: transaction.id,
                                    orderId: transaction.orderId,
                                    amount: transaction.amount,
                                  })
                                }
                                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              >
                                환불 요청
                              </button>
                            )}
                            {transaction.status === 'refunded' && (
                              <span className="text-sm text-orange-600 dark:text-orange-400">
                                환불 완료
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* 통계 정보 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">총 결제 금액</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {statistics.totalAmount.toLocaleString()}
              {t('common.currency.krw')}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">총 칩 충전</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              🔴 {statistics.totalChips.toLocaleString()}칩
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">환불 건수</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {statistics.refundedCount}건
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">총 거래 건수</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {statistics.totalTransactions}건
            </p>
          </div>
        </div>

        {/* 환불 요청 모달 */}
        <RefundRequestModal
          isOpen={refundModal.isOpen}
          onClose={() =>
            setRefundModal({
              isOpen: false,
              transactionId: '',
              orderId: '',
              amount: 0,
            })
          }
          transactionId={refundModal.transactionId}
          orderId={refundModal.orderId}
          amount={refundModal.amount}
        />
      </div>
    </div>
  );
};

export default PaymentHistoryPage;
