import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { useAuth } from '../../contexts/AuthContext';
import { FEATURE_FLAGS, FeatureFlag } from '../../config/features';
import { getUserDisplayName, getUserInitial } from '../../utils/userUtils';
import BottomTabBar from './BottomTabBar';
import MobileMenu from './MobileMenu';

interface NavItem {
  path: string;
  label: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  featureFlag?: FeatureFlag;
}

/**
 * 반응형 네비게이션 컴포넌트
 * 화면 크기에 따라 적절한 네비게이션 UI 제공
 */
const ResponsiveNav: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { currentUser, role } = useAuth();
  const location = useLocation();

  const isAdmin = role === 'admin' || role === 'ceo';

  // 데스크톱 네비게이션 아이템
  const desktopNavItems: NavItem[] = [
    { path: '/', label: '홈' },
    { path: '/app/tournaments', label: '토너먼트', requiresAuth: true, featureFlag: 'TOURNAMENTS' },
    {
      path: '/app/participants',
      label: '참가자',
      requiresAuth: true,
      adminOnly: true,
      featureFlag: 'PARTICIPANTS',
    },
    { path: '/app/tables', label: '테이블', requiresAuth: true, featureFlag: 'TABLES' },
    { path: '/app/jobs', label: '구인구직' },
    { path: '/app/schedule', label: '스케줄', requiresAuth: true },
    { path: '/app/admin', label: '관리자', adminOnly: true },
  ];

  const filteredNavItems = desktopNavItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiresAuth && !currentUser) return false;
    if (item.featureFlag && !FEATURE_FLAGS[item.featureFlag]) return false;
    return true;
  });

  return (
    <>
      {/* 상단 헤더 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 로고 및 햄버거 메뉴 */}
            <div className="flex items-center">
              {(isMobile || isTablet) && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 mr-3"
                  aria-label="메뉴 열기"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              )}

              <Link to="/" className="flex items-center space-x-2">
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  UNIQN
                </span>
              </Link>
            </div>

            {/* 데스크톱 네비게이션 */}
            {isDesktop && (
              <nav className="hidden lg:flex space-x-1">
                {filteredNavItems.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        px-3 py-2 rounded-md text-base font-medium transition-colors
                        ${
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* 사용자 메뉴 */}
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <div className="flex items-center space-x-3">
                  <Link
                    to="/app/profile"
                    className="flex items-center space-x-2 text-base text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-medium">
                      {getUserInitial(currentUser.displayName, currentUser.email)}
                    </div>
                    {isDesktop && (
                      <span className="font-medium">
                        {getUserDisplayName(currentUser.displayName, currentUser.email)}
                      </span>
                    )}
                  </Link>
                </div>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">
                  로그인
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 슬라이드 메뉴 */}
      {(isMobile || isTablet) && (
        <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      )}

      {/* 모바일 하단 탭바 */}
      {isMobile && <BottomTabBar />}
    </>
  );
};

export default ResponsiveNav;
