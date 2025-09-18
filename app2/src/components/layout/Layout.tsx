import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { FaQrcode } from '../Icons/ReactIconsReplacement';
import { useMediaQuery } from '../../hooks/useMediaQuery';

import HeaderMenu from './HeaderMenu';

export const Layout = memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleAttendanceClick = () => {
    navigate('/app/attendance');
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-6 py-3 h-16">
          {/* 로고 및 제목 */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
              <h1 className="text-xl font-bold text-gray-800">{t('layout.title', 'T-HOLDEM')}</h1>
              <span className="ml-2 text-sm text-gray-500 hidden sm:inline">{t('layout.subtitle', 'Tournament Management System')}</span>
            </Link>
          </div>
          
          {/* 헤더 버튼들 */}
          <div className="flex items-center gap-2">
            {/* 출석체크 버튼 */}
            <button
              onClick={handleAttendanceClick}
              className={`flex items-center justify-center rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isMobile ? 'p-3 w-12 h-12' : 'p-2 w-10 h-10'
              }`}
              aria-label={t('nav.attendance', 'Attendance')}
              title={t('nav.attendance', 'Attendance')}
              style={{ minWidth: isMobile ? '48px' : '40px', minHeight: isMobile ? '48px' : '40px' }}
            >
              <FaQrcode className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
            </button>
            
            {/* 헤더 메뉴 */}
            <HeaderMenu />
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="pt-16 px-1 sm:px-4 md:px-6 lg:px-8 pb-3 sm:pb-4 md:pb-6 lg:pb-8 overflow-y-auto bg-gray-100">
        <React.Suspense fallback={<div>{t('layout.loading', 'Loading...')}</div>}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
});

export default Layout;
