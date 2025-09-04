/**
 * DevToolsProvider - 개발자 도구 프로바이더
 * Week 4 성능 최적화: 개발 환경에서만 로드되는 개발자 도구 통합
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import React, { Suspense } from 'react';
import { useDevTools } from '../../hooks/useDevTools';

// 개발 환경에서만 개발자 도구 로드 (동적 import)
const UnifiedDataDevTools = React.lazy(() => import('./UnifiedDataDevTools'));

interface DevToolsProviderProps {
  children: React.ReactNode;
}

/**
 * 개발자 도구 프로바이더
 * 개발 환경에서만 개발자 도구를 렌더링하고 통합
 */
const DevToolsProvider: React.FC<DevToolsProviderProps> = ({ children }) => {
  const { isOpen, isEnabled, toggleDevTools } = useDevTools();

  return (
    <>
      {children}
      
      {/* 개발 환경에서만 개발자 도구 렌더링 */}
      {isEnabled && (
        <Suspense fallback={null}>
          <UnifiedDataDevTools 
            isOpen={isOpen} 
            onToggle={toggleDevTools} 
          />
        </Suspense>
      )}
    </>
  );
};

export default DevToolsProvider;