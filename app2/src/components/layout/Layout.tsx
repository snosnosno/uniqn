/**
 * 메인 레이아웃 컴포넌트
 *
 * @description
 * 앱의 기본 레이아웃 구조를 정의
 * - 헤더 (고정)
 * - 공지사항 배너 (조건부)
 * - 패널티 경고 배너 (조건부)
 * - 메인 콘텐츠
 *
 * @version 2.0.0
 * @since 2025-12-10
 */

import React, { memo, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { FaQrcode } from '../Icons/ReactIconsReplacement';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import { useAnnouncementBanner } from '../../hooks/useAnnouncementBanner';
import { getActiveWarningPenalty } from '../../services/penaltyService';
import type { Penalty } from '../../types/penalty';
import PenaltyWarningBanner from '../banners/PenaltyWarningBanner';
import AnnouncementBanner from '../banners/AnnouncementBanner';
import HeaderMenu from './HeaderMenu';

export const Layout = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { currentUser } = useAuth();
  const [activeWarning, setActiveWarning] = useState<Penalty | null>(null);

  // 공지사항 배너 데이터
  const { bannerAnnouncements } = useSystemAnnouncements();

  // 배너 상태 관리
  const { currentBanner, dismissBanner, availableBannerCount } =
    useAnnouncementBanner(bannerAnnouncements);

  // 활성 경고 패널티 확인
  useEffect(() => {
    const checkWarningPenalty = async () => {
      if (!currentUser?.uid) {
        setActiveWarning(null);
        return;
      }

      try {
        const warning = await getActiveWarningPenalty(currentUser.uid);
        setActiveWarning(warning);
      } catch {
        // 에러 시 조용히 무시 (사용자 경험 우선)
        setActiveWarning(null);
      }
    };

    checkWarningPenalty();
  }, [currentUser?.uid]);

  const handleAttendanceClick = () => {
    navigate('/app/attendance');
  };

  /**
   * 배너 닫기 (다음 배너로 이동)
   */
  const handleBannerDismiss = () => {
    dismissBanner(false);
  };

  /**
   * "오늘 하루 보지 않기"
   */
  const handleBannerHideForToday = () => {
    dismissBanner(true);
  };

  /**
   * 콘텐츠 상단 여백 계산
   * - 기본: 헤더(64px) + 패딩(8px) = 72px (pt-18)
   * - 배너 있을 때: 헤더(64px) + 배너(~56px) + 패딩(8px) = ~128px (pt-32)
   * - 경고 있을 때: 헤더(64px) + 경고(~48px) + 패딩(8px) = ~120px (pt-30)
   * - 둘 다 있을 때: 헤더(64px) + 배너(~56px) + 경고(~48px) + 패딩(8px) = ~176px (pt-44)
   */
  const contentPaddingTop = useMemo(() => {
    const hasBanner = !!currentBanner;
    const hasWarning = !!activeWarning;

    if (hasBanner && hasWarning) {
      return 'pt-44'; // 176px
    }
    if (hasBanner) {
      return 'pt-32'; // 128px
    }
    if (hasWarning) {
      return 'pt-28'; // 112px
    }
    return 'pt-18'; // 72px (기본)
  }, [currentBanner, activeWarning]);

  /**
   * 경고 배너 위치 계산
   * - 배너가 있으면 배너 아래
   * - 배너가 없으면 헤더 바로 아래
   */
  const warningBannerTop = currentBanner ? 'top-[120px]' : 'top-16';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-50 font-sans safe-area-all transition-colors duration-200">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg z-50 header-safe border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-6 py-3 h-16">
          {/* 로고 및 제목 */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-50">
                {t('layout.title', 'UNIQN')}
              </h1>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                {t('layout.subtitle', 'Tournament Management System')}
              </span>
            </Link>
          </div>

          {/* 헤더 버튼들 */}
          <div className="flex items-center gap-2">
            {/* 출석체크 버튼 */}
            <button
              onClick={handleAttendanceClick}
              className={`flex items-center justify-center rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isMobile ? 'p-3 w-12 h-12' : 'p-2 w-10 h-10'
              }`}
              aria-label={t('nav.attendance', 'Attendance')}
              title={t('nav.attendance', 'Attendance')}
              style={{
                minWidth: isMobile ? '48px' : '40px',
                minHeight: isMobile ? '48px' : '40px',
              }}
            >
              <FaQrcode className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
            </button>

            {/* 헤더 메뉴 */}
            <HeaderMenu />
          </div>
        </div>
      </header>

      {/* 공지사항 배너 */}
      {currentBanner && (
        <div className="fixed top-16 left-0 right-0 z-40">
          <AnnouncementBanner
            announcement={currentBanner}
            onDismiss={handleBannerDismiss}
            onHideForToday={handleBannerHideForToday}
            remainingCount={availableBannerCount - 1}
          />
        </div>
      )}

      {/* 패널티 경고 배너 */}
      {activeWarning && (
        <div className={`fixed ${warningBannerTop} left-0 right-0 z-40`}>
          <PenaltyWarningBanner penalty={activeWarning} onDismiss={() => setActiveWarning(null)} />
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <main
        className={`content-safe px-1 sm:px-4 md:px-6 lg:px-8 pb-3 sm:pb-4 md:pb-6 lg:pb-8 overflow-y-auto bg-gray-100 dark:bg-gray-900 ${contentPaddingTop}`}
      >
        <React.Suspense
          fallback={
            <div className="text-gray-700 dark:text-gray-300">{t('common.messages.loading')}</div>
          }
        >
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
});

export default Layout;
