/**
 * UNIQN Mobile - Theme Store
 *
 * @description 테마 상태 관리 (라이트/다크 모드 + MMKV)
 * @version 1.2.0
 *
 * 변경사항:
 * - v1.2.0: hydration 추적 및 waitForHydration 추가
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { Appearance, ColorSchemeName } from 'react-native';
import { colorScheme as nativeWindColorScheme } from 'nativewind';

// ============================================================================
// Constants
// ============================================================================

const VALID_THEME_MODES = ['light', 'dark', 'system'] as const;

// ============================================================================
// Types
// ============================================================================

export type ThemeMode = (typeof VALID_THEME_MODES)[number];

interface ThemeState {
  mode: ThemeMode;
  isDarkMode: boolean;
  _hasHydrated: boolean; // MMKV에서 복원 완료 여부
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
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

/**
 * NativeWind colorScheme 설정
 * dark: 클래스가 작동하도록 NativeWind의 colorScheme.set() 사용
 */
const applyColorScheme = (mode: ThemeMode): void => {
  nativeWindColorScheme.set(mode);
};

// ============================================================================
// Store
// ============================================================================

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDarkMode: getSystemDarkMode(),
      _hasHydrated: false,

      setHasHydrated: (hasHydrated: boolean) => {
        set({ _hasHydrated: hasHydrated });
      },

      setTheme: (mode: ThemeMode) => {
        // 유효성 검증
        if (!VALID_THEME_MODES.includes(mode)) {
          console.warn(`[themeStore] Invalid theme mode: ${mode}, using 'system'`);
          mode = 'system';
        }
        applyColorScheme(mode);
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

        applyColorScheme(newMode);
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
          const isDark = computeIsDarkMode(state.mode);

          // NativeWind colorScheme 적용 (system 모드는 실제 값으로 변환)
          const effectiveMode = state.mode === 'system' ? (isDark ? 'dark' : 'light') : state.mode;
          nativeWindColorScheme.set(effectiveMode);

          // ⚠️ queueMicrotask로 렌더링 사이클 이후 상태 업데이트
          // React 경고 방지: "Can't perform a React state update on a component that hasn't mounted yet"
          queueMicrotask(() => {
            useThemeStore.setState({ isDarkMode: isDark });
          });

          // hydration 완료 표시
          state.setHasHydrated(true);
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
    // NativeWind colorScheme 즉시 반영
    nativeWindColorScheme.set(colorScheme || 'light');
    useThemeStore.setState({
      isDarkMode: colorScheme === 'dark',
    });
  }
});

// ============================================================================
// Hydration Helper
// ============================================================================

/**
 * Theme Store Hydration 완료 대기
 *
 * @param timeout - 타임아웃 (기본 3초)
 * @returns hydration 완료 여부
 *
 * @example
 * ```typescript
 * const hydrated = await waitForThemeHydration();
 * if (hydrated) {
 *   // 복원된 테마로 작업 수행
 * }
 * ```
 */
export async function waitForThemeHydration(timeout = 3000): Promise<boolean> {
  // 이미 hydrated인 경우 즉시 반환
  if (useThemeStore.getState()._hasHydrated) {
    return true;
  }

  // hydration 완료 대기
  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeout);

    const unsubscribe = useThemeStore.subscribe((state) => {
      if (state._hasHydrated) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

export default useThemeStore;
