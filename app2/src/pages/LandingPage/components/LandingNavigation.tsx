/**
 * LandingNavigation 컴포넌트
 *
 * 랜딩페이지 전용 네비게이션 바
 * 로고, 메뉴, 로그인/회원가입 버튼 포함
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

interface LandingNavigationProps {
  onSectionClick?: (sectionId: string) => void;
}

const LandingNavigation: React.FC<LandingNavigationProps> = ({ onSectionClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 섹션으로 스크롤
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.querySelector(`[data-testid="${sectionId}-section"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      onSectionClick?.(sectionId);
    }
    setIsMobileMenuOpen(false);
  }, [onSectionClick]);

  // 버튼 클릭 핸들러
  const handleLoginClick = () => {
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const handleSignupClick = () => {
    navigate('/signup');
    setIsMobileMenuOpen(false);
  };

  const handleDashboardClick = () => {
    navigate('/app/profile');
    setIsMobileMenuOpen(false);
  };

  const handleAdminDashboardClick = () => {
    navigate('/app/admin/ceo-dashboard');
    setIsMobileMenuOpen(false);
  };

  const handleJobPostingsClick = () => {
    navigate('/app/admin/job-postings');
    setIsMobileMenuOpen(false);
  };

  const handleJobBoardClick = () => {
    navigate('/app/jobs');
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center">
            <button
              onClick={() => scrollToSection('hero')}
              className="flex items-center space-x-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
            >
              <div className={`w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-700 flex items-center justify-center text-white font-bold text-sm transition-colors duration-300`}>
                T
              </div>
              <span className={`transition-colors duration-300 ${
                isScrolled ? 'text-gray-900 dark:text-gray-100' : 'text-white'
              }`}>
                UNIQN
              </span>
            </button>
          </div>

          {/* 데스크톱 메뉴 */}
          <div className="hidden md:flex items-center space-x-8">
            {currentUser ? (
              <>
                <button
                  onClick={handleJobBoardClick}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  구인 정보
                </button>
                <button
                  onClick={handleJobPostingsClick}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  관리
                </button>
                <button
                  onClick={handleAdminDashboardClick}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  대시보드
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => scrollToSection('features')}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  주요 기능
                </button>
                <button
                  onClick={() => scrollToSection('targets')}
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  솔루션
                </button>
                <a
                  href="mailto:contact@tholdem.com"
                  className={`px-3 py-2 text-sm font-medium transition-colors duration-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white hover:text-blue-200'
                  }`}
                >
                  문의하기
                </a>
              </>
            )}
          </div>

          {/* 로그인/회원가입 버튼 */}
          <div className="hidden md:flex items-center space-x-4">
            {currentUser ? (
              <button
                onClick={handleDashboardClick}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                내 프로필
              </button>
            ) : (
              <>
                <button
                  onClick={handleLoginClick}
                  className={`px-4 py-2 text-sm font-medium transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg ${
                    isScrolled
                      ? 'text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400'
                      : 'text-white hover:text-blue-200'
                  }`}
                >
                  로그인
                </button>
                <button
                  onClick={handleSignupClick}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  무료 시작하기
                </button>
              </>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isScrolled ? 'text-gray-700 dark:text-gray-200' : 'text-white'
              }`}
              aria-label="메뉴 열기"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-6 space-y-4">
              {currentUser ? (
                <>
                  <button
                    onClick={handleJobBoardClick}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                  >
                    구인 정보
                  </button>
                  <button
                    onClick={handleJobPostingsClick}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                  >
                    관리
                  </button>
                  <button
                    onClick={handleAdminDashboardClick}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                  >
                    대시보드
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => scrollToSection('features')}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                  >
                    주요 기능
                  </button>
                  <button
                    onClick={() => scrollToSection('targets')}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                  >
                    솔루션
                  </button>
                  <a
                    href="mailto:contact@tholdem.com"
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    문의하기
                  </a>
                </>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {currentUser ? (
                  <button
                    onClick={handleDashboardClick}
                    className="block w-full px-3 py-2 text-base font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors duration-300"
                  >
                    내 프로필
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleLoginClick}
                      className="block w-full px-3 py-2 text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors duration-300"
                    >
                      로그인
                    </button>
                    <button
                      onClick={handleSignupClick}
                      className="block w-full px-3 py-2 text-base font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors duration-300"
                    >
                      무료 시작하기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default React.memo(LandingNavigation);