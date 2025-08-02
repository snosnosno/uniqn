import React from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../components/LoadingSpinner';
import JobCard from './JobCard';
import { JobPosting } from '../../../types/jobPosting';

interface JobListTabProps {
  jobPostings: JobPosting[];
  appliedJobs: Map<string, string>;
  onApply: (post: JobPosting) => void;
  onViewDetail: (post: JobPosting) => void;
  isProcessing: string | null;
  canApply: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  isFilterOpen: boolean;
  onFilterToggle: () => void;
  filterComponent: React.ReactNode;
}

/**
 * 구인 목록 탭 컴포넌트
 */
const JobListTab: React.FC<JobListTabProps> = ({
  jobPostings,
  appliedJobs,
  onApply,
  onViewDetail,
  isProcessing,
  canApply,
  loadMoreRef,
  isFetchingNextPage,
  hasNextPage,
  isFilterOpen,
  onFilterToggle,
  filterComponent
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* 필터와 새로고침 버튼 */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onFilterToggle}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center"
        >
          <svg 
            className={`w-5 h-5 mr-2 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d={isFilterOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} 
            />
          </svg>
          필터
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          🔄 새로고침
        </button>
      </div>

      {/* Filter Component */}
      {filterComponent}

      {/* Job Postings Grid */}
      <div className="grid gap-4 mb-6">
        {jobPostings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="text-gray-500 text-lg mb-2">📭</div>
            <p className="text-gray-500">
              {t('jobBoard.noJobsAvailable')}
            </p>
          </div>
        ) : (
          jobPostings.map((post) => (
            <JobCard
              key={post.id}
              post={post}
              appliedStatus={appliedJobs.get(post.id)}
              onApply={onApply}
              onViewDetail={onViewDetail}
              isProcessing={isProcessing === post.id}
              canApply={canApply}
            />
          ))
        )}
      </div>

      {/* Infinite Scroll Loading Indicator */}
      <div ref={loadMoreRef} className="flex justify-center py-4">
        {isFetchingNextPage && (
          <LoadingSpinner size="md" text="추가 공고를 불러오는 중..." />
        )}
        {!hasNextPage && jobPostings.length > 0 && (
          <p className="text-gray-500 text-center py-4">
            더 이상 공고가 없습니다.
          </p>
        )}
      </div>
    </>
  );
};

export default JobListTab;