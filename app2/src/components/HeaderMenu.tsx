import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconType } from 'react-icons';
import { 
    FaTachometerAlt, FaUsers, FaTable, FaClock, 
    FaTrophy, FaBullhorn, FaUserCircle, FaUserShield, FaFileInvoice, FaClipboardList, FaQrcode,
    FaBars, FaSignOutAlt, FaUserCheck
} from 'react-icons/fa';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface NavItemProps {
    to: string;
    label: string;
    Icon: IconType;
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
        <span className={isMobile ? 'text-2xl' : 'text-lg'}><Icon /></span>
        <span className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}>{label}</span>
      </NavLink>
    );
});

export const HeaderMenu: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAdmin, role, signOut } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
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
    <div className="relative" ref={menuRef}>
      {/* 햄버거 메뉴 버튼 */}
      <button
        onClick={toggleMenu}
        className={`rounded-lg text-gray-600 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isMobile ? 'p-3' : 'p-2'
        }`}
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
      >
        <FaBars className={`${isMobile ? 'text-2xl' : 'text-xl'}`} />
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
                  <h2 className={`font-semibold text-gray-800 ${isMobile ? 'text-2xl' : 'text-lg'}`}>{t('layout.title')}</h2>
                  <p className={`text-gray-500 ${isMobile ? 'text-base' : 'text-sm'}`}>{t('layout.subtitle')}</p>
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
              <NavItem to={isAdmin ? "/admin/dashboard" : "/profile"} label={t('nav.dashboard')} Icon={FaTachometerAlt} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/jobs" label={t('nav.jobBoard')} Icon={FaClipboardList} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/profile" label={t('nav.myProfile')} Icon={FaUserCircle} isOpen={true} onNavigate={closeMenu} />
              <NavItem to="/attendance" label={t('nav.attendance')} Icon={FaQrcode} isOpen={true} onNavigate={closeMenu} />
              
              <hr className="my-2 border-t border-gray-200" />
              
              {/* Admin and Manager common menus */}
              {isAdmin ? <>
                  <NavItem to="/admin/staff" label={t('nav.staffManagement')} Icon={FaUserShield} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/job-postings" label={t('nav.managePostings')} Icon={FaFileInvoice} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/shift-schedule" label={t('nav.shiftSchedule')} Icon={FaClock} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/payroll" label={t('nav.processPayroll')} Icon={FaFileInvoice} isOpen={true} onNavigate={closeMenu} />
                  <hr className="my-2 border-t border-gray-200" />
                  <NavItem to="/admin/tables" label={t('nav.tables')} Icon={FaTable} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/prizes" label={t('nav.prizes')} Icon={FaTrophy} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/announcements" label={t('nav.announcements')} Icon={FaBullhorn} isOpen={true} onNavigate={closeMenu} />
                </> : null}

              {/* Admin only menu */}
              {role === 'admin' && (
                <>
                  <NavItem to="/admin/user-management" label={t('nav.userManagement')} Icon={FaUsers} isOpen={true} onNavigate={closeMenu} />
                  <NavItem to="/admin/approvals" label={t('nav.approvals')} Icon={FaUserCheck} isOpen={true} onNavigate={closeMenu} />
                </>
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
                <span className="text-lg"><FaSignOutAlt /></span>
                <span className="ml-3">{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </> : null}
    </div>
  );
};

export default HeaderMenu; 