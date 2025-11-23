import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLogger } from '../../hooks/useLogger';
import { useToast } from '../../hooks/useToast';
import type { ChipType } from '../../types/payment/chip';

interface ManualChipGrantProps {
  onSuccess?: () => void;
}

/**
 * 관리자 수동 칩 지급 컴포넌트
 *
 * 기능:
 * - 사용자 ID 입력
 * - 칩 타입 선택 (빨간칩/파란칩)
 * - 칩 개수 입력
 * - 지급 사유 입력
 * - manualGrantChips Cloud Function 호출
 * - 관리자 권한 필요
 */
export const ManualChipGrant: React.FC<ManualChipGrantProps> = ({ onSuccess }) => {
  const logger = useLogger();
  const toast = useToast();

  const [userId, setUserId] = useState('');
  const [chipType, setChipType] = useState<ChipType>('red');
  const [amount, setAmount] = useState<number>(10);
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * 칩 지급 처리
   */
  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      toast.showError('사용자 ID를 입력해주세요', 'error');
      return;
    }

    if (amount <= 0) {
      toast.showError('칩 개수는 1개 이상이어야 합니다', 'error');
      return;
    }

    if (!reason.trim()) {
      toast.showError('지급 사유를 입력해주세요', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const functions = getFunctions();
      const manualGrantChipsFn = httpsCallable(functions, 'manualGrantChips');

      const result = await manualGrantChipsFn({
        userId: userId.trim(),
        chipType,
        amount,
        reason: reason.trim(),
      });

      const resultData = result.data as { success: boolean; message: string; data: unknown };

      if (!resultData.success) {
        throw new Error(resultData.message || '칩 지급에 실패했습니다');
      }

      logger.info('수동 칩 지급 완료', {
        operation: 'manualGrantChips',
        additionalData: { userId, chipType, amount, reason },
      });

      toast.showSuccess(resultData.message || '칩이 성공적으로 지급되었습니다');

      // 폼 초기화
      setUserId('');
      setChipType('red');
      setAmount(10);
      setReason('');

      onSuccess?.();
    } catch (error) {
      logger.error('수동 칩 지급 실패', error instanceof Error ? error : undefined, {
        operation: 'manualGrantChips',
      });

      const errorMessage =
        error instanceof Error ? error.message : '칩 지급 중 오류가 발생했습니다';

      toast.showError(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
      <h3 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">
        수동 칩 지급
      </h3>

      <form onSubmit={handleGrant} className="space-y-6">
        {/* 사용자 ID */}
        <div>
          <label
            htmlFor="userId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            사용자 ID
          </label>
          <input
            type="text"
            id="userId"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="예: abc123def456"
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            disabled={isProcessing}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Firebase Authentication UID를 입력하세요
          </p>
        </div>

        {/* 칩 타입 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            칩 타입
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setChipType('red')}
              disabled={isProcessing}
              className={`
                flex items-center justify-center rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all
                ${
                  chipType === 'red'
                    ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-red-300 dark:hover:border-red-600'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              🔴 빨간칩 (1년)
            </button>
            <button
              type="button"
              onClick={() => setChipType('blue')}
              disabled={isProcessing}
              className={`
                flex items-center justify-center rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all
                ${
                  chipType === 'blue'
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              🔵 파란칩 (구독)
            </button>
          </div>
        </div>

        {/* 칩 개수 */}
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            칩 개수
          </label>
          <div className="mt-1 flex gap-3">
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value, 10) || 0)}
              min="1"
              max="1000"
              className="block w-32 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
              disabled={isProcessing}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAmount(10)}
                disabled={isProcessing}
                className="rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                10개
              </button>
              <button
                type="button"
                onClick={() => setAmount(50)}
                disabled={isProcessing}
                className="rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                50개
              </button>
              <button
                type="button"
                onClick={() => setAmount(100)}
                disabled={isProcessing}
                className="rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                100개
              </button>
            </div>
          </div>
        </div>

        {/* 지급 사유 */}
        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            지급 사유
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="예: 이벤트 보상, 고객 보상, 오류 보상 등"
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            disabled={isProcessing}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setUserId('');
              setChipType('red');
              setAmount(10);
              setReason('');
            }}
            disabled={isProcessing}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            초기화
          </button>
          <button
            type="submit"
            disabled={isProcessing}
            className={`
              rounded-md px-6 py-2 text-sm font-semibold text-white
              ${
                isProcessing
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
              }
            `}
          >
            {isProcessing ? '처리 중...' : '칩 지급하기'}
          </button>
        </div>
      </form>

      {/* 안내 메시지 */}
      <div className="mt-6 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
        <h4 className="font-semibold text-yellow-900 dark:text-yellow-200">
          ⚠️ 주의사항
        </h4>
        <ul className="mt-2 space-y-1 text-sm text-yellow-800 dark:text-yellow-300">
          <li>• 관리자 권한이 필요합니다</li>
          <li>• 빨간칩은 1년 후 만료됩니다</li>
          <li>• 파란칩은 다음 달 1일 00:00:00에 만료됩니다</li>
          <li>• 지급된 칩은 취소할 수 없으니 신중하게 지급하세요</li>
        </ul>
      </div>
    </div>
  );
};
