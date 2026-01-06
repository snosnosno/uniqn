/**
 * UNIQN Mobile - Theme Store
 *
 * @description 테마 상태 관리 (라이트/다크 모드 + MMKV)
 * @version 1.1.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { Appearance, ColorSchemeName } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDarkMode: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

// ============================================================================
// Helper
// ============================================================================

const getSystemDarkMode = (): boolean => {
  const colorScheme = Appearance.getColorScheme();
  return colorScheme === 'dark';
};

const computeIsDarkMode = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    return getSystemDarkMode();
  }
  return mode === 'dark';
};

// ============================================================================
// Store
// ============================================================================

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDarkMode: getSystemDarkMode(),

      setTheme: (mode: ThemeMode) => {
        set({
          mode,
          isDarkMode: computeIsDarkMode(mode),
        });
      },

      toggleTheme: () => {
        const currentMode = get().mode;
        let newMode: ThemeMode;

        if (currentMode === 'system') {
          // 시스템 모드에서 토글하면 반대 모드로 전환
          newMode = getSystemDarkMode() ? 'light' : 'dark';
        } else {
          newMode = currentMode === 'light' ? 'dark' : 'light';
        }

        set({
          mode: newMode,
          isDarkMode: computeIsDarkMode(newMode),
        });
      },
    }),
    {
      name: 'uniqn-theme',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 복원 후 isDarkMode 재계산
          state.isDarkMode = computeIsDarkMode(state.mode);
        }
      },
    }
  )
);

// ============================================================================
// System Theme Listener
// ============================================================================

// 시스템 테마 변경 감지
Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const state = useThemeStore.getState();
  if (state.mode === 'system') {
    useThemeStore.setState({
      isDarkMode: colorScheme === 'dark',
    });
  }
});

export default useThemeStore;
