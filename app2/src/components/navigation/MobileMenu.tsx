import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSwipeGestureReact } from '../../hooks/useSwipeGesture';

interface MenuItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  children?: MenuItem[];
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 모바일 슬라이드 메뉴 컴포넌트
 * 햄버거 메뉴 클릭 시 좌측에서 슬라이드
 */
const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, signOut, role } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  const isAdmin = role === 'admin' || role === 'ceo';

  // 메뉴 아이템 정의
  const menuItems: MenuItem[] = [
    {
      path: '/',
      label: '홈',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
          />
        </svg>
      ),
    },
    {
      path: '/app/tables',
      label: '테이블 관리',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" 
          />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      path: '/app/participants',
      label: '참가자 관리',
      requiresAuth: true,
      adminOnly: true,
    },
    {
      path: '/app/jobs',
      label: '구인구직',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
          />
        </svg>
      ),
    },
    {
      path: '/app/schedule',
      label: '스케줄',
      requiresAuth: true,
    },
    {
      path: '/app/simple-payroll',
      label: '급여 조회',
      requiresAuth: true,
    },
    {
      path: '/app/admin',
      label: '관리자',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
          />
        </svg>
      ),
      adminOnly: true,
      children: [
        { path: '/app/admin/ceo-dashboard', label: 'CEO 대시보드', adminOnly: true },
        { path: '/app/admin/staff', label: '스태프 관리', adminOnly: true },
        { path: '/app/admin/job-postings', label: '구인공고 관리', adminOnly: true },
        { path: '/app/admin/users', label: '사용자 관리', adminOnly: true },
      ],
    },
  ];

  // 필터링된 메뉴 아이템
  const filteredMenuItems = menuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.requiresAuth && !currentUser) return false;
    if (item.children) {
      item.children = item.children.filter(child => {
        if (child.adminOnly && !isAdmin) return false;
        if (child.requiresAuth && !currentUser) return false;
        return true;
      });
    }
    return true;
  });

  // 스와이프로 메뉴 닫기
  const swipeGesture = useSwipeGestureReact({
    onSwipeLeft: onClose,
    minDistance: 50,
    threshold: 30,
  });

  // ESC 키로 메뉴 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleMenuClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    onClose();
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div 
        className={`
          fixed inset-0 bg-black transition-opacity duration-300 z-40
          ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />
      
      {/* 메뉴 패널 */}
      <div
        ref={menuRef}
        {...swipeGesture}
        className={`
          fixed top-0 left-0 h-full w-72 bg-white shadow-xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 헤더 */}
        <div className="bg-primary-500 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">T-HOLDEM</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-primary-600 rounded transition-colors"
              aria-label="메뉴 닫기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {currentUser && (
            <div className="text-base">
              <p className="font-medium">{currentUser.displayName || currentUser.email}</p>
              <p className="opacity-90 text-sm">{role}</p>
            </div>
          )}
        </div>
        
        {/* 메뉴 아이템 */}
        <nav className="flex-1 overflow-y-auto py-4">
          {filteredMenuItems.map((item) => (
            <div key={item.path}>
              <button
                onClick={() => item.children ? toggleExpanded(item.path) : handleMenuClick(item.path)}
                className={`
                  w-full flex items-center justify-between px-4 py-3
                  hover:bg-gray-50 transition-colors
                  ${location.pathname === item.path ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-500' : 'text-gray-700'}
                `}
              >
                <div className="flex items-center space-x-3">
                  {item.icon && <span>{item.icon}</span>}
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.children && (
                  <svg 
                    className={`w-4 h-4 transition-transform ${expandedItems.includes(item.path) ? 'rotate-90' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
              
              {/* 하위 메뉴 */}
              {item.children && expandedItems.includes(item.path) && (
                <div className="bg-gray-50">
                  {item.children.map((child) => (
                    <button
                      key={child.path}
                      onClick={() => handleMenuClick(child.path)}
                      className={`
                        w-full text-left px-12 py-2 text-base
                        hover:bg-gray-100 transition-colors
                        ${location.pathname === child.path ? 'text-primary-600 font-medium' : 'text-gray-600'}
                      `}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        
        {/* 하단 액션 */}
        <div className="border-t border-gray-200 p-4">
          {currentUser ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
              <span>로그아웃</span>
            </button>
          ) : (
            <button
              onClick={() => {
                navigate('/login');
                onClose();
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                />
              </svg>
              <span>로그인</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileMenu;