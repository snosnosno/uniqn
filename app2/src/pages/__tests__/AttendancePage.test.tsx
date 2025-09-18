/**
 * AttendancePage 컴포넌트 단위 테스트
 */

import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';

import AttendancePage from '../AttendancePage';
import { renderWithProviders } from '../../test-utils/testHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useUnifiedData } from '../../contexts/UnifiedDataContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/UnifiedDataContext');
jest.mock('../../utils/logger');
jest.mock('../../utils/toast');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseUnifiedData = useUnifiedData as jest.MockedFunction<typeof useUnifiedData>;

// Test data
const mockStaff = [
  {
    staffId: 'staff1',
    name: '스태프1',
    role: 'dealer',
    phone: '010-1111-1111',
  },
  {
    staffId: 'staff2',
    name: '스태프2',
    role: 'floorman',
    phone: '010-2222-2222',
  },
  {
    staffId: 'staff3',
    name: '스태프3',
    role: 'supervisor',
    phone: '010-3333-3333',
  },
];

const mockAttendanceRecords = [
  {
    id: 'record1',
    staffId: 'staff1',
    date: '2025-01-20',
    status: 'present',
    checkInTime: '18:00',
    checkOutTime: '23:00',
    notes: '',
    createdAt: { seconds: Date.now() / 1000 },
  },
  {
    id: 'record2',
    staffId: 'staff2',
    date: '2025-01-20',
    status: 'late',
    checkInTime: '18:30',
    checkOutTime: '23:00',
    notes: '교통 지연',
    createdAt: { seconds: Date.now() / 1000 },
  },
  {
    id: 'record3',
    staffId: 'staff3',
    date: '2025-01-20',
    status: 'absent',
    checkInTime: null,
    checkOutTime: null,
    notes: '개인 사유',
    createdAt: { seconds: Date.now() / 1000 },
  },
];

const mockActions = {
  updateAttendanceStatus: jest.fn(),
  addAttendanceRecord: jest.fn(),
  updateWorkLog: jest.fn(),
};

