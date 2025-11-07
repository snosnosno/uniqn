import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';

interface ApprovalModalProps {
  postingId: string;
  postingTitle: string;
  mode: 'approve' | 'reject';
  onConfirm: (postingId: string, reason?: string) => Promise<void>;
  onCancel: () => void;
  processing: boolean;
}

/**
 * 대회 공고 승인/거부 모달 컴포넌트
 * Admin 전용 - 대회 공고 승인 또는 거부 처리
 */
export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  postingId,
  postingTitle,
  mode,
  onConfirm,
  onCancel,
  processing
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 거부 시 사유 검증
    if (mode === 'reject') {
      if (!rejectionReason.trim()) {
        setError('거부 사유를 입력해주세요');
        return;
      }
      if (rejectionReason.trim().length < 10) {
        setError('거부 사유는 최소 10자 이상이어야 합니다');
        return;
      }
    }

    try {
      logger.info('승인/거부 처리 시작');
      await onConfirm(postingId, mode === 'reject' ? rejectionReason.trim() : undefined);
      logger.info('승인/거부 처리 완료');
    } catch (err) {
      logger.error('승인/거부 처리 실패', err instanceof Error ? err : new Error(String(err)));
      setError('처리 중 오류가 발생했습니다');
    }
  };

  const isApprove = mode === 'approve';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onCancel}
        />

        {/* 모달 중앙 정렬 */}
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
          &#8203;
        </span>

        {/* 모달 컨텐츠 */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${
              isApprove
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isApprove ? '공고 승인' : '공고 거부'}
            </h3>
            <button
              onClick={onCancel}
              disabled={processing}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 disabled:opacity-50"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* 본문 */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                다음 공고를 {isApprove ? '승인' : '거부'}하시겠습니까?
              </p>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {postingTitle}
                </p>
              </div>
            </div>

            {/* 거부 사유 입력 (거부 모드일 때만) */}
            {!isApprove && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  거부 사유 <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={processing}
                  placeholder="거부 사유를 10자 이상 입력해주세요"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {rejectionReason.length}/10자 이상
                </p>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={processing || (!isApprove && rejectionReason.trim().length < 10)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                  isApprove
                    ? 'bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600'
                    : 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600'
                }`}
              >
                {processing ? '처리 중...' : isApprove ? '승인' : '거부'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
