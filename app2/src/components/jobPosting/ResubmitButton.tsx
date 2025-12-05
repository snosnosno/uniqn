import React, { useState } from 'react';
import { useJobPostingApproval } from '../../hooks/useJobPostingApproval';
import { TournamentConfig } from '../../types/jobPosting/jobPosting';
import Button from '../ui/Button';
import ConfirmModal from '../modals/ConfirmModal';

interface ResubmitButtonProps {
  postingId: string;
  tournamentConfig: TournamentConfig;
  className?: string;
  /** 재제출 성공 후 콜백 */
  onSuccess?: () => void;
}

/**
 * 거부된 대회 공고 재제출 버튼 컴포넌트
 * rejected 상태인 대회 공고에서만 표시됨
 */
export const ResubmitButton: React.FC<ResubmitButtonProps> = ({
  postingId,
  tournamentConfig,
  className = '',
  onSuccess,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { resubmit, processing } = useJobPostingApproval();

  // 거부 상태가 아니면 렌더링하지 않음
  if (tournamentConfig.approvalStatus !== 'rejected') {
    return null;
  }

  const handleResubmit = async () => {
    try {
      await resubmit(postingId);
      setShowConfirmModal(false);
      onSuccess?.();
    } catch {
      // 에러는 hook에서 처리됨
      setShowConfirmModal(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setShowConfirmModal(true)}
        disabled={processing}
        className={`${className}`}
      >
        {processing ? '처리 중...' : '재제출'}
      </Button>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleResubmit}
        title="공고 재제출"
        message={`이 공고를 다시 승인 요청하시겠습니까?

재제출 후 관리자 승인을 받아야 대회탭에 표시됩니다.`}
        confirmText="재제출"
        cancelText="취소"
        isDangerous={false}
      />
    </>
  );
};

export default ResubmitButton;
