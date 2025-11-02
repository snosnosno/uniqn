import React, { useState, useEffect } from 'react';
import { networkManager } from '../utils/offlineSupport';
import { logger } from '../utils/logger';

interface NetworkStatusIndicatorProps {
  position?: 'top' | 'bottom';
  showOnlineStatus?: boolean;
  className?: string;
}

/**
 * 네트워크 상태 표시 컴포넌트
 * - 온라인/오프라인 상태 감지
 * - 시각적 인디케이터 제공
 * - 연결 상태 변경 알림
 */
const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  position = 'top',
  showOnlineStatus = false,
  className = '',
}) => {
  const [isOnline, setIsOnline] = useState(networkManager.getIsOnline());
  const [showIndicator, setShowIndicator] = useState(!isOnline || showOnlineStatus);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = networkManager.addListener((online) => {
      setIsOnline(online);

      if (!online) {
        // 오프라인이 되면 즉시 표시
        setShowIndicator(true);
        setIsVisible(true);
        logger.info('네트워크 연결이 끊어짐');
      } else {
        // 온라인이 되면 잠시 표시 후 숨김 (showOnlineStatus가 false인 경우)
        if (showOnlineStatus) {
          setShowIndicator(true);
          setIsVisible(true);
        } else {
          setIsVisible(true);
          setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => setShowIndicator(false), 300); // 애니메이션 완료 후 숨김
          }, 2000); // 2초 후 숨김
        }
        logger.info('네트워크 연결이 복구됨');
      }
    });

    return unsubscribe;
  }, [showOnlineStatus]);

  if (!showIndicator) return null;

  const baseClasses = `
    fixed left-0 right-0 z-50 transition-all duration-300 transform
    ${position === 'top' ? 'top-0' : 'bottom-0'}
    ${isVisible ? 'translate-y-0 opacity-100' :
      position === 'top' ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}
  `;

  const statusClasses = isOnline
    ? 'bg-green-600 dark:bg-green-700 text-white'
    : 'bg-red-600 dark:bg-red-700 text-white';

  return (
    <div className={`${baseClasses} ${statusClasses} ${className}`}>
      <div className="px-4 py-2 text-center text-sm font-medium flex items-center justify-center space-x-2">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <>
              <svg
                className="w-4 h-4 animate-pulse"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>온라인 - 연결됨</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                  clipRule="evenodd"
                />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
              <span>오프라인 - 일부 기능 제한</span>
            </>
          )}
        </div>

        {!isOnline && (
          <button
            onClick={() => {
              networkManager.testConnectivity().then((connected) => {
                if (connected) {
                  window.location.reload();
                }
              });
            }}
            className="ml-4 px-2 py-1 bg-white dark:bg-gray-800 bg-opacity-20 dark:bg-opacity-40 rounded text-xs hover:bg-opacity-30 dark:hover:bg-opacity-60 transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
};

export default NetworkStatusIndicator;