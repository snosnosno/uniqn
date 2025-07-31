import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender, mockUser } from '../setup/test-utils';
import StaffListPage from '../../pages/StaffListPage';
import { setupFirestoreMock, mockFirestore } from '../setup/firebase-mock';
import { Timestamp } from 'firebase/firestore';

// Mock 데이터
const mockJobPosting = {
  id: 'posting-1',
  title: '2024 여름 토너먼트',
  description: '대규모 토너먼트 스태프 모집',
  location: '서울',
  status: 'open',
  createdBy: 'admin-1',
  createdAt: Timestamp.now()
};

const mockStaffData = [
  {
    id: 'staff-1',
    userId: 'user-1',
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1234-5678',
    role: 'Dealer',
    userRole: 'staff',
    assignedRole: '딜러',
    assignedTime: '09:00-18:00',
    assignedDate: '2024-07-25',
    postingId: 'posting-1',
    postingTitle: '2024 여름 토너먼트'
  },
  {
    id: 'staff-2',
    userId: 'user-2',
    name: '김철수',
    email: 'kim@example.com',
    phone: '010-9876-5432',
    role: 'Floor',
    userRole: 'staff',
    assignedRole: '플로어',
    assignedTime: '10:00-19:00',
    assignedDate: '2024-07-25',
    postingId: 'posting-1',
    postingTitle: '2024 여름 토너먼트'
  }
];

const mockWorkLogs = [
  {
    id: 'worklog-1',
    staffId: 'staff-1',
    dealerId: 'user-1',
    date: '2024-07-25',
    scheduledStartTime: '09:00',
    scheduledEndTime: '18:00',
    actualStartTime: null,
    actualEndTime: null,
    status: 'not_started'
  },
  {
    id: 'worklog-2',
    staffId: 'staff-2',
    dealerId: 'user-2',
    date: '2024-07-25',
    scheduledStartTime: '10:00',
    scheduledEndTime: '19:00',
    actualStartTime: '10:05',
    actualEndTime: null,
    status: 'checked_in'
  }
];

