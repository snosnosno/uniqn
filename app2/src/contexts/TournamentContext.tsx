// TournamentContext는 이제 TournamentContextAdapter를 통해 Zustand store를 사용합니다
// 하위 호환성을 위해 동일한 인터페이스를 유지합니다
import type { User } from '../types/common';
import type { Participant, Table, BlindLevel, TournamentSettings } from '../stores/tournamentStore';

export {
  TournamentProvider,
  useTournament,
  TournamentContext
} from './TournamentContextAdapter';

// 타입들도 tournamentStore에서 export하여 하위 호환성 유지
export type {
  Participant,
  Table,
  BlindLevel,
  TournamentSettings
} from '../stores/tournamentStore';

// TournamentState 인터페이스는 호환성을 위해 여기서 정의
export interface TournamentState {
  userId: string | null;  // 멀티 테넌트: 현재 사용자 ID
  tournamentId: string | null;
  participants: Participant[];
  tables: Table[];
  blinds: BlindLevel[];
  currentLevel: number;
  tournamentStatus: 'pending' | 'running' | 'paused' | 'finished';
  settings: TournamentSettings;
  blindLevel: number;
  remainingTime: number;
  isTimerRunning: boolean;
  currentUser: User | null;
}
