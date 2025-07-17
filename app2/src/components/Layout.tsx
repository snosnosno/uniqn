import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { IconType } from 'react-icons';
import { 
    FaTachometerAlt, FaUsers, FaTable, FaClock, 
    FaTrophy, FaBullhorn, FaHistory, FaUserCircle, FaUserShield, FaFileInvoice, FaClipboardList, FaQrcode,
    FaChevronLeft, FaChevronRight, FaCalendarAlt, FaClipboardCheck, FaSignOutAlt, FaUserCheck
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext'; 
import { useTranslation } from 'react-i18next';

interface NavItemProps {
    to: string;
    label: string;
    Icon: IconType;
    isOpen: boolean;
}

const NavItem = ({ to, label, Icon, isOpen }: NavItemProps) => {
    const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
      `flex items-center p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'} ${isOpen ? 'justify-start' : 'justify-center'}`;
  
    return (
      <NavLink to={to} className={navLinkClasses}>
        <span className="text-lg"><Icon /></span>
        <span className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}>{label}</span>
      </NavLink>
    );
};

export const Layout = () => {
  const { t, i18n } = useTranslation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { isAdmin, role, currentUser, signOut } = useAuth(); // Get role for conditional rendering
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      <aside className={`bg-white shadow-lg flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-4 border-b border-gray-200 flex items-start justify-between">
          <div className={`overflow-hidden transition-all duration-200 ${isSidebarOpen ? 'w-full' : 'w-0'}`}>
            <h1 className="text-2xl font-bold text-gray-800 whitespace-nowrap">{t('layout.title')}</h1>
            <p className="text-sm text-gray-500 whitespace-nowrap">{t('layout.subtitle')}</p>
          </div>
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>
        
        {/* Navigation Menu */}
        <nav className="mt-5 flex-1 px-2 space-y-2">
            <NavItem to={isAdmin ? "/admin/dashboard" : "/profile"} label={t('nav.dashboard')} Icon={FaTachometerAlt} isOpen={isSidebarOpen} />
            <NavItem to="/jobs" label={t('nav.jobBoard')} Icon={FaClipboardList} isOpen={isSidebarOpen} />
            <NavItem to="/profile" label={t('nav.myProfile')} Icon={FaUserCircle} isOpen={isSidebarOpen} />
            {/* 딜러 가능시간 페이지 숨김 처리 */}
            {/* {!isAdmin && <NavItem to="/available-times" label={t('nav.myAvailability')} Icon={FaCalendarAlt} isOpen={isSidebarOpen} />} */}
                        <NavItem to="/attendance" label={t('nav.attendance')} Icon={FaQrcode} isOpen={isSidebarOpen} />
            <hr className="my-2 border-t border-gray-200" />
            
            {/* Admin and Manager common menus */}
            {isAdmin && (
              <>
                
                <NavItem to="/admin/staff" label={t('nav.staffManagement')} Icon={FaUserShield} isOpen={isSidebarOpen} />
                <NavItem to="/admin/job-postings" label={t('nav.managePostings')} Icon={FaFileInvoice} isOpen={isSidebarOpen} />
                <NavItem to="/admin/shift-schedule" label={t('nav.shiftSchedule')} Icon={FaClock} isOpen={isSidebarOpen} />
                <NavItem to="/admin/payroll" label={t('nav.processPayroll')} Icon={FaFileInvoice} isOpen={isSidebarOpen} />
                <hr className="my-2 border-t border-gray-200" />
                {/* 참가자, 블라인드, 기록 페이지 숨김 처리 */}
                {/* <NavItem to="/admin/participants" label={t('nav.participants')} Icon={FaUsers} isOpen={isSidebarOpen} /> */}
                <NavItem to="/admin/tables" label={t('nav.tables')} Icon={FaTable} isOpen={isSidebarOpen} />
                {/* <NavItem to="/admin/blinds" label={t('nav.blinds')} Icon={FaClock} isOpen={isSidebarOpen} /> */}
                <NavItem to="/admin/prizes" label={t('nav.prizes')} Icon={FaTrophy} isOpen={isSidebarOpen} />
                <NavItem to="/admin/announcements" label={t('nav.announcements')} Icon={FaBullhorn} isOpen={isSidebarOpen} />
                {/* <NavItem to="/admin/history" label={t('nav.history')} Icon={FaHistory} isOpen={isSidebarOpen} /> */}
              </>
            )}

            {/* Admin only menu */}
            {role === 'admin' && (
              <>
                <NavItem to="/admin/user-management" label={t('nav.userManagement')} Icon={FaUsers} isOpen={isSidebarOpen} />
                <NavItem to="/admin/approvals" label={t('nav.approvals')} Icon={FaUserCheck} isOpen={isSidebarOpen} />
              </>
            )}
        </nav>
        
        {/* User/Logout Section */}
        <div className="p-2 border-t border-gray-200">
          <div className="p-2">
            <select 
              className={`w-full p-2 rounded-lg text-gray-600 bg-white border border-gray-300 transition-colors hover:bg-gray-50 ${isSidebarOpen ? '' : 'text-center'}`}
              onChange={handleLanguageChange}
              value={i18n.language}
            >
              <option value="en">English</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center p-2 rounded-lg transition-colors text-red-600 hover:bg-red-100 ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}
          >
            <span className="text-lg"><FaSignOutAlt /></span>
                        <span className={`ml-3 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 w-0'}`}>{t('nav.logout')}</span>
          </button>
        </div>

      </aside>
      <main className="flex-1 p-8 overflow-y-auto bg-gray-100">
        <React.Suspense fallback={<div>{t('layout.loading')}</div>}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
};

export default Layout;
