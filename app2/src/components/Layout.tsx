import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import HeaderMenu from './HeaderMenu';

export const Layout = memo(() => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50">
        <div className="flex items-center justify-between px-4 py-3 h-16">
          {/* 로고 및 제목 */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">{t('layout.title', 'T-HOLDEM')}</h1>
            <span className="ml-2 text-sm text-gray-500 hidden sm:inline">{t('layout.subtitle', 'Tournament Management System')}</span>
          </div>
          
          {/* 헤더 메뉴 */}
          <HeaderMenu />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="pt-16 p-8 overflow-y-auto bg-gray-100">
        <React.Suspense fallback={<div>{t('layout.loading', 'Loading...')}</div>}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
});

export default Layout;
