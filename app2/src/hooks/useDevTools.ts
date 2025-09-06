/**
 * useDevTools - 개발자 도구 통합 훅
 * Week 4 성능 최적화: 개발 환경에서만 활성화되는 개발자 도구
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface DevToolsState {
  isOpen: boolean;
  isEnabled: boolean;
}

/**
 * 개발자 도구 통합 훅
 * 개발 환경에서만 활성화되며, 키보드 단축키로 제어 가능
 */
export const useDevTools = () => {
  const [state, setState] = useState<DevToolsState>(() => ({
    isOpen: false,
    isEnabled: process.env.NODE_ENV === 'development'
  }));

  // 개발자 도구 토글
  const toggleDevTools = useCallback(() => {
    if (!state.isEnabled) return;
    
    setState(prev => ({
      ...prev,
      isOpen: !prev.isOpen
    }));
    
    logger.info('개발자 도구 토글', {
      component: 'useDevTools',
      data: { isOpen: !state.isOpen }
    });
  }, [state.isEnabled, state.isOpen]);

  // 개발자 도구 열기
  const openDevTools = useCallback(() => {
    if (!state.isEnabled) return;
    
    setState(prev => ({
      ...prev,
      isOpen: true
    }));
    
    logger.info('개발자 도구 열기', {
      component: 'useDevTools'
    });
  }, [state.isEnabled]);

  // 개발자 도구 닫기
  const closeDevTools = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false
    }));
    
    logger.info('개발자 도구 닫기', {
      component: 'useDevTools'
    });
  }, []);

  // 키보드 단축키 등록 (Ctrl+Shift+D)
  useEffect(() => {
    if (!state.isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+D 또는 Cmd+Shift+D
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        toggleDevTools();
      }
      
      // ESC 키로 개발자 도구 닫기
      if (event.key === 'Escape' && state.isOpen) {
        event.preventDefault();
        closeDevTools();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isEnabled, state.isOpen, toggleDevTools, closeDevTools]);

  // 개발 환경 체크 및 콘솔 안내 메시지
  useEffect(() => {
    if (state.isEnabled && !sessionStorage.getItem('devtools-intro-shown')) {
      console.log(
        '%c🛠️ UnifiedData DevTools',
        'font-size: 16px; font-weight: bold; color: #2563eb;'
      );
      console.log(
        '%c개발자 도구가 활성화되었습니다.\n' +
        '• Ctrl+Shift+D: 개발자 도구 열기/닫기\n' +
        '• ESC: 개발자 도구 닫기\n' +
        '• 실시간 성능 모니터링, 캐시 상태, 로그 확인 가능',
        'color: #6b7280; line-height: 1.5;'
      );
      
      sessionStorage.setItem('devtools-intro-shown', 'true');
    }
  }, [state.isEnabled]);

  // 성능 경고 모니터링
  useEffect(() => {
    if (!state.isEnabled) return;

    let performanceWarningShown = false;
    
    const checkPerformance = () => {
      if ((performance as any).memory && !performanceWarningShown) {
        const memoryMB = (performance as any).memory.usedJSHeapSize / 1024 / 1024;
        
        // 메모리 사용량이 200MB를 넘으면 경고
        if (memoryMB > 200) {
          logger.warn('높은 메모리 사용량 감지', {
            memoryUsageMB: Math.round(memoryMB),
            component: 'useDevTools'
          });
          
          // 개발자 콘솔에도 시각적 경고 표시
          console.warn(
            '%c⚠️ 높은 메모리 사용량 감지',
            'font-size: 14px; font-weight: bold; color: #f59e0b;',
            `\n현재 사용량: ${Math.round(memoryMB)}MB\n개발자 도구를 열어 상세 정보를 확인하세요.`
          );
          performanceWarningShown = true;
        }
      }
    };

    const interval = setInterval(checkPerformance, 10000); // 10초마다 체크
    
    return () => clearInterval(interval);
  }, [state.isEnabled]);

  return {
    isOpen: state.isOpen,
    isEnabled: state.isEnabled,
    toggleDevTools,
    openDevTools,
    closeDevTools
  };
};

export default useDevTools;