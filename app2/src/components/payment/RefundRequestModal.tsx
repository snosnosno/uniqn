/**
 * 환불 요청 모달 컴포넌트
 *
 * 기능:
 * - 환불 사유 입력
 * - Firebase Functions 환불 요청
 * - 로딩 상태 표시
 * - 성공/실패 처리
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRefundRequest } from '../../hooks/useRefundRequest';
import { useToast } from '../../hooks/useToast';

interface RefundRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  orderId: string;
  amount: number;
}

const RefundRequestModal: React.FC<RefundRequestModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  orderId,
  amount,
}) => {
  const { t } = useTranslation('payment');
  const { requestRefund, isLoading } = useRefundRequest();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');

  const predefinedReasons = [
    { value: 'service_not_used', label: '서비스 미사용' },
    { value: 'duplicate_payment', label: '중복 결제' },
    { value: 'dissatisfied', label: '서비스 불만족' },
    { value: 'wrong_amount', label: '금액 오류' },
    { value: 'other', label: '기타' },
  ];

  const handleSubmit = async () => {
    const finalReason = selectedReason === 'other' ? reason : selectedReason;

    if (!finalReason || finalReason.trim() === '') {
      toast.showWarning('환불 사유를 입력해주세요.');
      return;
    }

    const success = await requestRefund(transactionId, finalReason);
    if (success) {
      setReason('');
      setSelectedReason('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 transition-opacity"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          {/* 헤더 */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              환불 요청
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              주문번호: {orderId}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              환불 금액: {amount.toLocaleString()}{t('common.currency.krw')}
            </p>
          </div>

          {/* 환불 사유 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              환불 사유 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
            >
              <option value="">사유를 선택하세요</option>
              {predefinedReasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* 기타 사유 입력 */}
          {selectedReason === 'other' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                상세 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isLoading}
                placeholder="환불 사유를 자세히 입력해주세요 (최소 10자)"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {reason.length} / 500자
              </p>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              ⚠️ 환불 요청 후 영업일 기준 3-5일 내에 처리됩니다.
            </p>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
              환불 승인 후 결제 수단에 따라 1-7일 소요될 수 있습니다.
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedReason || (selectedReason === 'other' && reason.trim().length < 10)}
              className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  처리 중...
                </span>
              ) : (
                '환불 요청'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundRequestModal;
