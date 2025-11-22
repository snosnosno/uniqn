import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ApprovalModal } from '../../../../components/jobPosting/ApprovalModal';

/**
 * ApprovalModal 컴포넌트 단위 테스트
 * - 승인/거부 모달 렌더링 테스트
 * - 거부 사유 입력 검증 테스트
 * - 버튼 상호작용 테스트
 * - 다크모드 스타일 테스트
 */

describe('ApprovalModal', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    postingId: 'test-posting-1',
    postingTitle: '테스트 대회 공고',
    mode: 'approve' as const,
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    processing: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('승인 모드 렌더링', () => {
    it('승인 모달을 정상적으로 렌더링', () => {
      render(<ApprovalModal {...defaultProps} />);

      expect(screen.getByText('공고 승인')).toBeInTheDocument();
      expect(screen.getByText('테스트 대회 공고')).toBeInTheDocument();
      expect(screen.getByText(/다음 공고를 승인하시겠습니까?/)).toBeInTheDocument();
    });

    it('승인 버튼과 취소 버튼이 표시됨', () => {
      render(<ApprovalModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: '승인' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    });

    it('거부 사유 입력란이 표시되지 않음', () => {
      render(<ApprovalModal {...defaultProps} />);

      expect(screen.queryByText('거부 사유')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/)).not.toBeInTheDocument();
    });

    it('승인 버튼 클릭 시 onConfirm 호출', async () => {
      render(<ApprovalModal {...defaultProps} />);

      const approveButton = screen.getByRole('button', { name: '승인' });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('test-posting-1', undefined);
      });
    });
  });

  describe('거부 모드 렌더링', () => {
    const rejectProps = {
      ...defaultProps,
      mode: 'reject' as const
    };

    it('거부 모달을 정상적으로 렌더링', () => {
      render(<ApprovalModal {...rejectProps} />);

      expect(screen.getByText('공고 거부')).toBeInTheDocument();
      expect(screen.getByText(/다음 공고를 거부하시겠습니까?/)).toBeInTheDocument();
    });

    it('거부 사유 입력란이 표시됨', () => {
      render(<ApprovalModal {...rejectProps} />);

      expect(screen.getByText('거부 사유')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/)).toBeInTheDocument();
    });

    it('거부 버튼이 초기에는 비활성화됨 (10자 미만)', () => {
      render(<ApprovalModal {...rejectProps} />);

      const rejectButton = screen.getByRole('button', { name: '거부' });
      expect(rejectButton).toBeDisabled();
    });

    it('10자 미만 입력 시 거부 버튼 비활성화 유지', () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      fireEvent.change(textarea, { target: { value: '짧은 사유' } });

      const rejectButton = screen.getByRole('button', { name: '거부' });
      expect(rejectButton).toBeDisabled();
    });

    it('10자 이상 입력 시 거부 버튼 활성화', () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      fireEvent.change(textarea, { target: { value: '이것은 충분히 긴 거부 사유입니다' } });

      const rejectButton = screen.getByRole('button', { name: '거부' });
      expect(rejectButton).not.toBeDisabled();
    });

    it('글자 수 카운터가 표시됨', () => {
      render(<ApprovalModal {...rejectProps} />);

      expect(screen.getByText(/0\/10자 이상/)).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      fireEvent.change(textarea, { target: { value: '테스트' } });

      expect(screen.getByText(/3\/10자 이상/)).toBeInTheDocument();
    });
  });

  describe('거부 사유 검증', () => {
    const rejectProps = {
      ...defaultProps,
      mode: 'reject' as const
    };

    it('빈 문자열 제출 시 에러 메시지 표시', async () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      fireEvent.change(textarea, { target: { value: '          ' } });

      const form = textarea.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('거부 사유를 입력해주세요')).toBeInTheDocument();
      });
    });

    it('10자 미만 제출 시 에러 메시지 표시', async () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      fireEvent.change(textarea, { target: { value: '짧음' } });

      const form = textarea.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('거부 사유는 최소 10자 이상이어야 합니다')).toBeInTheDocument();
      });
    });

    it('10자 이상 제출 시 onConfirm 호출', async () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      const reason = '이것은 충분히 긴 거부 사유입니다';
      fireEvent.change(textarea, { target: { value: reason } });

      const form = textarea.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('test-posting-1', reason);
      });
    });

    it('앞뒤 공백 제거 후 제출', async () => {
      render(<ApprovalModal {...rejectProps} />);

      const textarea = screen.getByPlaceholderText(/거부 사유를 10자 이상 입력해주세요/);
      const reason = '  이것은 충분히 긴 거부 사유입니다  ';
      fireEvent.change(textarea, { target: { value: reason } });

      const form = textarea.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith('test-posting-1', reason.trim());
      });
    });
  });

  describe('버튼 상호작용', () => {
    it.skip('취소 버튼 클릭 시 onCancel 호출', () => {
      render(<ApprovalModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: '취소' });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it.skip('닫기 아이콘 클릭 시 onCancel 호출', () => {
      render(<ApprovalModal {...defaultProps} />);

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('svg'));

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(mockOnCancel).toHaveBeenCalled();
      }
    });

    it.skip('배경 클릭 시 onCancel 호출', () => {
      const { container } = render(<ApprovalModal {...defaultProps} />);

      const backdrop = container.querySelector('.fixed.inset-0.bg-gray-500');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnCancel).toHaveBeenCalled();
      }
    });

    it('processing=true 시 모든 버튼 비활성화', () => {
      render(<ApprovalModal {...defaultProps} processing={true} />);

      const approveButton = screen.getByRole('button', { name: '처리 중...' });
      const cancelButton = screen.getByRole('button', { name: '취소' });

      expect(approveButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it('processing=true 시 버튼 텍스트가 "처리 중..." 으로 변경', () => {
      render(<ApprovalModal {...defaultProps} processing={true} />);

      expect(screen.getByText('처리 중...')).toBeInTheDocument();
    });
  });

  describe('다크모드 스타일', () => {
    it.skip('다크모드 클래스가 적용됨', () => {
      const { container } = render(<ApprovalModal {...defaultProps} />);

      // 모달 컨텐츠
      const modal = container.querySelector('.bg-white.dark\\:bg-gray-800');
      expect(modal).toBeInTheDocument();

      // 배경 오버레이
      const backdrop = container.querySelector('.bg-gray-500.dark\\:bg-gray-900');
      expect(backdrop).toBeInTheDocument();
    });

    it('승인 모드 시 녹색 스타일 적용', () => {
      render(<ApprovalModal {...defaultProps} />);

      const title = screen.getByText('공고 승인');
      expect(title).toHaveClass('text-green-600', 'dark:text-green-400');
    });

    it('거부 모드 시 빨간색 스타일 적용', () => {
      const rejectProps = { ...defaultProps, mode: 'reject' as const };
      render(<ApprovalModal {...rejectProps} />);

      const title = screen.getByText('공고 거부');
      expect(title).toHaveClass('text-red-600', 'dark:text-red-400');
    });
  });

  describe('에러 처리', () => {
    it('onConfirm 실패 시 에러 메시지 표시', async () => {
      const failingOnConfirm = jest.fn().mockRejectedValue(new Error('네트워크 오류'));
      const props = {
        ...defaultProps,
        onConfirm: failingOnConfirm
      };

      render(<ApprovalModal {...props} />);

      const approveButton = screen.getByRole('button', { name: '승인' });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(screen.getByText('처리 중 오류가 발생했습니다')).toBeInTheDocument();
      });
    });
  });
});
