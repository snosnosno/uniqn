import { create } from 'zustand';

export type StartupPhase = 'idle' | 'bootstrapping' | 'resolving_session' | 'resolved' | 'error';

interface AppStartupState {
  startupPhase: StartupPhase;
  setStartupPhase: (startupPhase: StartupPhase) => void;
  reset: () => void;
}

const initialState: Pick<AppStartupState, 'startupPhase'> = {
  startupPhase: 'idle',
};

export const useAppStartupStore = create<AppStartupState>((set) => ({
  ...initialState,
  setStartupPhase: (startupPhase) => set({ startupPhase }),
  reset: () => set(initialState),
}));

export const selectStartupPhase = (state: AppStartupState) => state.startupPhase;
