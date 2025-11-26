import React from 'react';
import { useTranslation } from 'react-i18next';
import { FixedSizeList as List } from 'react-window';
import JobCard from './JobCard';
import { JobPosting } from '@/types/jobPosting';
import { JobFilters } from '../hooks/useJobBoard';

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
  filters?: JobFilters;
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
  filterComponent,
  filters,
}) => {
  const { t } = useTranslation();

  // 필터가 적용되었는지 확인
  const hasActiveFilters = () => {
    if (!filters) return false;
    return (
      filters.location !== 'all' ||
      filters.type !== 'all' ||
      filters.startDate !== '' ||
      filters.role !== 'all' ||
      filters.month !== '' ||
      filters.day !== ''
    );
  };

  return (
    <>
      {/* 필터와 새로고침 버튼 */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onFilterToggle}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 flex items-center relative"
          aria-label={isFilterOpen ? '필터 닫기' : '필터 열기'}
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
              d={isFilterOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
            />
          </svg>
          필터
          {hasActiveFilters() && (
            <span
              className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 dark:bg-red-400 rounded-full"
              aria-label="필터 적용됨"
            ></span>
          )}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          aria-label="페이지 새로고침"
        >
          🔄 새로고침
        </button>
      </div>

      {/* Filter Component */}
      {filterComponent}

      {/* Job Postings Grid */}
      <div className="mb-6">
        {jobPostings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-gray-500 dark:text-gray-400 text-lg mb-2">📭</div>
            <p className="text-gray-500 dark:text-gray-400">{t('jobBoard.noJobsAvailable')}</p>
          </div>
        ) : jobPostings.length > 50 ? (
          // 가상화 적용 (50개 이상일 때)
          <List
            height={600}
            itemCount={jobPostings.length}
            itemSize={250}
            width="100%"
            className="grid gap-4"
          >
            {({ index, style }) => {
              const post = jobPostings[index];
              if (!post) return null;

              return (
                <div style={style} className="pb-4">
                  <JobCard
                    key={post.id}
                    post={post}
                    appliedStatus={appliedJobs.get(post.id)}
                    onApply={onApply}
                    onViewDetail={onViewDetail}
                    isProcessing={isProcessing === post.id}
                    canApply={canApply}
                  />
                </div>
              );
            }}
          </List>
        ) : (
          // 일반 렌더링 (50개 미만일 때)
          <div className="grid gap-4">
            {jobPostings.map((post) => (
              <JobCard
                key={post.id}
                post={post}
                appliedStatus={appliedJobs.get(post.id)}
                onApply={onApply}
                onViewDetail={onViewDetail}
                isProcessing={isProcessing === post.id}
                canApply={canApply}
              />
            ))}
          </div>
        )}
      </div>

      {/* Infinite Scroll Loading Indicator */}
      <div ref={loadMoreRef} className="relative">
        {isFetchingNextPage && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-10 h-10 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300 animate-pulse">
              추가 공고를 불러오는 중...
            </p>
          </div>
        )}
        {!hasNextPage && jobPostings.length > 0 && (
          <div className="text-center py-6 border-t border-gray-200 dark:border-gray-700">
            <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">모든 공고를 확인했습니다</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default JobListTab;
