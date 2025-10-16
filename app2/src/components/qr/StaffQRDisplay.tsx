/**
 * 스태프 QR 표시 컴포넌트
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 스태프 고유 QR 코드 표시
 * - 3분 자동 갱신 카운트다운
 * - QR 재생성 기능
 * - 사용 통계 표시
 */

import React, { useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useStaffQR } from '../../hooks/useStaffQR';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface StaffQRDisplayProps {
  userId: string;
  userName: string;
  autoRefresh?: boolean;
}

/**
 * 스태프 QR 표시 컴포넌트
 */
export const StaffQRDisplay: React.FC<StaffQRDisplayProps> = ({
  userId,
  userName,
  autoRefresh = true
}) => {
  const {
    qrMetadata,
    qrString,
    loading,
    error,
    regenerate,
    refresh,
    remainingSeconds
  } = useStaffQR({ userId, userName, autoRefresh });

  /**
   * QR 재생성 핸들러
   */
  const handleRegenerate = useCallback(async () => {
    try {
      await regenerate();
      logger.info('QR 재생성 완료', { data: { userId, userName } });
      toast.success('QR 코드가 재생성되었습니다. 기존 QR 코드는 사용할 수 없습니다.');
    } catch (err) {
      logger.error('QR 재생성 실패', err as Error, { data: { userId } });
      toast.error('QR 코드 재생성에 실패했습니다.');
    }
  }, [regenerate, userId, userName]);

  /**
   * QR 새로고침 핸들러
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      logger.info('QR 새로고침 완료', { data: { userId, userName } });
    } catch (err) {
      logger.error('QR 새로고침 실패', err as Error, { data: { userId } });
    }
  }, [refresh, userId, userName]);

  /**
   * 카운트다운 포맷팅 (MM:SS)
   */
  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  /**
   * 로딩 상태
   */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="text-gray-600">QR 코드를 생성하는 중...</p>
      </div>
    );
  }

  /**
   * 에러 상태
   */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="text-red-600 text-center">
          <svg
            className="h-12 w-12 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-semibold">QR 코드 생성 실패</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  /**
   * QR 표시
   */
  if (!qrString || !qrMetadata) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-gray-600">QR 코드를 불러올 수 없습니다.</p>
        <button
          onClick={handleRefresh}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 py-6 px-4">
      {/* QR 코드 */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <QRCodeCanvas
          value={qrString}
          size={280}
          level="H"
          includeMargin
        />
      </div>

      {/* 카운트다운 */}
      <div className="flex flex-col items-center space-y-2">
        <div
          className={`text-4xl font-bold font-mono ${
            remainingSeconds <= 30
              ? 'text-red-600 animate-pulse'
              : remainingSeconds <= 60
              ? 'text-orange-600'
              : 'text-blue-600'
          }`}
        >
          {formatCountdown(remainingSeconds)}
        </div>
        <p className="text-sm text-gray-500">
          {remainingSeconds <= 30
            ? '곧 QR이 자동으로 갱신됩니다'
            : 'QR 유효 시간'}
        </p>
      </div>

      {/* 사용자 정보 */}
      <div className="w-full max-w-md bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm">이름</span>
          <span className="font-semibold">{userName}</span>
        </div>

        {qrMetadata.lastUsedAt && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">마지막 사용</span>
            <span className="font-semibold text-sm">
              {new Date(qrMetadata.lastUsedAt.toMillis()).toLocaleString('ko-KR')}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-gray-600 text-sm">총 스캔 횟수</span>
          <span className="font-semibold">{qrMetadata.totalScanCount}회</span>
        </div>

        {qrMetadata.regenerationCount > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">재생성 횟수</span>
            <span className="font-semibold">{qrMetadata.regenerationCount}회</span>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={handleRefresh}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          즉시 갱신
        </button>
        <button
          onClick={handleRegenerate}
          className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          QR 재발급
        </button>
      </div>

      {/* 안내 문구 */}
      <div className="w-full max-w-md bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex items-start space-x-2">
          <svg
            className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">QR 출석 체크 방법</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>매니저에게 QR 코드를 보여주세요</li>
              <li>QR은 3분마다 자동으로 갱신됩니다</li>
              <li>타인에게 QR을 공유하지 마세요</li>
              <li>보안을 위해 정기적으로 재발급하세요</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffQRDisplay;