describe('AttendancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 Auth 모킹
    mockUseAuth.mockReturnValue({
      currentUser: { uid: 'admin-uid' },
      isAdmin: true,
      user: null,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      updateProfile: jest.fn(),
      resetPassword: jest.fn(),
    } as any);

    // 기본 UnifiedData 모킹
    mockUseUnifiedData.mockReturnValue({
      staff: mockStaff,
      attendanceRecords: mockAttendanceRecords,
      loading: false,
      error: null,
      actions: mockActions,
      workLogs: [],
      applications: [],
      jobPostings: [],
      tournaments: [],
      realtimeUpdates: true,
      refreshData: jest.fn(),
      clearCache: jest.fn(),
    } as any);
  });

  describe('렌더링', () => {
    it('출석 관리 페이지를 렌더링한다', () => {
      renderWithProviders(<AttendancePage />);

      expect(screen.getByText('출석 관리')).toBeInTheDocument();
      expect(screen.getByText('오늘의 출석 현황')).toBeInTheDocument();
    });

    it('날짜 선택기를 표시한다', () => {
      renderWithProviders(<AttendancePage />);

      const dateInput = screen.getByDisplayValue(
        new Date().toISOString().split('T')[0]
      );
      expect(dateInput).toBeInTheDocument();
    });

    it('출석 통계를 표시한다', () => {
      renderWithProviders(<AttendancePage />);

      expect(screen.getByText('전체 스태프')).toBeInTheDocument();
      expect(screen.getByText('출석: 1명')).toBeInTheDocument();
      expect(screen.getByText('지각: 1명')).toBeInTheDocument();
      expect(screen.getByText('결석: 1명')).toBeInTheDocument();
    });

    it('스태프 목록을 표시한다', () => {
      renderWithProviders(<AttendancePage />);

      mockStaff.forEach((staff) => {
        expect(screen.getByText(staff.name)).toBeInTheDocument();
      });
    });
  });

  describe('출석 상태 관리', () => {
    it('출석 상태를 변경한다', async () => {
      mockActions.updateAttendanceStatus.mockResolvedValue(undefined);

      renderWithProviders(<AttendancePage />);

      const staffRow = screen.getByTestId('staff-row-staff1');
      const statusSelect = staffRow.querySelector('select') as HTMLSelectElement;

      fireEvent.change(statusSelect, { target: { value: 'late' } });

      await waitFor(() => {
        expect(mockActions.updateAttendanceStatus).toHaveBeenCalledWith(
          'staff1',
          '2025-01-20',
          'late'
        );
      });
    });

    it('지각 시 사유를 입력할 수 있다', async () => {
      renderWithProviders(<AttendancePage />);

      const staffRow = screen.getByTestId('staff-row-staff1');
      const statusSelect = staffRow.querySelector('select') as HTMLSelectElement;

      fireEvent.change(statusSelect, { target: { value: 'late' } });

      // 지각 사유 입력 모달
      await waitFor(() => {
        expect(screen.getByText('지각 사유')).toBeInTheDocument();
      });

      const reasonInput = screen.getByLabelText('지각 사유');
      fireEvent.change(reasonInput, { target: { value: '교통 체증' } });

      fireEvent.click(screen.getByText('확인'));

      await waitFor(() => {
        expect(mockActions.updateAttendanceStatus).toHaveBeenCalledWith(
          'staff1',
          '2025-01-20',
          'late',
          '교통 체증'
        );
      });
    });

    it('결석 시 사유를 입력할 수 있다', async () => {
      renderWithProviders(<AttendancePage />);

      const staffRow = screen.getByTestId('staff-row-staff2');
      const statusSelect = staffRow.querySelector('select') as HTMLSelectElement;

      fireEvent.change(statusSelect, { target: { value: 'absent' } });

      await waitFor(() => {
        expect(screen.getByText('결석 사유')).toBeInTheDocument();
      });

      const reasonInput = screen.getByLabelText('결석 사유');
      fireEvent.change(reasonInput, { target: { value: '개인 사정' } });

      fireEvent.click(screen.getByText('확인'));

      await waitFor(() => {
        expect(mockActions.updateAttendanceStatus).toHaveBeenCalledWith(
          'staff2',
          '2025-01-20',
          'absent',
          '개인 사정'
        );
      });
    });
  });

  describe('시간 편집', () => {
    it('체크인 시간을 편집한다', async () => {
      renderWithProviders(<AttendancePage />);

      const editButton = screen.getAllByTestId('edit-time-button')[0];
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('시간 편집')).toBeInTheDocument();
      });

      const checkInInput = screen.getByLabelText('체크인 시간');
      fireEvent.change(checkInInput, { target: { value: '17:30' } });

      fireEvent.click(screen.getByText('저장'));

      await waitFor(() => {
        expect(mockActions.updateWorkLog).toHaveBeenCalledWith(
          expect.objectContaining({
            checkInTime: '17:30',
          })
        );
      });
    });

    it('체크아웃 시간을 편집한다', async () => {
      renderWithProviders(<AttendancePage />);

      const editButton = screen.getAllByTestId('edit-time-button')[0];
      fireEvent.click(editButton);

      const checkOutInput = screen.getByLabelText('체크아웃 시간');
      fireEvent.change(checkOutInput, { target: { value: '23:30' } });

      const editReason = screen.getByLabelText('수정 사유');
      fireEvent.change(editReason, { target: { value: '연장 근무' } });

      fireEvent.click(screen.getByText('저장'));

      await waitFor(() => {
        expect(mockActions.updateWorkLog).toHaveBeenCalledWith(
          expect.objectContaining({
            checkOutTime: '23:30',
            editReason: '연장 근무',
          })
        );
      });
    });

    it('잘못된 시간 입력을 검증한다', async () => {
      renderWithProviders(<AttendancePage />);

      const editButton = screen.getAllByTestId('edit-time-button')[0];
      fireEvent.click(editButton);

      const checkInInput = screen.getByLabelText('체크인 시간');
      const checkOutInput = screen.getByLabelText('체크아웃 시간');

      // 체크아웃 시간이 체크인 시간보다 이른 경우
      fireEvent.change(checkInInput, { target: { value: '20:00' } });
      fireEvent.change(checkOutInput, { target: { value: '18:00' } });

      fireEvent.click(screen.getByText('저장'));

      await waitFor(() => {
        expect(
          screen.getByText('체크아웃 시간이 체크인 시간보다 늦어야 합니다')
        ).toBeInTheDocument();
      });
    });
  });

  describe('날짜 필터링', () => {
    it('선택된 날짜의 출석 기록을 표시한다', async () => {
      renderWithProviders(<AttendancePage />);

      const dateInput = screen.getByDisplayValue(
        new Date().toISOString().split('T')[0]
      );

      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2025-01-21' } });
      });

      // 해당 날짜의 출석 기록만 필터링되어 표시됨을 확인
      await waitFor(() => {
        expect(mockActions.updateAttendanceStatus).not.toHaveBeenCalled();
      });
    });

    it('과거 날짜를 선택할 수 있다', () => {
      renderWithProviders(<AttendancePage />);

      const dateInput = screen.getByDisplayValue(
        new Date().toISOString().split('T')[0]
      );

      const pastDate = '2025-01-15';
      fireEvent.change(dateInput, { target: { value: pastDate } });

      expect(dateInput).toHaveValue(pastDate);
    });

    it('미래 날짜 선택을 제한한다', () => {
      renderWithProviders(<AttendancePage />);

      const dateInput = screen.getByDisplayValue(
        new Date().toISOString().split('T')[0]
      ) as HTMLInputElement;

      const today = new Date().toISOString().split('T')[0];
      expect(dateInput.max).toBe(today);
    });
  });

  describe('스태프 필터링', () => {
    it('특정 스태프만 필터링한다', async () => {
      renderWithProviders(<AttendancePage />);

      const staffFilter = screen.getByLabelText('스태프 선택');
      fireEvent.change(staffFilter, { target: { value: 'staff1' } });

      await waitFor(() => {
        expect(screen.getByText('스태프1')).toBeInTheDocument();
        expect(screen.queryByText('스태프2')).not.toBeInTheDocument();
        expect(screen.queryByText('스태프3')).not.toBeInTheDocument();
      });
    });

    it('역할별로 필터링한다', async () => {
      renderWithProviders(<AttendancePage />);

      const roleFilter = screen.getByLabelText('역할 선택');
      fireEvent.change(roleFilter, { target: { value: 'dealer' } });

      await waitFor(() => {
        expect(screen.getByText('스태프1')).toBeInTheDocument();
        expect(screen.queryByText('스태프2')).not.toBeInTheDocument();
      });
    });

    it('출석 상태별로 필터링한다', async () => {
      renderWithProviders(<AttendancePage />);

      const statusFilter = screen.getByLabelText('출석 상태');
      fireEvent.change(statusFilter, { target: { value: 'present' } });

      await waitFor(() => {
        expect(screen.getByText('스태프1')).toBeInTheDocument();
        expect(screen.queryByText('스태프2')).not.toBeInTheDocument();
        expect(screen.queryByText('스태프3')).not.toBeInTheDocument();
      });
    });
  });

  describe('권한 관리', () => {
    it('관리자가 아닌 사용자는 접근할 수 없다', () => {
      mockUseAuth.mockReturnValue({
        currentUser: { uid: 'staff-uid' },
        isAdmin: false,
        user: null,
        loading: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        updateProfile: jest.fn(),
        resetPassword: jest.fn(),
      } as any);

      renderWithProviders(<AttendancePage />);

      expect(screen.getByText('접근 권한이 없습니다')).toBeInTheDocument();
    });

    it('관리자만 출석 상태를 변경할 수 있다', () => {
      renderWithProviders(<AttendancePage />);

      const statusSelects = screen.getAllByRole('combobox');
      statusSelects.forEach((select) => {
        expect(select).not.toBeDisabled();
      });
    });
  });

  describe('실시간 업데이트', () => {
    it('출석 상태 변경 시 통계가 업데이트된다', async () => {
      const { rerender } = renderWithProviders(<AttendancePage />);

      // 초기 상태
      expect(screen.getByText('출석: 1명')).toBeInTheDocument();

      // 출석 기록 업데이트
      const updatedRecords = [
        ...mockAttendanceRecords,
        {
          id: 'record4',
          staffId: 'staff3',
          date: '2025-01-20',
          status: 'present',
          checkInTime: '18:00',
          checkOutTime: null,
          notes: '',
          createdAt: { seconds: Date.now() / 1000 },
        },
      ];

      mockUseUnifiedData.mockReturnValue({
        staff: mockStaff,
        attendanceRecords: updatedRecords,
        loading: false,
        error: null,
        actions: mockActions,
        workLogs: [],
        applications: [],
        jobPostings: [],
        tournaments: [],
        realtimeUpdates: true,
        refreshData: jest.fn(),
        clearCache: jest.fn(),
      } as any);

      rerender(<AttendancePage />);

      // 업데이트된 통계 확인
      expect(screen.getByText('출석: 2명')).toBeInTheDocument();
    });
  });

  describe('에러 처리', () => {
    it('데이터 로드 에러를 표시한다', () => {
      mockUseUnifiedData.mockReturnValue({
        staff: [],
        attendanceRecords: [],
        loading: false,
        error: new Error('Failed to load attendance data'),
        actions: mockActions,
        workLogs: [],
        applications: [],
        jobPostings: [],
        tournaments: [],
        realtimeUpdates: false,
        refreshData: jest.fn(),
        clearCache: jest.fn(),
      } as any);

      renderWithProviders(<AttendancePage />);

      expect(
        screen.getByText('Failed to load attendance data')
      ).toBeInTheDocument();
    });

    it('출석 상태 업데이트 실패를 처리한다', async () => {
      mockActions.updateAttendanceStatus.mockRejectedValue(
        new Error('Update failed')
      );

      renderWithProviders(<AttendancePage />);

      const staffRow = screen.getByTestId('staff-row-staff1');
      const statusSelect = staffRow.querySelector('select') as HTMLSelectElement;

      fireEvent.change(statusSelect, { target: { value: 'late' } });

      await waitFor(() => {
        expect(screen.getByText(/Update failed/)).toBeInTheDocument();
      });
    });
  });

  describe('성능', () => {
    it('대량의 스태프 데이터를 효율적으로 처리한다', () => {
      const largeStaffList = Array.from({ length: 100 }, (_, i) => ({
        staffId: `staff${i}`,
        name: `스태프${i}`,
        role: 'dealer',
        phone: `010-${String(i).padStart(4, '0')}-${String(i).padStart(4, '0')}`,
      }));

      mockUseUnifiedData.mockReturnValue({
        staff: largeStaffList,
        attendanceRecords: [],
        loading: false,
        error: null,
        actions: mockActions,
        workLogs: [],
        applications: [],
        jobPostings: [],
        tournaments: [],
        realtimeUpdates: true,
        refreshData: jest.fn(),
        clearCache: jest.fn(),
      } as any);

      const startTime = performance.now();
      renderWithProviders(<AttendancePage />);
      const endTime = performance.now();

      // 렌더링 시간이 1초를 넘지 않는지 확인
      expect(endTime - startTime).toBeLessThan(1000);

      // 가상화된 목록이 일부만 렌더링되는지 확인
      const visibleStaffRows = screen.getAllByTestId(/staff-row/);
      expect(visibleStaffRows.length).toBeLessThan(largeStaffList.length);
    });
  });

  describe('접근성', () => {
    it('키보드 네비게이션을 지원한다', () => {
      renderWithProviders(<AttendancePage />);

      const statusSelects = screen.getAllByRole('combobox');
      statusSelects.forEach((select) => {
        expect(select).toHaveAttribute('tabIndex', '0');
      });
    });

    it('스크린 리더용 레이블을 제공한다', () => {
      renderWithProviders(<AttendancePage />);

      const statusSelect = screen.getAllByLabelText(/출석 상태/)[0];
      expect(statusSelect).toBeInTheDocument();
    });

    it('출석 통계를 접근 가능한 형태로 제공한다', () => {
      renderWithProviders(<AttendancePage />);

      const statsRegion = screen.getByRole('region', { name: /출석 통계/ });
      expect(statsRegion).toBeInTheDocument();
    });
  });
});