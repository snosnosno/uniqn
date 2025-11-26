import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * MaintenancePage - 시스템 점검 페이지
 *
 * @description
 * - 점검 모드 활성화 시 admin이 아닌 사용자에게 표시
 * - 점검 시간 및 안내 메시지 표시
 * - 다크모드 완전 지원
 *
 * @example
 * // FEATURE_FLAGS.MAINTENANCE_MODE = true일 때 자동 표시
 * <MaintenancePage />
 */
const MaintenancePage: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-md w-full px-6 py-8 mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            {/* 아이콘 */}
            <div className="mb-6">
              <svg
                className="mx-auto h-20 w-20 text-yellow-500 dark:text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* 제목 */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              시스템 점검 중
            </h1>

            {/* 설명 */}
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              보다 나은 서비스 제공을 위해
              <br />
              시스템 점검을 진행하고 있습니다.
            </p>

            {/* 점검 시간 안내 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                    예상 점검 시간
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    잠시만 기다려주세요.
                    <br />
                    빠른 시일 내에 정상 서비스를 재개하겠습니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 이용 불편 안내 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                이용에 불편을 드려 죄송합니다.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                문의사항이 있으시면 고객센터로 연락주세요.
              </p>
            </div>

            {/* 고객센터 정보 (선택사항) */}
            <div className="mt-6">
              <a
                href="mailto:support@tholdem.com"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                고객센터 문의
              </a>
            </div>
          </div>
        </div>

        {/* 로고 또는 브랜드명 (선택사항) */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            UNIQN - 홀덤 토너먼트 관리 플랫폼
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
