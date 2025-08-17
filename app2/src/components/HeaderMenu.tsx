import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { 
    FaTachometerAlt, FaUsers, FaTable, FaClock, 
    FaTrophy, FaUserCircle, FaFileInvoice, FaClipboardList, FaQrcode,
    FaSignOutAlt, FaUserCheck, FaCalendarAlt
} from './Icons/ReactIconsReplacement';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePermissions } from '../hooks/usePermissions';

interface NavItemProps {
    to: string;
    label: string;
    Icon: React.ComponentType<any>;
    isOpen: boolean;
    onNavigate?: () => void;
}

const NavItem = memo(({ to, label, Icon, isOpen, onNavigate }: NavItemProps) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    const navLinkClasses = useCallback(({ isActive }: { isActive: boolean }) =>
      `flex items-center rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'} ${isOpen ? 'justify-start' : 'justify-center'} ${
        isMobile ? 'p-4 text-lg' : 'p-2'
      }`, [isOpen, isMobile]);
  
    return (
      <NavLink to={to} className={navLinkClasses} onClick={onNavigate}>
        <Icon className={isMobile ? 'w-6 h-6' : 'w-5 h-5'} />
        <span className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}>{label}</span>
      </NavLink>
    );
});

export const HeaderMenu: React.FC = () => {
  const { t, i18n, ready } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAdmin, role, signOut, currentUser, loading: authLoading } = useAuth();
  const { canManageApplicants, permissions } = usePermissions();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 권한 디버깅을 위한 로그
  React.useEffect(() => {
    logger.info('HeaderMenu 권한 상태', { 
      component: 'HeaderMenu',
      data: { 
        currentUser: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
        role,
        isAdmin,
        canManageApplicants,
        permissions: permissions ? { role: permissions.role } : null,
        authLoading,
        i18nReady: ready
      }
    });
  }, [currentUser, role, isAdmin, canManageApplicants, permissions, authLoading, ready]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      logger.error('Failed to log out', error instanceof Error ? error : new Error(String(error)), { component: 'HeaderMenu' });
    }
  }, [signOut, navigate]);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  }, [i18n]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ESC 키로 메뉴 닫기
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <div className="relative flex items-center" ref={menuRef}>
      {/* 햄버거 메뉴 버튼 */}
      <button
        onClick={toggleMenu}
        className={`flex items-center justify-center rounded-lg border-2 border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          isMobile ? 'p-3 w-12 h-12' : 'p-2 w-10 h-10'
        }`}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        style={{ minWidth: isMobile ? '48px' : '40px', minHeight: isMobile ? '48px' : '40px' }}
      >
        <svg 
          className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {isMenuOpen ? <>
          {/* 외부 클릭 감지를 위한 오버레이 */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* 메뉴 컨테이너 */}
          <div className={`
            ${isMobile 
              ? 'fixed inset-0 bg-white z-50 flex flex-col' 
              : 'absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-64 w-64'
            }
          `}>
            {/* 메뉴 헤더 */}
            <div className={`border-b border-gray-200 ${isMobile ? 'p-6' : 'p-4'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`font-semibold text-gray-800 ${isMobile ? 'text-2xl' : 'text-lg'}`}>{t('layout.title', 'T-HOLDEM')}</h2>
                  <p className={`text-gray-500 ${isMobile ? 'text-base' : 'text-sm'}`}>{t('layout.subtitle', 'Tournament Management System')}</p>
                </div>
                {isMobile ? <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                    aria-label="Close menu"
                  >
                    <span className="text-2xl">×</span>
                  </button> : null}
              </div>
            </div>

            {/* 네비게이션 메뉴 */}
            <nav className={`space-y-1 flex-1 ${isMobile ? 'p-6 overflow-y-auto' : 'p-2'}`}>
              {/* 기본 메뉴 (모든 사용자) */}
              <NavItem to={isAdmin ? "/admin/dashboard" : "/profile"} label={t('nav.dashboard', 'Dashboard')} Icon={FaTachometerAlt} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/profile" label={t('nav.myProfile', 'My Profile')} Icon={FaUserCircle} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/jobs" label={t('nav.jobBoard', 'Job Board')} Icon={FaClipboardList} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/my-schedule" label="내 스케줄" Icon={FaCalendarAlt} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/attendance" label={t('nav.attendance', 'Attendance')} Icon={FaQrcode} isOpen={true} onNavigate={closeMenu} />
              
              {/* 로딩 상태가 아닐 때만 권한 기반 메뉴 표시 */}
              {!authLoading && currentUser && (
                <>
                  <hr className="my-2 border-t border-gray-200" />
                  
                  {/* Job Posting Management - 모든 역할에서 표시 (권한은 개별 확인) */}
                  <NavItem to="/admin/job-postings" label={t('nav.managePostings', 'Manage Postings')} Icon={FaFileInvoice} isOpen={true} onNavigate={closeMenu} />

                  {/* Admin and Manager 메뉴 */}
                  {(role === 'admin' || role === 'manager') && (
                    <>
                      <NavItem to="/admin/shift-schedule" label={t('nav.shiftSchedule', 'Shift Schedule')} Icon={FaClock} isOpen={true} onNavigate={closeMenu} />
                      <hr className="my-2 border-t border-gray-200" />
                      <NavItem to="/admin/participants" label="참가자 관리" Icon={FaUsers} isOpen={true} onNavigate={closeMenu} />
                      <NavItem to="/admin/tables" label={t('nav.tables', 'Tables')} Icon={FaTable} isOpen={true} onNavigate={closeMenu} />
                      <NavItem to="/admin/prizes" label={t('nav.prizes', 'Prizes')} Icon={FaTrophy} isOpen={true} onNavigate={closeMenu} />
                    </>
                  )}

                  {/* Admin 전용 메뉴 */}
                  {role === 'admin' && (
                    <>
                      <hr className="my-2 border-t border-gray-200" />
                      <NavItem to="/admin/ceo-dashboard" label={t('nav.ceoDashboard', 'CEO 대시보드')} Icon={FaTachometerAlt} isOpen={true} onNavigate={closeMenu} />
                      <NavItem to="/admin/user-management" label={t('nav.userManagement', 'User Management')} Icon={FaUsers} isOpen={true} onNavigate={closeMenu} />
                      <NavItem to="/admin/approvals" label={t('nav.approvals', 'Approvals')} Icon={FaUserCheck} isOpen={true} onNavigate={closeMenu} />
                    </>
                  )}
                </>
              )}

              {/* 로딩 상태 표시 */}
              {authLoading && (
                <div className="p-4 text-center text-gray-500">
                  권한 확인 중...
                </div>
              )}

              {/* 인증되지 않은 상태 */}
              {!authLoading && !currentUser && (
                <div className="p-4 text-center text-gray-500">
                  로그인이 필요합니다
                </div>
              )}
            </nav>

            {/* 사용자 섹션 */}
            <div className={`border-t border-gray-200 space-y-2 ${isMobile ? 'p-6' : 'p-2'}`}>
              {/* 언어 선택 */}
              <select 
                className="w-full p-2 rounded-lg text-gray-600 bg-white border border-gray-300 transition-colors hover:bg-gray-50 text-sm"
                onChange={handleLanguageChange}
                value={i18n.language}
              >
                <option value="en">English</option>
                <option value="ko">한국어</option>
              </select>
              
              {/* 로그아웃 버튼 */}
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center p-2 rounded-lg transition-colors text-red-600 hover:bg-red-100 justify-start"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="ml-3">{t('nav.logout', 'Logout')}</span>
              </button>
            </div>
          </div>
        </> : null}
    </div>
  );
};

export default HeaderMenu; 