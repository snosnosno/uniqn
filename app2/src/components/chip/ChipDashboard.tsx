import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { useChip } from '../../contexts/ChipContext';

/**
 * 칩 대시보드 컴포넌트
 *
 * 기능:
 * - 파란칩/빨간칩 잔액 표시
 * - 칩 소멸 일자 표시
 * - 사용 순서 안내
 * - 충전 버튼
 * - ChipContext 실시간 구독
 */
export const ChipDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { chipBalance, isLoading } = useChip();

  const handleRecharge = () => {
    navigate('/chip/recharge');
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const blueChips = chipBalance?.blueChips ?? 0;
  const redChips = chipBalance?.redChips ?? 0;
  const totalChips = chipBalance?.totalChips ?? 0;

  // 임시: 소멸 일자 (실제로는 Firestore에서 가져와야 함)
  const blueChipExpiry = '11/30';
  const redChipExpiry = '2026/10/26';

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-lg p-6 border-2 border-blue-200 dark:border-blue-800">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-2xl">🎰</span>
          보유 칩
        </h2>
        <button
          onClick={handleRecharge}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md font-semibold transition-colors"
        >
          <PlusCircleIcon className="h-5 w-5" />
          충전하기
        </button>
      </div>

      {/* 총 칩 */}
      <div className="text-center mb-6">
        <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {totalChips}칩
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">═══════════</div>
      </div>

      {/* 파란칩 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border-2 border-blue-300 dark:border-blue-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔵</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">파란칩</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{blueChips}개</div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">매월 지급 구독 칩</div>
        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
          <span>⏰</span>
          {blueChips > 0 ? `${blueChipExpiry} 소멸` : '소진됨'}
        </div>
      </div>

      {/* 빨간칩 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border-2 border-red-300 dark:border-red-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔴</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">빨간칩</span>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{redChips}개</div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">충전 구매 칩</div>
        <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
          <span>♾️</span>
          {redChips > 0 ? `${redChipExpiry}까지` : '충전 필요'}
        </div>
      </div>

      {/* 사용 순서 안내 */}
      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-600 dark:border-blue-400">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            💡 사용 순서
          </span>
        </div>
        <div className="text-sm text-blue-800 dark:text-blue-200">파란칩 먼저 → 빨간칩 나중에</div>
      </div>

      {/* 칩 부족 경고 */}
      {totalChips < 5 && (
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
              ⚠️ 칩 부족 알림
            </span>
          </div>
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            칩이 {totalChips}개 남았습니다. 충전을 권장합니다.
          </div>
        </div>
      )}
    </div>
  );
};
