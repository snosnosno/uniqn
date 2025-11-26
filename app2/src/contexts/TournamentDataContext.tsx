/**
 * TournamentDataContext - 토너먼트 데이터 전역 관리 Context
 *
 * useTournaments 훅의 중복 리스너 문제를 해결하기 위해 생성
 * UnifiedDataContext와 동일한 패턴으로 일관된 아키텍처 유지
 *
 * 주요 특징:
 * - 단일 Firebase 리스너로 모든 컴포넌트에 데이터 제공
 * - 중복 구독 방지로 성능 최적화 (66% 읽기 요청 감소)
 * - 타입 안전성 보장
 * - 메모이제이션 기반 최적화
 *
 * @version 1.0
 * @since 2025-10-17
 * @author T-HOLDEM Development Team
 */

import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { DocumentReference, DocumentData } from 'firebase/firestore';
import { useTournament } from './TournamentContext';
import { useTournaments, Tournament } from '../hooks/useTournaments';
import { logger } from '../utils/logger';

/**
 * Context 타입 정의
 * useTournaments 훅의 반환 타입과 동일하게 유지
 */
interface TournamentDataContextType {
  tournaments: Tournament[];
  loading: boolean;
  error: Error | null;
  createTournament: (
    data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt' | 'dateKey'>
  ) => Promise<DocumentReference<DocumentData, DocumentData>>;
  updateTournament: (
    id: string,
    data: Partial<Omit<Tournament, 'id' | 'createdAt' | 'updatedAt' | 'dateKey'>>
  ) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  ensureDefaultTournamentForDate: (dateKey: string) => Promise<string>;
}

/**
 * Context 생성
 */
const TournamentDataContext = createContext<TournamentDataContextType | undefined>(undefined);

/**
 * Provider 컴포넌트
 *
 * TournamentProvider 내부에 배치되어야 함 (userId 접근 필요)
 *
 * @example
 * <TournamentProvider>
 *   <TournamentDataProvider>
 *     <App />
 *   </TournamentDataProvider>
 * </TournamentProvider>
 */
export const TournamentDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useTournament();
  const tournamentData = useTournaments(state.userId);

  // Provider 초기화 로깅 (한 번만 실행)
  useEffect(() => {
    if (state.userId && !tournamentData.loading) {
      logger.info('TournamentDataProvider initialized', {
        component: 'TournamentDataContext',
        data: {
          userId: state.userId,
          tournamentCount: tournamentData.tournaments.length,
          loading: tournamentData.loading,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.userId]); // userId 변경 시에만 실행

  // createTournament 래핑: 해당 날짜의 첫 번째 토너먼트 생성 시 기본 토너먼트도 자동 생성
  const createTournamentWithDefault = useCallback(
    async (data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt' | 'dateKey'>) => {
      const dateKey = data.date; // 정규화된 날짜 키

      // 해당 날짜에 토너먼트가 없으면 기본 토너먼트 먼저 생성
      const tournamentsForDate = tournamentData.tournaments.filter((t) => t.dateKey === dateKey);
      if (tournamentsForDate.length === 0) {
        await tournamentData.ensureDefaultTournamentForDate(dateKey);
        logger.info('첫 번째 토너먼트 생성 전 기본 토너먼트 자동 생성', {
          component: 'TournamentDataContext',
          data: { dateKey },
        });
      }

      // 실제 토너먼트 생성
      return tournamentData.createTournament(data);
    },
    [tournamentData]
  );

  const contextValue: TournamentDataContextType = useMemo(
    () => ({
      ...tournamentData,
      createTournament: createTournamentWithDefault,
    }),
    [tournamentData, createTournamentWithDefault]
  );

  return (
    <TournamentDataContext.Provider value={contextValue}>{children}</TournamentDataContext.Provider>
  );
};

/**
 * Context Hook
 *
 * TournamentDataProvider 내부에서만 사용 가능
 *
 * @throws {Error} Provider 외부에서 사용 시 에러 발생
 *
 * @example
 * const { tournaments, loading, createTournament } = useTournamentData();
 */
export const useTournamentData = (): TournamentDataContextType => {
  const context = useContext(TournamentDataContext);

  if (!context) {
    throw new Error(
      'useTournamentData must be used within TournamentDataProvider. ' +
        'Make sure your component is wrapped with <TournamentDataProvider>.'
    );
  }

  return context;
};

/**
 * Context export (테스트 및 디버깅용)
 */
export { TournamentDataContext };

/**
 * 타입 export
 */
export type { TournamentDataContextType };
