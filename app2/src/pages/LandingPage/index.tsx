/**
 * LandingPage - 심플한 앱 스타일 시작 화면
 *
 * 기능:
 * - HeaderMenu (다크모드 토글, 알림, 햄버거 메뉴)
 * - 로그인/회원가입 버튼 (비로그인 시)
 * - 앱 다운로드 버튼 (placeholder)
 * - 이용약관/개인정보처리방침 링크
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderMenu } from '../../components/layout/HeaderMenu';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser, loading: authLoading } = useAuth();

  return (
    <div className="min-h-screen w-screen overflow-x-hidden bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* 상단 헤더 */}
      <header className="w-full flex justify-end items-center p-3 md:p-6">
        <HeaderMenu />
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 w-full flex flex-col items-center justify-center px-4 py-6 md:py-8">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          {/* 임시 이미지 로고 */}
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-4xl md:text-5xl font-bold text-white">U</span>
          </div>

          {/* 텍스트 로고 */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            UNIQN
          </h1>
        </div>

        {/* 서브 텍스트 */}
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 text-center mb-10 max-w-md">
          {t('landing.subtitle', '홀덤펍과 딜러를 연결합니다')}
        </p>

        {/* CTA 버튼 영역 - 비로그인 상태에서만 표시 */}
        {!currentUser && !authLoading && (
          <div className="w-full max-w-xs space-y-4">
            {/* 로그인 버튼 */}
            <button
              onClick={() => navigate('/login')}
              className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all min-h-[52px]"
            >
              {t('landing.login', '로그인')}
            </button>

            {/* 회원가입 버튼 */}
            <button
              onClick={() => navigate('/signup')}
              className="w-full py-4 px-6 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 shadow-md hover:shadow-lg transition-all min-h-[52px]"
            >
              {t('landing.signup', '회원가입')}
            </button>
          </div>
        )}

        {/* 로그인 상태: 환영 메시지 */}
        {currentUser && !authLoading && (
          <p className="text-lg text-gray-600 dark:text-gray-400 text-center">
            {t('landing.welcomeBack', {
              name: (() => {
                // displayName 형식: "이름 [JSON]" 에서 닉네임 또는 이름 추출
                const displayName = currentUser.displayName;
                if (displayName) {
                  // "이름 [JSON]" 형식 파싱
                  const match = displayName.match(/^(.+?)\s*\[(.+)\]$/);
                  if (match && match[1] && match[2]) {
                    const realName = match[1];
                    try {
                      const jsonData = JSON.parse(match[2]);
                      // 배열이면 첫 번째 요소, 객체면 그대로 사용
                      const data = Array.isArray(jsonData) ? jsonData[0] : jsonData;
                      // 닉네임 우선, 없으면 실제 이름
                      return data?.nickname || realName;
                    } catch {
                      return realName;
                    }
                  }
                  // JSON 형식이 아니면 그대로 사용
                  return displayName;
                }
                return currentUser.email?.split('@')[0] || 'User';
              })(),
              defaultValue: '다시 오신 것을 환영합니다, {{name}}님!',
            })}
          </p>
        )}

        {/* 앱 다운로드 버튼 */}
        <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-2 md:gap-3">
          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-2.5 md:px-5 md:py-3 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl cursor-not-allowed opacity-60"
            aria-label={`App Store - ${t('landing.comingSoon', '준비중')}`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] md:text-xs">{t('landing.comingSoon', '준비중')}</div>
              <div className="text-xs md:text-sm font-semibold">App Store</div>
            </div>
          </button>

          <button
            disabled
            className="flex items-center justify-center gap-2 px-4 py-2.5 md:px-5 md:py-3 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl cursor-not-allowed opacity-60"
            aria-label={`Google Play - ${t('landing.comingSoon', '준비중')}`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
            </svg>
            <div className="text-left">
              <div className="text-[10px] md:text-xs">{t('landing.comingSoon', '준비중')}</div>
              <div className="text-xs md:text-sm font-semibold">Google Play</div>
            </div>
          </button>
        </div>
      </main>

      {/* 하단 링크 */}
      <footer className="py-4 md:py-6 px-4 text-center">
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
          <Link
            to="/terms-of-service"
            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {t('landing.terms', '이용약관')}
          </Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <Link
            to="/privacy-policy"
            className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            {t('landing.privacy', '개인정보처리방침')}
          </Link>
        </div>
        <p className="mt-2 md:mt-3 text-[10px] md:text-xs text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} UNIQN. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default React.memo(LandingPage);
