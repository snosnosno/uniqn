import React from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting } from '../../../types/jobPosting';
import JobPostingCard from '../../../components/common/JobPostingCard';

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
 */
const JobCard: React.FC<JobCardProps> = ({ 
  post, 
  appliedStatus, 
  onApply,
  onViewDetail,
  isProcessing,
  canApply 
}) => {
  const { t } = useTranslation();

  // 사용자 액션 버튼 영역 렌더링
  const renderUserActions = (post: JobPosting) => (
    <div className="w-full lg:w-auto lg:ml-4">
      <div className="flex flex-row sm:flex-col gap-2">
        {/* 자세히보기 버튼 */}
        <button
          onClick={() => onViewDetail(post)}
          className="flex-1 sm:w-full bg-blue-600 text-white py-2 px-3 rounded hover:bg-blue-700 text-sm font-medium"
          aria-label={`${post.title} 상세정보 보기`}
        >
          자세히보기
        </button>
        
        {/* 지원하기 버튼 */}
        <div className="flex-1 sm:w-full">
          {renderActionButton()}
        </div>
      </div>
    </div>
  );

  // 지원 상태에 따른 버튼 렌더링
  const renderActionButton = () => {
    if (!canApply) {
      return (
        <button
          disabled
          className="w-full bg-gray-300 text-gray-500 py-2 px-3 rounded cursor-not-allowed text-sm font-medium"
          aria-label="로그인이 필요합니다"
        >
          로그인 필요
        </button>
      );
    }

    if (appliedStatus === 'applied') {
      return (
        <button
          disabled
          className="w-full bg-gray-500 text-white py-2 px-3 rounded cursor-not-allowed text-sm font-medium"
          aria-label="이미 지원완료한 공고입니다"
        >
          지원완료
        </button>
      );
    }

    if (appliedStatus === 'confirmed') {
      return (
        <button
          disabled
          className="w-full bg-green-600 text-white py-2 px-3 rounded cursor-not-allowed text-sm font-medium"
          aria-label="지원이 확정된 공고입니다"
        >
          확정됨
        </button>
      );
    }

    return (
      <button
        onClick={() => onApply(post)}
        disabled={isProcessing}
        className="w-full bg-green-600 text-white py-2 px-3 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
        aria-label={`${post.title}에 지원하기`}
      >
        {isProcessing 
          ? t('jobBoard.applying') 
          : post.preQuestions && post.preQuestions.length > 0 
            ? (
              <div className="text-center">
                <div>지원하기</div>
                <div className="text-xs">(사전질문)</div>
              </div>
            )
            : t('jobBoard.apply')}
      </button>
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