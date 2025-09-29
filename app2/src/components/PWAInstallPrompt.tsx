import React, { useState, useEffect } from 'react';
import { pwaInstallManager } from '../utils/serviceWorker';
import { logger } from '../utils/logger';

interface PWAInstallPromptProps {
  className?: string;
  autoShow?: boolean;
  showDelay?: number;
}

/**
 * PWA 설치 프롬프트 컴포넌트
 * - 설치 가능한 상태에서 프롬프트 표시
 * - 사용자 친화적인 설치 안내
 * - 설치 취소 및 나중에 다시 묻기 기능
 */
const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  className = '',
  autoShow = true,
  showDelay = 3000,
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 로컬 스토리지에서 이전에 취소한 이력 확인
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const weekInMs = 7 * 24 * 60 * 60 * 1000; // 1주일

    // 1주일 전에 취소한 경우는 다시 표시
    if (dismissedTime && Date.now() - dismissedTime < weekInMs) {
      setIsDismissed(true);
      return;
    }

    // PWA가 이미 설치된 경우 프롬프트 표시 안함
    if (pwaInstallManager.getIsInstalled()) {
      return;
    }

    // 자동 표시가 활성화된 경우 지연 후 표시
    if (autoShow) {
      const timer = setTimeout(() => {
        if (pwaInstallManager.getIsInstallable() && !isDismissed) {
          setShowPrompt(true);
          logger.info('PWA 설치 프롬프트 자동 표시');
        }
      }, showDelay);

      return () => clearTimeout(timer);
    }

    // autoShow가 false인 경우 cleanup function 반환 (아무것도 하지 않음)
    return () => {};
  }, [autoShow, showDelay, isDismissed]);

  const handleInstall = async () => {
    setIsInstalling(true);

    try {
      const result = await pwaInstallManager.promptInstall();

      if (result) {
        logger.info('PWA 설치 성공');
        setShowPrompt(false);
      } else {
        logger.info('PWA 설치 취소됨');
      }
    } catch (error) {
      logger.error('PWA 설치 에러:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = (type: 'later' | 'never') => {
    setShowPrompt(false);

    if (type === 'never') {
      // 1주일 동안 표시하지 않음
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      setIsDismissed(true);
      logger.info('PWA 설치 프롬프트 1주일간 숨김');
    } else {
      logger.info('PWA 설치 프롬프트 일시 숨김');
    }
  };

  if (!showPrompt || isDismissed || pwaInstallManager.getIsInstalled()) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-slide-in ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
          <svg
            className="w-6 h-6 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            홈 화면에 T-HOLDEM 추가
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            홈 화면에 T-HOLDEM을 추가하여 네이티브 앱처럼 빠르게 접근하고 오프라인에서도 사용하세요.
          </p>

          <div className="mt-4 flex flex-col space-y-2">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center space-x-2"
            >
              {isInstalling ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>설치 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>홈 화면에 추가</span>
                </>
              )}
            </button>

            <div className="flex space-x-2">
              <button
                onClick={() => handleDismiss('later')}
                className="flex-1 px-3 py-1.5 text-gray-600 dark:text-gray-300 text-xs hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                나중에
              </button>
              <button
                onClick={() => handleDismiss('never')}
                className="flex-1 px-3 py-1.5 text-gray-600 dark:text-gray-300 text-xs hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                다시 묻지 않음
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleDismiss('later')}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
          aria-label="닫기"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* iOS 설치 안내 (Safari에서) */}
      {/iPad|iPhone|iPod/.test(navigator.userAgent) && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
            <strong>iOS에서 설치하기:</strong>
          </p>
          <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
            <li>Safari 하단의 공유 버튼 탭</li>
            <li>"홈 화면에 추가" 선택</li>
            <li>"추가" 버튼 탭</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default PWAInstallPrompt;