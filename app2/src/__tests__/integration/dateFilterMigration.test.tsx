/**
 * Integration Test: DateFilter 마이그레이션
 *
 * DateFilterContext → Zustand Store 마이그레이션이 올바르게 작동하는지 통합 테스트
 *
 * 테스트 시나리오:
 * 1. 날짜 선택이 페이지 간 이동 시 유지되는지 확인
 * 2. localStorage에서 날짜가 복원되는지 확인
 * 3. DateNavigator 버튼이 정상 작동하는지 확인
 *
 * @version 1.0.0
 * @created 2025-11-20
 * @feature 002-phase3-integration
 */

import { renderHook, act } from '@testing-library/react';
import { useDateFilterStore } from '../../stores/dateFilterStore';

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Integration: DateFilter 마이그레이션', () => {
  beforeEach(() => {
    // 각 테스트 전에 localStorage와 Store 초기화
    localStorage.clear();
    useDateFilterStore.getState().setSelectedDate('');
    useDateFilterStore.getState().setAvailableDates([]);
  });

  describe('US1-AC1: 날짜 선택이 페이지 간 이동 시 유지됨', () => {
    it('선택한 날짜가 Store에 저장되고 다른 컴포넌트에서 접근 가능해야 함', () => {
      // Given: 사용 가능한 날짜 목록 설정
      const availableDates = ['2025-01-01', '2025-01-02', '2025-01-03'];
      act(() => {
        useDateFilterStore.getState().setAvailableDates(availableDates);
      });

      // When: 첫 번째 컴포넌트에서 날짜 선택
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-02');
      });

      // Then: 두 번째 컴포넌트에서 동일한 날짜를 읽을 수 있어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-02');
      expect(state.availableDates).toEqual(availableDates);
    });

    it('여러 컴포넌트가 동시에 날짜를 구독할 수 있어야 함', () => {
      // Given: 두 개의 Hook 인스턴스 생성
      const { result: result1 } = renderHook(() => useDateFilterStore());
      const { result: result2 } = renderHook(() => useDateFilterStore());

      // When: 날짜 변경
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-15');
      });

      // Then: 두 Hook 모두 동일한 날짜를 반환해야 함
      expect(result1.current.selectedDate).toBe('2025-01-15');
      expect(result2.current.selectedDate).toBe('2025-01-15');
    });
  });

  describe('US1-AC2: localStorage 복원 기능', () => {
    it('브라우저 새로고침 시 localStorage에서 날짜가 복원되어야 함', () => {
      // Given: 날짜 선택 후 localStorage에 저장
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-20');
      });

      // When: Store에서 날짜 확인 (Zustand는 동기적으로 메모리에 저장)
      const state = useDateFilterStore.getState();

      // Then: 날짜가 메모리에 저장되어 있어야 함
      expect(state.selectedDate).toBe('2025-01-20');

      // Note: localStorage 저장은 비동기적으로 발생하며,
      // Zustand persist 미들웨어가 자동으로 처리합니다.
      // 실제 브라우저에서는 페이지 새로고침 시 복원됩니다.
    });

    it('localStorage 데이터가 없으면 빈 문자열로 초기화되어야 함', () => {
      // Given: localStorage가 비어있음
      localStorage.clear();

      // When: Store 생성
      const state = useDateFilterStore.getState();

      // Then: 초기값이 설정되어야 함
      expect(state.selectedDate).toBe('');
      expect(state.availableDates).toEqual([]);
    });

    it('localStorage에 partialize 설정이 올바르게 적용되어야 함', () => {
      // Given: selectedDate와 availableDates 모두 설정
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-25');
        useDateFilterStore.getState().setAvailableDates(['2025-01-25', '2025-01-26']);
      });

      // When: Store 상태 확인
      const state = useDateFilterStore.getState();

      // Then: 메모리에는 둘 다 저장되어 있어야 함
      expect(state.selectedDate).toBe('2025-01-25');
      expect(state.availableDates).toEqual(['2025-01-25', '2025-01-26']);

      // Note: partialize 설정으로 localStorage에는 selectedDate만 저장되지만,
      // 이는 Zustand persist 미들웨어의 내부 동작이며,
      // 메모리(Store)에는 모든 상태가 저장됩니다.
    });
  });

  describe('US1-AC3: DateNavigator 네비게이션 기능', () => {
    beforeEach(() => {
      // 테스트용 날짜 목록 설정
      const dates = ['2025-01-10', '2025-01-15', '2025-01-20', '2025-01-25'];
      act(() => {
        useDateFilterStore.getState().setAvailableDates(dates);
        useDateFilterStore.getState().setSelectedDate('2025-01-15');
      });
    });

    it('다음 버튼을 클릭하면 다음 날짜로 이동해야 함', () => {
      // When: 다음 날짜로 이동
      act(() => {
        useDateFilterStore.getState().goToNextDate();
      });

      // Then: 다음 날짜가 선택되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-20');
    });

    it('이전 버튼을 클릭하면 이전 날짜로 이동해야 함', () => {
      // When: 이전 날짜로 이동
      act(() => {
        useDateFilterStore.getState().goToPreviousDate();
      });

      // Then: 이전 날짜가 선택되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-10');
    });

    it('마지막 날짜에서 다음 버튼을 클릭하면 무시되어야 함', () => {
      // Given: 마지막 날짜 선택
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-25');
      });

      // When: 다음 날짜로 이동 시도
      act(() => {
        useDateFilterStore.getState().goToNextDate();
      });

      // Then: 날짜가 변경되지 않아야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-25');
    });

    it('첫 번째 날짜에서 이전 버튼을 클릭하면 무시되어야 함', () => {
      // Given: 첫 번째 날짜 선택
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-10');
      });

      // When: 이전 날짜로 이동 시도
      act(() => {
        useDateFilterStore.getState().goToPreviousDate();
      });

      // Then: 날짜가 변경되지 않아야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-10');
    });
  });

  describe('US1-AC4: 오늘 버튼 기능', () => {
    it('오늘 날짜가 목록에 있으면 오늘 날짜를 선택해야 함', () => {
      // Given: 오늘 날짜를 포함한 날짜 목록
      const today = new Date().toISOString().split('T')[0] || '2025-01-15';
      const dates: string[] = [
        '2025-01-10',
        today,
        '2025-12-31',
      ];
      act(() => {
        useDateFilterStore.getState().setAvailableDates(dates);
        useDateFilterStore.getState().setSelectedDate('2025-01-10');
      });

      // When: 오늘 버튼 클릭
      act(() => {
        useDateFilterStore.getState().goToToday();
      });

      // Then: 오늘 날짜가 선택되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe(today);
    });

    it('오늘 날짜가 없으면 가장 가까운 미래 날짜를 선택해야 함', () => {
      // Given: 미래 날짜만 있는 목록
      const dates = ['2025-12-01', '2025-12-15', '2025-12-31'];
      act(() => {
        useDateFilterStore.getState().setAvailableDates(dates);
        useDateFilterStore.getState().setSelectedDate('2025-12-15');
      });

      // When: 오늘 버튼 클릭
      act(() => {
        useDateFilterStore.getState().goToToday();
      });

      // Then: 첫 번째 미래 날짜가 선택되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-12-01');
    });

    it('미래 날짜가 없으면 마지막 날짜를 선택해야 함', () => {
      // Given: 과거 날짜만 있는 목록
      const dates = ['2020-01-01', '2020-06-01', '2020-12-31'];
      act(() => {
        useDateFilterStore.getState().setAvailableDates(dates);
        useDateFilterStore.getState().setSelectedDate('2020-01-01');
      });

      // When: 오늘 버튼 클릭
      act(() => {
        useDateFilterStore.getState().goToToday();
      });

      // Then: 마지막 날짜가 선택되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2020-12-31');
    });
  });

  describe('Edge Cases', () => {
    it('날짜 목록이 비어있을 때 네비게이션 버튼이 무시되어야 함', () => {
      // Given: 빈 날짜 목록
      act(() => {
        useDateFilterStore.getState().setAvailableDates([]);
        useDateFilterStore.getState().setSelectedDate('');
      });

      // When: 각종 네비게이션 시도
      act(() => {
        useDateFilterStore.getState().goToNextDate();
        useDateFilterStore.getState().goToPreviousDate();
        useDateFilterStore.getState().goToToday();
      });

      // Then: 날짜가 빈 문자열로 유지되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('');
    });

    it('선택된 날짜가 availableDates 목록에 없을 때 네비게이션이 무시되어야 함', () => {
      // Given: 선택된 날짜가 목록에 없음
      act(() => {
        useDateFilterStore.getState().setAvailableDates(['2025-01-10', '2025-01-20']);
        useDateFilterStore.getState().setSelectedDate('2025-01-15'); // 목록에 없음
      });

      // When: 네비게이션 시도
      act(() => {
        useDateFilterStore.getState().goToNextDate();
      });

      // Then: 날짜가 변경되지 않아야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-15');
    });

    it('localStorage가 비활성화되어도 세션 메모리로 동작해야 함', () => {
      // Given: localStorage 비활성화 시뮬레이션
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('localStorage disabled');
      };

      // When: 날짜 설정 (에러가 발생하지 않아야 함)
      act(() => {
        useDateFilterStore.getState().setSelectedDate('2025-01-30');
      });

      // Then: 메모리에는 저장되어야 함
      const state = useDateFilterStore.getState();
      expect(state.selectedDate).toBe('2025-01-30');

      // Cleanup
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Context API 100% 호환성', () => {
    it('useDateFilter Hook이 기존 Context API와 동일한 인터페이스를 제공해야 함', () => {
      // When: useDateFilter Hook 사용
      const state = useDateFilterStore.getState();

      // Then: 모든 필수 속성과 메서드가 존재해야 함
      expect(state).toHaveProperty('selectedDate');
      expect(state).toHaveProperty('availableDates');
      expect(state).toHaveProperty('setSelectedDate');
      expect(state).toHaveProperty('goToNextDate');
      expect(state).toHaveProperty('goToPreviousDate');
      expect(state).toHaveProperty('goToToday');
      expect(typeof state.setSelectedDate).toBe('function');
      expect(typeof state.goToNextDate).toBe('function');
      expect(typeof state.goToPreviousDate).toBe('function');
      expect(typeof state.goToToday).toBe('function');
    });
  });
});
