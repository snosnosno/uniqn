import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaSignOutAlt, FaTrophy } from '../Icons/ReactIconsReplacement';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePermissions } from '../../hooks/usePermissions';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { ThemeToggle } from '../ThemeToggle';
import {
  BASE_MENU,
  CUSTOMER_CENTER_MENU,
  PAYMENT_MENU,
  AUTH_MENU,
  TOURNAMENT_BASE_ITEMS,
  TOURNAMENT_ADMIN_ITEMS,
  ADMIN_MENU,
  ADMIN_PAYMENT_MENU,
  type MenuItem,
  type MenuGroup,
} from './menuConfig';
import { FEATURE_FLAGS } from '../../config/features';

// ============================================
// Sub Components
// ============================================

interface NavItemProps {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onNavigate?: () => void;
}

const NavItem = memo(({ to, label, Icon, isOpen, onNavigate }: NavItemProps) => {
  const isSmall = useMediaQuery('(max-width: 480px)');
  const isMedium = useMediaQuery('(max-width: 768px)');

  const navLinkClasses = useCallback(
    ({ isActive }: { isActive: boolean }) =>
      `flex items-center rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 dark:bg-blue-700 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${isOpen ? 'justify-start' : 'justify-center'} ${
        isSmall ? 'p-4 text-lg' : isMedium ? 'p-3 text-base' : 'p-2 text-sm'
      }`,
    [isOpen, isSmall, isMedium]
  );

  return (
    <NavLink to={to} className={navLinkClasses} onClick={onNavigate}>
      <Icon className={isSmall ? 'w-6 h-6' : isMedium ? 'w-5 h-5' : 'w-5 h-5'} />
      <span
        className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}
      >
        {label}
      </span>
    </NavLink>
  );
});

interface NavDropdownProps {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  onNavigate?: () => void;
  t: (key: string, defaultValue: string) => string;
}

const NavDropdown = memo(({ label, Icon, items, onNavigate, t }: NavDropdownProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSmall = useMediaQuery('(max-width: 480px)');
  const isMedium = useMediaQuery('(max-width: 768px)');

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 ${
          isSmall ? 'p-4 text-lg' : isMedium ? 'p-3 text-base' : 'p-2 text-sm'
        }`}
      >
        <div className="flex items-center">
          <Icon className={isSmall ? 'w-6 h-6' : isMedium ? 'w-5 h-5' : 'w-5 h-5'} />
          <span className="ml-3">{label}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div
          className={`ml-4 mt-1 space-y-1 ${isSmall ? 'pl-4' : isMedium ? 'pl-3' : 'pl-2'} border-l-2 border-gray-300 dark:border-gray-600`}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                } ${isSmall ? 'p-3 text-base' : isMedium ? 'p-2.5 text-sm' : 'p-2 text-sm'}`
              }
              onClick={onNavigate}
            >
              <item.Icon className={isSmall ? 'w-5 h-5' : 'w-4 h-4'} />
              <span className="ml-2">{t(item.labelKey, item.labelDefault)}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
});

// 메뉴 섹션 구분선
const MenuDivider = memo(() => (
  <hr className="my-2 border-t border-gray-200 dark:border-gray-700" />
));

// 메뉴 그룹 렌더링 컴포넌트
interface MenuGroupRendererProps {
  group: MenuGroup;
  t: (key: string, defaultValue: string) => string;
  onNavigate: () => void;
}

const MenuGroupRenderer = memo(({ group, t, onNavigate }: MenuGroupRendererProps) => {
  if (group.type === 'dropdown' && group.items && group.Icon) {
    return (
      <NavDropdown
        label={t(group.labelKey || '', group.labelDefault || '')}
        Icon={group.Icon}
        items={group.items}
        onNavigate={onNavigate}
        t={t}
      />
    );
  }

  if (group.type === 'item' && group.to && group.Icon) {
    return (
      <NavItem
        to={group.to}
        label={t(group.labelKey || '', group.labelDefault || '')}
        Icon={group.Icon}
        isOpen={true}
        onNavigate={onNavigate}
      />
    );
  }

  return null;
});

// ============================================
// Main Component
// ============================================

