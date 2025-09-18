/**
 * ProfilePage 컴포넌트 단위 테스트
 */

import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { useParams } from 'react-router-dom';

import ProfilePage from '../ProfilePage';
import { renderWithProviders } from '../../test-utils/testHelpers';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  Link: ({ children, to, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('../../contexts/AuthContext');
jest.mock('../../firebase');
jest.mock('../../utils/logger');
jest.mock('../../utils/toast');

// Mock Firebase functions
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;

// Test data
const mockUserProfile = {
  name: '테스트 사용자',
  email: 'test@example.com',
  phone: '010-1234-5678',
  role: 'staff',
  experience: '2년',
  region: 'seoul',
  nationality: 'KR',
  age: 25,
  gender: 'male',
  rating: 4.5,
  ratingCount: 10,
  history: '홀덤 딜러 경력 2년',
  notes: '성실한 스태프입니다',
  bankName: '국민은행',
  bankAccount: '123-456-789',
  residentId: '901234-1234567',
};

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 Auth 모킹
    mockUseAuth.mockReturnValue({
      currentUser: { uid: 'test-uid' },
      isAdmin: false,
      user: null,
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      updateProfile: jest.fn(),
      resetPassword: jest.fn(),
    } as any);

    mockUseParams.mockReturnValue({});

    // Firebase 문서 모킹
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockUserProfile,
    });
  });

  describe('렌더링', () => {
    it('로딩 상태를 표시한다', async () => {
      mockGetDoc.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ exists: () => false }), 100);
          })
      );

      renderWithProviders(<ProfilePage />);

      expect(screen.getByText('프로필을 불러오는 중입니다')).toBeInTheDocument();
    });

    it('사용자 프로필 정보를 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(mockUserProfile.name)).toBeInTheDocument();
      });

      expect(screen.getByText(mockUserProfile.email)).toBeInTheDocument();
      expect(screen.getByText(mockUserProfile.phone)).toBeInTheDocument();
      expect(screen.getByText('2년')).toBeInTheDocument();
      expect(screen.getByText('🇰🇷 South Korea')).toBeInTheDocument();
    });

    it('별점 정보를 올바르게 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('4.5')).toBeInTheDocument();
      });

      expect(screen.getByText('(10 평가)')).toBeInTheDocument();
    });

    it('프로필 편집 버튼을 표시한다 (본인 프로필인 경우)', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('프로필 편집')).toBeInTheDocument();
      });
    });
  });

  describe('프로필 편집', () => {
    it('편집 모드로 전환한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('프로필 편집')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('프로필 편집'));

      expect(screen.getByText('취소')).toBeInTheDocument();
      expect(screen.getByText('변경사항 저장')).toBeInTheDocument();
    });

    it('폼 필드에 기존 데이터를 채운다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      const phoneInput = screen.getByDisplayValue(mockUserProfile.phone);
      expect(phoneInput).toBeInTheDocument();

      const experienceSelect = screen.getByDisplayValue(mockUserProfile.experience);
      expect(experienceSelect).toBeInTheDocument();
    });

    it('프로필 정보를 수정한다', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockUserProfile,
      }).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ ...mockUserProfile, phone: '010-9876-5432' }),
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      const phoneInput = screen.getByDisplayValue(mockUserProfile.phone);
      fireEvent.change(phoneInput, { target: { value: '010-9876-5432' } });

      const saveButton = screen.getByText('변경사항 저장');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSetDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            phone: '010-9876-5432',
          }),
          { merge: true }
        );
      });
    });

    it('편집을 취소한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      fireEvent.click(screen.getByText('취소'));

      expect(screen.getByText('프로필 편집')).toBeInTheDocument();
      expect(screen.queryByText('취소')).not.toBeInTheDocument();
    });
  });

  describe('권한 관리', () => {
    it('다른 사용자의 프로필을 볼 때 편집 버튼을 숨긴다', async () => {
      mockUseParams.mockReturnValue({ userId: 'other-user-id' });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(mockUserProfile.name)).toBeInTheDocument();
      });

      expect(screen.queryByText('프로필 편집')).not.toBeInTheDocument();
    });

    it('관리자는 급여내역 버튼이 표시되지 않는다', async () => {
      mockUseAuth.mockReturnValue({
        currentUser: { uid: 'test-uid' },
        isAdmin: true,
        user: null,
        loading: false,
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        updateProfile: jest.fn(),
        resetPassword: jest.fn(),
      } as any);

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(mockUserProfile.name)).toBeInTheDocument();
      });

      // 급여내역 버튼이 삭제되어 표시되지 않음을 확인
      expect(screen.queryByText('급여 내역')).not.toBeInTheDocument();
    });

    it('개인 정보를 본인에게만 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('개인 정보')).toBeInTheDocument();
      });

      expect(screen.getByText(mockUserProfile.bankName)).toBeInTheDocument();
      expect(screen.getByText(mockUserProfile.bankAccount)).toBeInTheDocument();
    });
  });

  describe('에러 처리', () => {
    it('프로필이 존재하지 않을 때 에러를 표시한다', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/사용자를 찾을 수 없습니다/)).toBeInTheDocument();
      });
    });

    it('Firebase 에러를 처리한다', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('프로필 업데이트 실패를 처리한다', async () => {
      mockSetDoc.mockRejectedValue(new Error('Update failed'));

      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      const phoneInput = screen.getByDisplayValue(mockUserProfile.phone);
      fireEvent.change(phoneInput, { target: { value: '010-9999-9999' } });

      fireEvent.click(screen.getByText('변경사항 저장'));

      await waitFor(() => {
        expect(screen.getByText(/Update failed/)).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    it('적절한 ARIA 레이블을 가진다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      const nameInput = screen.getByLabelText(/이름/);
      expect(nameInput).toHaveAttribute('readonly');

      const phoneInput = screen.getByLabelText(/전화번호/);
      expect(phoneInput).not.toHaveAttribute('readonly');
    });

    it('폼 유효성 검사를 수행한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        fireEvent.click(screen.getByText('프로필 편집'));
      });

      const ageInput = screen.getByLabelText(/나이/);
      fireEvent.change(ageInput, { target: { value: '150' } });

      expect(ageInput).toHaveAttribute('max', '100');
    });
  });

  describe('국제화', () => {
    it('국가 정보를 올바른 형식으로 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('🇰🇷 South Korea')).toBeInTheDocument();
      });
    });

    it('지역 정보를 현지화된 형식으로 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/서울/)).toBeInTheDocument();
      });
    });

    it('성별 정보를 현지화된 형식으로 표시한다', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(/남성/)).toBeInTheDocument();
      });
    });
  });

  describe('반응형 디자인', () => {
    it('모바일 뷰에서 올바르게 렌더링된다', () => {
      // viewport 크기 변경 시뮬레이션
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<ProfilePage />);

      // 모바일에서 flex-col 클래스가 적용되는지 확인
      const profileSection = screen.getByText(mockUserProfile.name).closest('.flex');
      expect(profileSection).toHaveClass('flex-col');
    });
  });

  describe('성능', () => {
    it('불필요한 리렌더링을 방지한다', async () => {
      const { rerender } = renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByText(mockUserProfile.name)).toBeInTheDocument();
      });

      // 동일한 props로 리렌더링
      rerender(<ProfilePage />);

      // getDoc이 한 번만 호출되었는지 확인
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });
  });
});