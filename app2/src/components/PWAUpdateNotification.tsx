import React from 'react';
import { useServiceWorkerUpdate } from '../utils/serviceWorker';

interface PWAUpdateNotificationProps {
  className?: string;
}

/**
 * PWA 업데이트 알림 컴포넌트
 * - Service Worker 업데이트 감지
 * - 사용자에게 업데이트 알림
 * - 오프라인 준비 상태 알림
 */
const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({
  className = '',
}) => {
  const { needRefresh, offlineReady, updateServiceWorker } = useServiceWorkerUpdate();

  if (!needRefresh && !offlineReady) return null;

  if (needRefresh) {
    return (
      <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-blue-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">새로운 버전 사용 가능</h4>
            <p className="mt-1 text-xs text-blue-100">
              앱의 새로운 버전이 준비되었습니다. 업데이트하면 최신 기능과 개선사항을 이용할 수 있습니다.
            </p>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={updateServiceWorker}
                className="px-3 py-1.5 bg-white text-blue-600 text-xs font-medium rounded hover:bg-blue-50 transition-colors"
              >
                지금 업데이트
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-400 transition-colors"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-green-600 text-white rounded-lg shadow-lg p-4 z-50 animate-slide-in ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-green-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">오프라인 준비 완료</h4>
            <p className="mt-1 text-xs text-green-100">
              앱이 오프라인에서도 작동하도록 준비되었습니다. 인터넷 연결이 없어도 기본 기능을 사용할 수 있습니다.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.currentTarget.parentElement?.parentElement?.remove();
            }}
            className="flex-shrink-0 text-green-200 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default PWAUpdateNotification;