import React, { createContext, useReducer, useContext, ReactNode } from 'react';

// --- Type Definitions ---
export interface Participant {
  id: string;
  name: string;
  phone?: string;
  chipCount: number;
  status: 'active' | 'busted' | 'eliminated';
  tableNumber?: number;
  seatNumber?: number;
  rebuyCount?: number;
}

export interface Table {
  id: string;
  tableNumber: number;
  players: Participant[];
  dealerId?: string; // 딜러 ID 추가
}

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante?: number;
  isBreak?: boolean; // 휴식 시간 여부
  duration?: number; // 레벨 지속 시간 (초)
}

export interface TournamentSettings {
  name: string;
  startingChips: number;
  seatsPerTable: number;
  blindLevels: BlindLevel[]; // 블라인드 구조 배열
}

export interface TournamentState {
  tournamentId: string | null;
  participants: Participant[];
  tables: Table[];
  blinds: BlindLevel[];
  currentLevel: number;
  tournamentStatus: 'pending' | 'running' | 'paused' | 'finished';
  settings: TournamentSettings;
  blindLevel: number; // 현재 블라인드 레벨
  remainingTime: number; // 현재 레벨 남은 시간 (초)
  isTimerRunning: boolean; // 타이머 실행 상태
  currentUser: any | null; // 로그인한 사용자 정보
}

type Action =
  | { type: 'SET_TOURNAMENT'; payload: Partial<TournamentState> }
  | { type: 'UPDATE_PARTICIPANTS'; payload: Participant[] }
  | { type: 'SET_TABLES'; payload: Table[] }
  | { type: 'SET_STATUS'; payload: TournamentState['tournamentStatus'] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TournamentSettings> }
  | { type: 'SET_BLIND_LEVEL'; payload: number }
  | { type: 'TICK_TIMER' }
  | { type: 'SET_TIMER_RUNNING'; payload: boolean }
  | { type: 'SET_USER'; payload: any | null }
  | { type: 'ADD_PARTICIPANT'; payload: { name: string } };

interface TournamentContextProps {
  state: TournamentState;
  dispatch: React.Dispatch<Action>;
}

// --- Initial State and Reducer ---
const initialState: TournamentState = {
  tournamentId: null,
  participants: [],
  tables: [],
  blinds: [],
  currentLevel: 0,
  tournamentStatus: 'pending',
  settings: {
    name: "T-Holdem 초기 토너먼트",
    startingChips: 30000,
    seatsPerTable: 9,
    blindLevels: [
      { level: 1, sb: 100, bb: 200, duration: 1200 },
      { level: 2, sb: 200, bb: 400, duration: 1200 },
      { level: 3, isBreak: true, sb: 0, bb: 0, duration: 600 },
      { level: 4, sb: 300, bb: 600, ante: 600, duration: 1200 },
      { level: 5, sb: 400, bb: 800, ante: 800, duration: 1200 },
    ]
  },
  blindLevel: 0, // 0-indexed로 변경
  remainingTime: 1200, // 20분
  isTimerRunning: false,
  currentUser: null, // 초기에는 로그인하지 않은 상태
};

const tournamentReducer = (state: TournamentState, action: Action): TournamentState => {
  switch (action.type) {
    case 'SET_TOURNAMENT':
      return { ...state, ...action.payload };
    case 'UPDATE_PARTICIPANTS':
      return { ...state, participants: action.payload };
    case 'SET_TABLES':
      return { ...state, tables: action.payload };
    case 'SET_STATUS':
      return { ...state, tournamentStatus: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_BLIND_LEVEL':
      // 레벨이 유효한 범위 내에 있는지 확인
      if (action.payload >= 0 && action.payload < state.settings.blindLevels.length) {
        const newLevel = state.settings.blindLevels[action.payload];
        return { 
          ...state, 
          blindLevel: action.payload, 
          remainingTime: newLevel?.duration ?? 1200,
        };
      }
      return state;
    case 'TICK_TIMER':
      return { 
        ...state, 
        remainingTime: Math.max(0, state.remainingTime - 1) 
      };
    case 'SET_TIMER_RUNNING':
        return { 
          ...state, 
          isTimerRunning: action.payload 
        };
    case 'SET_USER':
      return {
        ...state,
        currentUser: action.payload,
      };
    case 'ADD_PARTICIPANT': {
      // Create new participant
      const newParticipant: Participant = {
        id: `p_${Date.now()}`,
        name: action.payload.name,
        chipCount: state.settings.startingChips,
        status: 'active',
      };

      // Find available table or create a new one
      const updatedTables = [...state.tables];
      let targetTable = updatedTables.find(t => t.players.length < state.settings.seatsPerTable);

      if (!targetTable) {
        const newTableNumber = updatedTables.length + 1;
        targetTable = {
          id: `t_${newTableNumber}`,
          tableNumber: newTableNumber,
          players: [],
        };
        updatedTables.push(targetTable);
      }

      // Assign table and seat
      newParticipant.tableNumber = targetTable.tableNumber;
      newParticipant.seatNumber = targetTable.players.length + 1; // Assuming seats are filled sequentially

      // Update the target table with the new player
      const finalTables = updatedTables.map(t => {
        if (t.id === targetTable!.id) {
          return { ...t, players: [...t.players, newParticipant] };
        }
        return t;
      });

      return {
        ...state,
        participants: [...state.participants, newParticipant],
        tables: finalTables,
      };
    }
    default:
      return state;
  }
};

// --- Context and Provider ---
export const TournamentContext = createContext<TournamentContextProps | undefined>(undefined);

interface TournamentProviderProps {
  children: ReactNode;
}

export const TournamentProvider = ({ children }: TournamentProviderProps) => {
  const [state, dispatch] = useReducer(tournamentReducer, initialState);

  return (
    <TournamentContext.Provider value={{ state, dispatch }}>
      {children}
    </TournamentContext.Provider>
  );
};

// --- Custom Hook ---
export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};
