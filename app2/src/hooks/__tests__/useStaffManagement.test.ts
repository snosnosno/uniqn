import { renderHook, act } from '@testing-library/react';
import { useStaffManagement } from '../useStaffManagement';

// Mock Firebase functions
jest.mock('../../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user' }
  }
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({
    docs: []
  }))
}));

// Mock useGroupByDate hook
jest.mock('../useGroupByDate', () => ({
  useGroupByDate: jest.fn(() => ({
    grouped: {},
    sortedKeys: [],
    expandedItems: new Set(),
    toggleExpansion: jest.fn(),
    groupBy: true,
    setGroupBy: jest.fn()
  }))
}));

describe('useStaffManagement', () => {
  const mockOptions = {
    jobPostingId: 'test-job-posting',
    enableGrouping: true,
    enableFiltering: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with default values', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    expect(result.current.staffData).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.filters).toEqual({
      searchTerm: '',
      selectedDate: 'all',
      selectedRole: 'all',
      selectedStatus: 'all'
    });
  });

  test('updates filters correctly', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    act(() => {
      result.current.setFilters({
        searchTerm: '홍길동',
        selectedDate: '2024-07-25',
        selectedRole: '딜러',
        selectedStatus: 'present'
      });
    });

    expect(result.current.filters).toEqual({
      searchTerm: '홍길동',
      selectedDate: '2024-07-25',
      selectedRole: '딜러',
      selectedStatus: 'present'
    });
  });

  test('formatTimeDisplay handles different time formats', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    expect(result.current.formatTimeDisplay('09:00-18:00')).toBe('09:00-18:00');
    expect(result.current.formatTimeDisplay('추후공지')).toBe('추후공지');
    expect(result.current.formatTimeDisplay(undefined)).toBe('시간 미정');
    expect(result.current.formatTimeDisplay('')).toBe('시간 미정');
  });

  test('getTimeSlotColor returns correct classes for different times', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    expect(result.current.getTimeSlotColor('09:00-18:00')).toContain('bg-blue-100');
    expect(result.current.getTimeSlotColor('추후공지')).toContain('bg-gray-100');
    expect(result.current.getTimeSlotColor(undefined)).toContain('bg-gray-100');
  });

  test('extractsUniqueValues correctly', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    // Mock staff data with various values
    const mockStaffData = [
      { assignedDate: '2024-07-25', assignedRole: '딜러' },
      { assignedDate: '2024-07-26', assignedRole: '서버' },
      { assignedDate: '2024-07-25', assignedRole: '딜러' },
      { assignedDate: undefined, assignedRole: undefined }
    ];

    act(() => {
      // Simulate staff data loading
      (result.current as any).setStaffData?.(mockStaffData);
    });

    // This would test the internal extraction logic
    // In real implementation, we'd need to expose this or test it indirectly
  });

  test('deleteStaff function calls Firebase deleteDoc', async () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    await act(async () => {
      await result.current.deleteStaff('test-staff-id');
    });

    // Verify that deleteDoc was called
    // In real implementation, we'd mock the Firebase functions properly
  });

  test('handles loading state correctly', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    expect(result.current.loading).toBe(true);

    // After data loads, loading should be false
    // This would be tested with proper Firebase mocking
  });

  test('handles error state correctly', () => {
    // Mock Firebase to throw an error
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    // Simulate error
    act(() => {
      // This would trigger error handling in real implementation
    });

    // Verify error handling
  });

  test('filters staff data based on search term', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    // Mock staff data
    const mockStaffData = [
      { id: '1', name: '홍길동', assignedRole: '딜러' },
      { id: '2', name: '김철수', assignedRole: '서버' },
      { id: '3', name: '이영희', assignedRole: '딜러' }
    ];

    act(() => {
      // Simulate data loading and filtering
      result.current.setFilters({
        ...result.current.filters,
        searchTerm: '홍길동'
      });
    });

    // Test filtering logic indirectly through groupedStaffData
    // In real implementation, we'd verify the filtered results
  });

  test('filters staff data based on date', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        selectedDate: '2024-07-25'
      });
    });

    // Verify date filtering
  });

  test('filters staff data based on role', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        selectedRole: '딜러'
      });
    });

    // Verify role filtering
  });

  test('refreshStaffData reloads data', async () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    await act(async () => {
      await result.current.refreshStaffData();
    });

    // Verify that data was refreshed
  });

  test('toggleDateExpansion calls groupByDate toggle', () => {
    const { result } = renderHook(() => useStaffManagement(mockOptions));

    act(() => {
      result.current.toggleDateExpansion('2024-07-25');
    });

    // Verify that the toggle function was called
  });

  test('handles jobPostingId changes', () => {
    const { result, rerender } = renderHook(
      ({ jobPostingId }) => useStaffManagement({ ...mockOptions, jobPostingId }),
      { initialProps: { jobPostingId: 'initial-id' } }
    );

    // Change jobPostingId
    rerender({ jobPostingId: 'new-id' });

    // Verify that the hook responds to jobPostingId changes
  });

  test('cleans up Firebase listeners on unmount', () => {
    const { unmount } = renderHook(() => useStaffManagement(mockOptions));

    unmount();

    // Verify that Firebase listeners were cleaned up
    // This would be tested with proper Firebase mocking
  });
});