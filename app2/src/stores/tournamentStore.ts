import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { User } from '../types/common';

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
  staffId?: string;
}

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante?: number;
  isBreak?: boolean;
  duration?: number;
}

export interface TournamentSettings {
  name: string;
  startingChips: number;
  seatsPerTable: number;
  blindLevels: BlindLevel[];
}

interface TournamentState {
  // State
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

  // Actions
  setTournament: (payload: Partial<TournamentState>) => void;
  updateParticipants: (participants: Participant[]) => void;
  setTables: (tables: Table[]) => void;
  setStatus: (status: TournamentState['tournamentStatus']) => void;
  updateSettings: (settings: Partial<TournamentSettings>) => void;
  setBlindLevel: (level: number) => void;
  tickTimer: () => void;
  setTimerRunning: (running: boolean) => void;
  setUser: (user: User | null) => void;
  addParticipant: (name: string) => void;
  
  // Selectors
  getCurrentBlindLevel: () => BlindLevel | undefined;
  getActiveParticipants: () => Participant[];
  getTableByNumber: (tableNumber: number) => Table | undefined;
  getParticipantById: (id: string) => Participant | undefined;
  
  // Utility actions
  eliminateParticipant: (participantId: string) => void;
  updateChipCount: (participantId: string, chipCount: number) => void;
  rebuyParticipant: (participantId: string) => void;
  moveParticipant: (participantId: string, toTableNumber: number, toSeatNumber: number) => void;
  balanceTables: () => void;
  reset: () => void;
}

// Initial State
const initialState = {
  tournamentId: null,
  participants: [],
  tables: [],
  blinds: [],
  currentLevel: 0,
  tournamentStatus: 'pending' as const,
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
  blindLevel: 0,
  remainingTime: 1200,
  isTimerRunning: false,
  currentUser: null,
};

// Store
export const useTournamentStore = create<TournamentState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Basic Actions
        setTournament: (payload) => set((state) => {
          Object.assign(state, payload);
        }),

        updateParticipants: (participants) => set((state) => {
          state.participants = participants;
        }),

        setTables: (tables) => set((state) => {
          state.tables = tables;
        }),

        setStatus: (status) => set((state) => {
          state.tournamentStatus = status;
        }),

        updateSettings: (settings) => set((state) => {
          Object.assign(state.settings, settings);
        }),

        setBlindLevel: (level) => set((state) => {
          if (level >= 0 && level < state.settings.blindLevels.length) {
            const newLevel = state.settings.blindLevels[level];
            state.blindLevel = level;
            state.remainingTime = newLevel?.duration ?? 1200;
          }
        }),

        tickTimer: () => set((state) => {
          state.remainingTime = Math.max(0, state.remainingTime - 1);
        }),

        setTimerRunning: (running) => set((state) => {
          state.isTimerRunning = running;
        }),

        setUser: (user) => set((state) => {
          state.currentUser = user;
        }),

        addParticipant: (name) => set((state) => {
          // Create new participant
          const newParticipant: Participant = {
            id: `p_${Date.now()}`,
            name,
            chipCount: state.settings.startingChips,
            status: 'active',
          };

          // Find available table or create a new one
          let targetTable = state.tables.find(t => t.players.length < state.settings.seatsPerTable);

          if (!targetTable) {
            const newTableNumber = state.tables.length + 1;
            targetTable = {
              id: `t_${newTableNumber}`,
              tableNumber: newTableNumber,
              players: [],
            };
            state.tables.push(targetTable);
          }

          // Assign table and seat
          newParticipant.tableNumber = targetTable.tableNumber;
          newParticipant.seatNumber = targetTable.players.length + 1;

          // Update the target table with the new player
          const tableIndex = state.tables.findIndex(t => t.id === targetTable!.id);
          if (tableIndex !== -1) {
            const table = state.tables[tableIndex];
            if (table) {
              table.players.push(newParticipant);
            }
          }

          // Add to participants
          state.participants.push(newParticipant);
        }),

        // Selectors
        getCurrentBlindLevel: () => {
          const state = get();
          return state.settings.blindLevels[state.blindLevel];
        },

        getActiveParticipants: () => {
          const state = get();
          return state.participants.filter(p => p.status === 'active');
        },

        getTableByNumber: (tableNumber) => {
          const state = get();
          return state.tables.find(t => t.tableNumber === tableNumber);
        },

        getParticipantById: (id) => {
          const state = get();
          return state.participants.find(p => p.id === id);
        },

        // Utility Actions
        eliminateParticipant: (participantId) => set((state) => {
          const participant = state.participants.find(p => p.id === participantId);
          if (participant) {
            participant.status = 'eliminated';
            
            // Remove from table
            const table = state.tables.find(t => t.tableNumber === participant.tableNumber);
            if (table) {
              table.players = table.players.filter(p => p.id !== participantId);
            }
          }
        }),

        updateChipCount: (participantId, chipCount) => set((state) => {
          const participant = state.participants.find(p => p.id === participantId);
          if (participant) {
            participant.chipCount = chipCount;
            if (chipCount === 0) {
              participant.status = 'busted';
            }
          }
        }),

        rebuyParticipant: (participantId) => set((state) => {
          const participant = state.participants.find(p => p.id === participantId);
          if (participant && participant.status === 'busted') {
            participant.status = 'active';
            participant.chipCount = state.settings.startingChips;
            participant.rebuyCount = (participant.rebuyCount || 0) + 1;
            
            // Add back to table if removed
            const table = state.tables.find(t => t.tableNumber === participant.tableNumber);
            if (table && !table.players.find(p => p.id === participantId)) {
              table.players.push(participant);
            }
          }
        }),

        moveParticipant: (participantId, toTableNumber, toSeatNumber) => set((state) => {
          const participant = state.participants.find(p => p.id === participantId);
          if (!participant) return;

          // Remove from current table
          const fromTable = state.tables.find(t => t.tableNumber === participant.tableNumber);
          if (fromTable) {
            fromTable.players = fromTable.players.filter(p => p.id !== participantId);
          }

          // Add to new table
          const toTable = state.tables.find(t => t.tableNumber === toTableNumber);
          if (toTable) {
            participant.tableNumber = toTableNumber;
            participant.seatNumber = toSeatNumber;
            toTable.players.push(participant);
          }
        }),

        balanceTables: () => set((state) => {
          const activeTables = state.tables.filter(t => t.players.length > 0);
          const totalPlayers = activeTables.reduce((sum, t) => sum + t.players.length, 0);
          const _targetPlayersPerTable = Math.ceil(totalPlayers / activeTables.length); // 미래 재분배 로직용

          // 재분배 로직은 복잡하므로 여기서는 기본 구조만 제공
          // Table balancing calculation completed
        }),

        reset: () => set(() => initialState),
      })),
      {
        name: 'tournament-store',
        partialize: (state) => ({
          tournamentId: state.tournamentId,
          participants: state.participants,
          tables: state.tables,
          settings: state.settings,
          blindLevel: state.blindLevel,
          remainingTime: state.remainingTime,
          tournamentStatus: state.tournamentStatus,
        }),
      }
    )
  )
);