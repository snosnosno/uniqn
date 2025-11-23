import React, { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFixedJobPostings } from '../../../hooks/useFixedJobPostings';
import { FixedJobCard } from '../../../components/jobPosting/FixedJobCard';
import { FixedJobPosting } from '../../../types/jobPosting/jobPosting';
import JobPostingSkeleton from '../../../components/JobPostingSkeleton';
import { logger } from '../../../utils/logger';

/**
 * 고정공고 목록 탭 컴포넌트
 *
 * 무한 스크롤 지원, 다크모드 완전 적용
 */
const FixedJobListTab: React.FC = () => {
  const navigate = useNavigate();
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 지원하기 핸들러 (메모이제이션)
  const handleApply = useCallback((posting: FixedJobPosting) => {
    logger.info('FixedJobListTab: 지원하기 클릭', {
      postingId: posting.id,
      component: 'FixedJobListTab',
    });
    navigate(`/apply/${posting.id}`);
  }, [navigate]);

  // 상세보기 핸들러 (메모이제이션)
  const handleViewDetail = useCallback((postingId: string) => {
    logger.info('FixedJobListTab: 상세보기 클릭', {
      postingId,
      component: 'FixedJobListTab',
    });
    navigate(`/job-postings/${postingId}`);
  }, [navigate]);

  // 무한 스크롤 IntersectionObserver 설정
  useEffect(() => {
    if (loading || !hasMore) {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          logger.info('FixedJobListTab: 무한 스크롤 트리거', {
            component: 'FixedJobListTab',
          });
          loadMore();
        }
      },
      { threshold: 0.1 } // 10% 보이면 트리거
    );

    const target = loadMoreRef.current;
    if (target) {
      observerRef.current.observe(target);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [loading, hasMore, loadMore]);

  // 로딩 중
  if (loading && postings.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <JobPostingSkeleton count={5} />
      </div>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          <div className="flex">
            <div className="py-1">
              <svg
                className="fill-current h-6 w-6 text-red-500 dark:text-red-400 mr-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
              >
                <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">데이터 로딩 오류</p>
              <p className="text-sm">
                {error.message?.includes('index') || error.message?.includes('Index')
                  ? 'Firebase 인덱스 설정이 필요합니다. 관리자에게 문의하세요.'
                  : error.message?.includes('permission')
                  ? '권한이 없습니다. 로그인 상태를 확인해 주세요.'
                  : error.message?.includes('network')
                  ? '네트워크 연결을 확인해 주세요.'
                  : '데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.'}
              </p>
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                  기술적 세부사항
                </summary>
                <pre className="text-xs mt-1 bg-red-50 dark:bg-red-900/10 p-2 rounded overflow-auto">
                  {error.message || 'Unknown error'}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 빈 상태
  if (postings.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            현재 모집 중인 고정공고가 없습니다
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            새로운 고정공고가 등록되면 여기에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // 공고 목록 표시
  return (
    <div className="container mx-auto p-4">
      {/* 공고 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {postings.map((posting) => (
          <FixedJobCard
            key={posting.id}
            posting={posting}
            onApply={handleApply}
            onViewDetail={handleViewDetail}
          />
        ))}
      </div>

      {/* 무한 스크롤 트리거 요소 */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="h-20 flex items-center justify-center mt-8"
        >
          {loading ? (
            <span className="text-gray-500 dark:text-gray-400">로딩 중...</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">스크롤하여 더 보기</span>
          )}
        </div>
      )}

      {/* 모든 공고 확인 메시지 */}
      {!hasMore && postings.length > 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8">
          모든 공고를 확인했습니다.
        </p>
      )}
    </div>
  );
};

export default FixedJobListTab;