export const HeaderMenu: React.FC = () => {
  const { t, i18n, ready } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAdmin, role, signOut, currentUser, loading: authLoading } = useAuth();
  const { canManageApplicants, permissions } = usePermissions();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // 반응형 브레이크포인트
  const isSmall = useMediaQuery('(max-width: 480px)');
  const isMedium = useMediaQuery('(max-width: 768px)');
  const isLarge = useMediaQuery('(max-width: 1024px)');

  // 권한 디버깅 로그
  useEffect(() => {
    logger.info('HeaderMenu 권한 상태', {
      component: 'HeaderMenu',
      data: {
        currentUser: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
        role,
        isAdmin,
        canManageApplicants,
        permissions: permissions ? { role: permissions.role } : null,
        authLoading,
        i18nReady: ready,
      },
    });
  }, [currentUser, role, isAdmin, canManageApplicants, permissions, authLoading, ready]);

  // 토너먼트 메뉴 아이템 (역할에 따라 동적 생성)
  const tournamentItems = useMemo(() => {
    const items = [...TOURNAMENT_BASE_ITEMS];
    if (role === 'admin' || role === 'employer') {
      items.push(...TOURNAMENT_ADMIN_ITEMS);
    }
    return items;
  }, [role]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      logger.error('Failed to log out', error instanceof Error ? error : new Error(String(error)), {
        component: 'HeaderMenu',
      });
    }
  }, [signOut, navigate]);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      i18n.changeLanguage(e.target.value);
    },
    [i18n]
  );

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC 키로 메뉴 닫기
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <ThemeToggle />

      {currentUser && !authLoading && <NotificationDropdown />}

      {/* 햄버거 메뉴 버튼 */}
      <button
        onClick={toggleMenu}
        className={`flex items-center justify-center rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isSmall ? 'p-3 w-12 h-12' : isMedium ? 'p-2.5 w-11 h-11' : 'p-2 w-10 h-10'
        }`}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        style={{
          minWidth: isSmall ? '48px' : isMedium ? '44px' : '40px',
          minHeight: isSmall ? '48px' : isMedium ? '44px' : '40px',
        }}
      >
        <svg
          className={isSmall ? 'w-6 h-6' : isMedium ? 'w-5.5 h-5.5' : 'w-5 h-5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />

          <div
            className={
              isSmall
                ? 'fixed inset-0 bg-white dark:bg-gray-800 z-50 flex flex-col'
                : isMedium
                  ? 'fixed inset-x-4 top-16 bottom-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 flex flex-col'
                  : isLarge
                    ? 'absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-72 max-h-[calc(100vh-100px)] flex flex-col'
                    : 'absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 w-80 max-h-[calc(100vh-100px)] flex flex-col'
            }
          >
            {/* 메뉴 헤더 */}
            <div
              className={`border-b border-gray-200 dark:border-gray-700 ${
                isSmall ? 'p-6' : isMedium ? 'p-5' : 'p-4'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className={`font-semibold text-gray-800 dark:text-gray-50 ${
                      isSmall ? 'text-2xl' : isMedium ? 'text-xl' : 'text-lg'
                    }`}
                  >
                    {t('layout.title', 'UNIQN')}
                  </h2>
                  <p
                    className={`text-gray-500 dark:text-gray-400 ${
                      isSmall ? 'text-base' : isMedium ? 'text-sm' : 'text-sm'
                    }`}
                  >
                    {t('layout.subtitle', 'Tournament Management System')}
                  </p>
                </div>
                {isMedium && (
                  <button
                    onClick={closeMenu}
                    className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close menu"
                  >
                    <span className={isSmall ? 'text-2xl' : 'text-xl'}>×</span>
                  </button>
                )}
              </div>
            </div>

            {/* 네비게이션 메뉴 */}
            <nav
              className={`space-y-1 flex-1 overflow-y-auto ${
                isSmall ? 'p-6' : isMedium ? 'p-4' : 'p-2'
              }`}
            >
              {/* 기본 메뉴 */}
              {BASE_MENU.map((group) => (
                <MenuGroupRenderer key={group.id} group={group} t={t} onNavigate={closeMenu} />
              ))}

              {/* 고객 센터 */}
              <MenuDivider />
              <MenuGroupRenderer group={CUSTOMER_CENTER_MENU} t={t} onNavigate={closeMenu} />

              {/* 결제 및 칩 관리 */}
              <MenuDivider />
              <MenuGroupRenderer group={PAYMENT_MENU} t={t} onNavigate={closeMenu} />

              {/* 인증된 사용자 메뉴 */}
              {!authLoading && currentUser && (
                <>
                  <MenuDivider />
                  <MenuGroupRenderer group={AUTH_MENU} t={t} onNavigate={closeMenu} />

                  {/* 토너먼트 관리 (Feature Flag로 제어) */}
                  {FEATURE_FLAGS.TOURNAMENTS && (
                    <>
                      <MenuDivider />
                      <NavDropdown
                        label={t('nav.tournamentManagement', '토너먼트 관리')}
                        Icon={FaTrophy}
                        items={tournamentItems}
                        onNavigate={closeMenu}
                        t={t}
                      />
                    </>
                  )}

                  {/* Admin 전용 메뉴 */}
                  {role === 'admin' && (
                    <>
                      <MenuDivider />
                      {ADMIN_MENU.map((group) => (
                        <MenuGroupRenderer
                          key={group.id}
                          group={group}
                          t={t}
                          onNavigate={closeMenu}
                        />
                      ))}

                      <MenuDivider />
                      <MenuGroupRenderer group={ADMIN_PAYMENT_MENU} t={t} onNavigate={closeMenu} />
                    </>
                  )}
                </>
              )}

              {/* 로딩 상태 */}
              {authLoading && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {t('common.checkingPermissions', '권한 확인 중...')}
                </div>
              )}

              {/* 인증되지 않은 상태 */}
              {!authLoading && !currentUser && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  {t('auth.loginRequired', '로그인이 필요합니다')}
                </div>
              )}
            </nav>

            {/* 사용자 섹션 */}
            <div
              className={`border-t border-gray-200 dark:border-gray-700 space-y-2 ${
                isSmall ? 'p-6' : isMedium ? 'p-4' : 'p-2'
              }`}
            >
              <select
                className="w-full p-2 rounded-lg text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                onChange={handleLanguageChange}
                value={i18n.language}
              >
                <option value="en">English</option>
                <option value="ko">한국어</option>
              </select>

              <button
                onClick={handleLogout}
                className="w-full flex items-center p-2 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 justify-start"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="ml-3">{t('nav.logout', 'Logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HeaderMenu;
