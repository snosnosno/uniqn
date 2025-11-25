/**
 * DataProviders - 데이터 관련 Provider 그룹
 *
 * 데이터 초기화 및 토너먼트 관련 Provider들을 하나의 그룹으로 묶어
 * 독립적인 Suspense 경계를 형성합니다.
 */
import React, { Suspense } from 'react';
import { UnifiedDataInitializer } from '../UnifiedDataInitializer';
import { TournamentProvider } from '../../contexts/TournamentContextAdapter';
import { TournamentDataProvider } from '../../contexts/TournamentDataContext';
import LoadingSpinner from '../LoadingSpinner';

interface DataProvidersProps {
  children: React.ReactNode;
}

/**
 * 데이터 Provider 그룹
 * - UnifiedDataInitializer: Zustand 스토어 초기화
 * - TournamentProvider: 토너먼트 Context (Zustand Adapter)
 * - TournamentDataProvider: 토너먼트 데이터 전역 관리
 *
 * 이 그룹은 독립적인 Suspense 경계를 가지므로,
 * 데이터 로딩 중에도 UI가 블로킹되지 않습니다.
 */
export const DataProviders: React.FC<DataProvidersProps> = ({ children }) => {
  return (
    <UnifiedDataInitializer>
      <TournamentProvider>
        <TournamentDataProvider>
          <Suspense fallback={<LoadingSpinner />}>
            {children}
          </Suspense>
        </TournamentDataProvider>
      </TournamentProvider>
    </UnifiedDataInitializer>
  );
};

export default DataProviders;
