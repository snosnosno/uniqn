/**
 * DateFilterStore Contracts
 *
 * Zustand Store for managing date filter state
 * Replaces DateFilterContext with localStorage persistence
 *
 * @module contracts/dateFilterStore
 * @see app2/src/stores/dateFilterStore.ts (implementation)
 */

/**
 * DateFilterStore State
 */
export interface DateFilterState {
  /**
   * Currently selected date in YYYY-MM-DD format
   * Persisted to localStorage as 'date-filter-storage'
   *
   * @example "2025-11-20"
   */
  selectedDate: string;

  /**
   * Available tournament dates (sorted array)
   * Computed from TournamentDataContext
   *
   * @example ["2025-11-18", "2025-11-19", "2025-11-20"]
   */
  availableDates: string[];
}

/**
 * DateFilterStore Actions
 */
export interface DateFilterActions {
  /**
   * Set selected date
   * Automatically persisted to localStorage
   *
   * @param date - Date in YYYY-MM-DD format
   */
  setSelectedDate: (date: string) => void;

  /**
   * Set available tournament dates
   * Called when TournamentDataContext updates
   *
   * @param dates - Sorted array of YYYY-MM-DD dates
   */
  setAvailableDates: (dates: string[]) => void;

  /**
   * Navigate to next tournament date
   * No change if already at last date
   */
  goToNextDate: () => void;

  /**
   * Navigate to previous tournament date
   * No change if already at first date
   */
  goToPreviousDate: () => void;

  /**
   * Navigate to today's date
   * If no tournament today, navigates to nearest future date
   */
  goToToday: () => void;
}

/**
 * DateFilterStore (State + Actions)
 */
export type DateFilterStore = DateFilterState & DateFilterActions;

/**
 * Zustand Persist Configuration
 */
export interface DateFilterPersistConfig {
  /**
   * localStorage key
   * @default "date-filter-storage"
   */
  name: string;

  /**
   * Storage type
   * @default localStorage
   */
  storage: Storage;

  /**
   * Fields to persist (only selectedDate)
   */
  partialize: (state: DateFilterState) => Partial<DateFilterState>;

  /**
   * Schema version for migrations
   * @default 1
   */
  version?: number;
}

/**
 * DateFilterContext Compatibility Type
 *
 * Matches existing DateFilterContext API for backward compatibility
 * Used by useDateFilter() hook
 */
export interface DateFilterContextType {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToNextDate: () => void;
  goToPreviousDate: () => void;
  goToToday: () => void;
  availableDates: string[];
}
