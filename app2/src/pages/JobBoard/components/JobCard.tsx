import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting } from '@/types/jobPosting';
import JobPostingCard from '@/components/common/JobPostingCard';
import Button from '@/components/ui/Button';

interface JobCardProps {
  post: JobPosting;
  appliedStatus: string | undefined;
  onApply: (post: JobPosting) => void;
  onViewDetail: (post: JobPosting) => void;
  isProcessing: boolean;
  canApply: boolean;
}

/**
 * 개별 구인공고 카드 컴포넌트
 * Button 컴포넌트 사용으로 일관된 스타일과 접근성 보장
 */
const JobCard: React.FC<JobCardProps> = ({
  post,
  appliedStatus,
  onApply,
  onViewDetail,
  isProcessing,
  canApply,
}) => {
  const { t } = useTranslation();

  // 사용자 액션 버튼 영역 렌더링
  const renderUserActions = (post: JobPosting) => (
    <div className="w-full lg:w-auto lg:ml-4">
      <div className="flex flex-row sm:flex-col gap-2">
        {/* 자세히보기 버튼 */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onViewDetail(post)}
          aria-label={`${post.title} 상세정보 보기`}
          className="flex-1 sm:w-full"
        >
          {t('jobBoard.viewDetails')}
        </Button>

        {/* 지원하기 버튼 */}
        <div className="flex-1 sm:w-full">{renderActionButton()}</div>
      </div>
    </div>
  );

  // 지원 상태에 따른 버튼 렌더링
  const renderActionButton = () => {
    if (!canApply) {
      return (
        <Button variant="ghost" size="sm" disabled fullWidth aria-label="로그인이 필요합니다">
          {t('jobBoard.loginRequired')}
        </Button>
      );
    }

    if (appliedStatus === 'applied') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled
          fullWidth
          aria-label="이미 지원완료한 공고입니다"
        >
          {t('jobBoard.applied')}
        </Button>
      );
    }

    if (appliedStatus === 'confirmed') {
      return (
        <Button
          variant="success"
          size="sm"
          disabled
          fullWidth
          aria-label="지원이 확정된 공고입니다"
        >
          {t('common.status.confirmed')}
        </Button>
      );
    }

    return (
      <Button
        variant="success"
        size="sm"
        onClick={() => onApply(post)}
        disabled={isProcessing}
        loading={isProcessing}
        fullWidth
        aria-label={`${post.title}에 지원하기`}
      >
        {isProcessing ? (
          t('jobBoard.applying')
        ) : post.preQuestions && post.preQuestions.length > 0 ? (
          <div className="text-center">
            <div>{t('common.apply')}</div>
            <div className="text-xs opacity-80">{t('jobBoard.preQuestions')}</div>
          </div>
        ) : (
          t('common.apply')
        )}
      </Button>
    );
  };

  return (
    <JobPostingCard
      post={post}
      variant="user-card"
      renderActions={renderUserActions}
      showStatus={true}
    />
  );
};

export default React.memo(JobCard);
