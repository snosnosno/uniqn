/**
 * 출석 페이지 (v2.0 - Staff-based QR 시스템)
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 변경사항:
 * - Staff-based QR 시스템으로 전환
 * - 스태프 고유 QR 코드 표시
 * - 3분 자동 갱신 카운트다운
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { StaffQRDisplay } from '../components/qr/StaffQRDisplay';
import { logger } from '../utils/logger';

const AttendancePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  // 성능 최적화 로그
  useEffect(() => {
    logger.info('AttendancePage 마운트 (Staff QR 시스템)', {
      component: 'AttendancePage',
      data: {
        userId: currentUser?.uid
      }
    });
  }, [currentUser?.uid]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300">{t('common.pleaseLogin', '로그인이 필요합니다.')}</p>
      </div>
    );
  }

  // displayName에서 실제 이름만 추출 (JSON 부분 제거)
  const extractUserName = (displayName: string | null | undefined): string => {
    if (!displayName) return 'Unknown';
    // "[{...}]" 패턴이 있으면 제거
    const cleanName = displayName.replace(/\s*\[.*\]$/, '').trim();
    return cleanName || 'Unknown';
  };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 text-center">
          {t('attendancePage.title', '내 QR 출석')}
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          {t('attendancePage.subtitle', '매니저에게 QR 코드를 보여주세요')}
        </p>

        {/* 스태프 QR 표시 */}
        <StaffQRDisplay
          userId={currentUser.uid}
          userName={extractUserName(currentUser.displayName) || currentUser.email || 'Unknown'}
          autoRefresh
        />
      </div>
    </div>
  );
};

export default AttendancePage;