describe('스태프 관리 통합 테스트', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // Firestore 모킹 설정
    setupFirestoreMock(mockStaffData);
    
    // JobPostingContext 모킹
    jest.mock('../../contexts/JobPostingContext', () => ({
      useJobPostingContext: () => ({
        staff: mockStaffData,
        isLoading: false,
        selectedJobPosting: mockJobPosting
      })
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('스태프 목록 페이지', () => {
    test('스태프 목록이 올바르게 표시되어야 함', async () => {
      customRender(<StaffListPage />);

      // 로딩이 끝나기를 기다림
      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.getByText('김철수')).toBeInTheDocument();
      });

      // 역할과 시간 정보 확인
      expect(screen.getByText('딜러')).toBeInTheDocument();
      expect(screen.getByText('플로어')).toBeInTheDocument();
      expect(screen.getByText('09:00-18:00')).toBeInTheDocument();
      expect(screen.getByText('10:00-19:00')).toBeInTheDocument();
    });

    test('검색 기능이 작동해야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 검색어 입력
      const searchInput = screen.getByPlaceholderText('이름, 이메일 또는 전화번호로 검색');
      await user.type(searchInput, '홍길동');

      // 검색 결과 확인
      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.queryByText('김철수')).not.toBeInTheDocument();
      });
    });

    test('날짜별 필터링이 작동해야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 날짜 필터 선택
      const dateFilter = screen.getByLabelText('날짜 필터');
      await user.selectOptions(dateFilter, '2024-07-25');

      // 필터링 결과 확인
      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.getByText('김철수')).toBeInTheDocument();
      });
    });

    test('역할별 필터링이 작동해야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 역할 필터 선택
      const roleFilter = screen.getByLabelText('역할 필터');
      await user.selectOptions(roleFilter, '딜러');

      // 필터링 결과 확인
      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.queryByText('김철수')).not.toBeInTheDocument();
      });
    });
  });

  describe('출석 관리 기능', () => {
    test('출석 상태를 변경할 수 있어야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 첫 번째 스태프의 출석 상태 버튼 클릭
      const attendanceButtons = screen.getAllByRole('button', { name: /출근 전/i });
      await user.click(attendanceButtons[0]);

      // 출근 옵션 선택
      const checkInOption = await screen.findByText('출근');
      await user.click(checkInOption);

      // API 호출 확인
      await waitFor(() => {
        expect(mockFirestore.update).toHaveBeenCalled();
      });
    });

    test('시간 편집 모달이 열려야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('09:00-18:00')).toBeInTheDocument();
      });

      // 시간 클릭
      const timeElement = screen.getByText('09:00-18:00');
      await user.click(timeElement);

      // 모달 확인
      await waitFor(() => {
        expect(screen.getByText('근무 시간 편집')).toBeInTheDocument();
      });
    });
  });

  describe('벌크 액션 기능', () => {
    test('다중 선택 모드를 활성화할 수 있어야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 다중 선택 버튼 클릭
      const multiSelectButton = screen.getByRole('button', { name: /다중 선택/i });
      await user.click(multiSelectButton);

      // 체크박스가 나타나는지 확인
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    test('선택된 스태프에 대해 벌크 액션을 수행할 수 있어야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 다중 선택 모드 활성화
      const multiSelectButton = screen.getByRole('button', { name: /다중 선택/i });
      await user.click(multiSelectButton);

      // 스태프 선택
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // 벌크 액션 버튼 확인
      expect(screen.getByText('2명 선택됨')).toBeInTheDocument();
      
      // 일괄 출근 처리 버튼 클릭
      const bulkCheckInButton = screen.getByRole('button', { name: /일괄 출근 처리/i });
      await user.click(bulkCheckInButton);

      // 확인 모달
      await waitFor(() => {
        expect(screen.getByText(/2명의 스태프를 출근 처리하시겠습니까?/i)).toBeInTheDocument();
      });
    });
  });

  describe('프로필 보기 기능', () => {
    test('스태프 프로필 모달이 열려야 함', async () => {
      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 프로필 버튼 클릭
      const profileButtons = screen.getAllByRole('button', { name: /프로필/i });
      await user.click(profileButtons[0]);

      // 프로필 모달 확인
      await waitFor(() => {
        expect(screen.getByText('스태프 프로필')).toBeInTheDocument();
        expect(screen.getByText('홍길동')).toBeInTheDocument();
        expect(screen.getByText('hong@example.com')).toBeInTheDocument();
        expect(screen.getByText('010-1234-5678')).toBeInTheDocument();
      });
    });
  });

  describe('모바일 반응형 UI', () => {
    test('모바일 뷰에서는 카드 레이아웃이 표시되어야 함', async () => {
      // 모바일 뷰포트 설정
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 카드 레이아웃 확인
      const cards = screen.getAllByTestId('staff-card');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('오류 처리', () => {
    test('데이터 로드 실패 시 에러 메시지가 표시되어야 함', async () => {
      // Firestore 에러 모킹
      mockFirestore.onSnapshot.mockImplementation(() => {
        throw new Error('Failed to load data');
      });

      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText(/데이터를 불러오는 중 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });

    test('스태프 삭제 실패 시 에러 토스트가 표시되어야 함', async () => {
      mockFirestore.delete.mockRejectedValue(new Error('Delete failed'));

      customRender(<StaffListPage />);

      await waitFor(() => {
        expect(screen.getByText('홍길동')).toBeInTheDocument();
      });

      // 삭제 버튼 클릭
      const deleteButtons = screen.getAllByRole('button', { name: /삭제/i });
      await user.click(deleteButtons[0]);

      // 확인
      const confirmButton = screen.getByRole('button', { name: /확인/i });
      await user.click(confirmButton);

      // 에러 토스트 확인
      await waitFor(() => {
        expect(screen.getByText(/삭제하는 중 오류가 발생했습니다/i)).toBeInTheDocument();
      });
    });
  });
});