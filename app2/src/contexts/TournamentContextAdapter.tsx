import { logger } from '../utils/logger';
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTournamentStore } from '../stores/tournamentStore';
import type { User } from '../types/common';
import { TournamentState } from './TournamentContext';

// 기존 Action 타입과 호환되는 인터페이스
type Action =
  | { type: 'SET_TOURNAMENT'; payload: Partial<TournamentState> }
  | { type: 'UPDATE_PARTICIPANTS'; payload: TournamentState['participants'] }
  | { type: 'SET_TABLES'; payload: TournamentState['tables'] }
  | { type: 'SET_STATUS'; payload: TournamentState['tournamentStatus'] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TournamentState['settings']> }
  | { type: 'SET_BLIND_LEVEL'; payload: number }
  | { type: 'TICK_TIMER' }
  | { type: 'SET_TIMER_RUNNING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'ADD_PARTICIPANT'; payload: { name: string } };

interface TournamentContextProps {
  state: TournamentState;
  dispatch: React.Dispatch<Action>;
}

// Context with backward compatibility
export const TournamentContext = createContext<TournamentContextProps | undefined>(undefined);

interface TournamentProviderProps {
  children: ReactNode;
}

/**
 * TournamentProvider Adapter
 * 기존 Context API 인터페이스를 유지하면서 내부적으로 Zustand store를 사용
 */
export const TournamentProvider = ({ children }: TournamentProviderProps) => {
  // Zustand store 사용
  const store = useTournamentStore();

  // Zustand state를 기존 TournamentState 형태로 변환
  const state: TournamentState = {
    tournamentId: store.tournamentId,
    participants: store.participants,
    tables: store.tables,
    blinds: store.blinds,
    currentLevel: store.currentLevel,
    tournamentStatus: store.tournamentStatus,
    settings: store.settings,
    blindLevel: store.blindLevel,
    remainingTime: store.remainingTime,
    isTimerRunning: store.isTimerRunning,
    currentUser: store.currentUser,
  };

  // dispatch 함수를 Zustand actions로 매핑
  const dispatch: React.Dispatch<Action> = (action: Action) => {
    switch (action.type) {
      case 'SET_TOURNAMENT':
        store.setTournament(action.payload);
        break;
      case 'UPDATE_PARTICIPANTS':
        store.updateParticipants(action.payload);
        break;
      case 'SET_TABLES':
        store.setTables(action.payload);
        break;
      case 'SET_STATUS':
        store.setStatus(action.payload);
        break;
      case 'UPDATE_SETTINGS':
        store.updateSettings(action.payload);
        break;
      case 'SET_BLIND_LEVEL':
        store.setBlindLevel(action.payload);
        break;
      case 'TICK_TIMER':
        store.tickTimer();
        break;
      case 'SET_TIMER_RUNNING':
        store.setTimerRunning(action.payload);
        break;
      case 'SET_USER':
        store.setUser(action.payload);
        break;
      case 'ADD_PARTICIPANT':
        store.addParticipant(action.payload.name);
        break;
      default:
        logger.warn('Unknown action type:', { component: 'TournamentContextAdapter', data: action });
    }
  };

  return (
    <TournamentContext.Provider value={{ state, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
};

/**
 * 기존 useTournament 훅과 동일한 인터페이스 제공
 */
export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};

// useTournamentStore는 이미 tournamentStore.ts에서 export되어 있으므로
// 직접 import해서 사용하면 됩니다.