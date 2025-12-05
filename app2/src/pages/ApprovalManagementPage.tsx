import React, { useState } from 'react';
import { useJobPostingApproval } from '../hooks/useJobPostingApproval';
import { ApprovalModal } from '../components/jobPosting/ApprovalModal';
import { JobPosting } from '../types/jobPosting/jobPosting';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';
import JobPostingCard from '../components/common/JobPostingCard';

/**
 * 대회 공고 승인 관리 페이지 (Admin 전용)
 * 승인 대기 중인 대회 공고를 조회하고 승인/거부 처리
 */
const ApprovalManagementPage: React.FC = () => {
  const { pendingPostings, loading, error, processing, approve, reject } = useJobPostingApproval();
  const [selectedPosting, setSelectedPosting] = useState<JobPosting | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = (posting: JobPosting) => {
    logger.info('승인 모달 열기');
    setSelectedPosting(posting);
    setModalMode('approve');
  };

  const handleReject = (posting: JobPosting) => {
    logger.info('거부 모달 열기');
    setSelectedPosting(posting);
    setModalMode('reject');
  };

  const handleConfirm = async (postingId: string, reason?: string) => {
    try {
      if (modalMode === 'approve') {
        await approve(postingId);
      } else if (modalMode === 'reject' && reason) {
        await reject(postingId, reason);
      }
      // 모달 닫기
      setSelectedPosting(null);
      setModalMode(null);
    } catch (err) {
      // 에러는 hook에서 이미 처리됨
      logger.error('승인/거부 처리 실패', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCancel = () => {
    logger.info('승인/거부 모달 취소');
    setSelectedPosting(null);
    setModalMode(null);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-300">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">오류가 발생했습니다: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          대회 공고 승인 관리
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          승인 대기 중인 대회 공고를 확인하고 승인 또는 거부하세요.
        </p>
      </div>

      {/* 대기 공고 목록 */}
      {pendingPostings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-1">
            승인 대기 중인 공고가 없습니다
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            새로운 대회 공고가 등록되면 여기에 표시됩니다
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPostings.map((posting) => (
            <JobPostingCard
              key={posting.id}
              post={posting}
              variant="admin-list"
              showStatus={false}
              showTournamentStatus={true}
              renderExtra={(post) =>
                post.tournamentConfig?.resubmittedAt ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700 mb-2">
                    🔄 재제출
                  </span>
                ) : null
              }
              renderActions={(post) => (
                <>
                  <button
                    onClick={() => handleApprove(post as JobPosting)}
                    disabled={processing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    <CheckIcon className="h-5 w-5 mr-1.5" />
                    승인
                  </button>
                  <button
                    onClick={() => handleReject(post as JobPosting)}
                    disabled={processing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 mr-1.5" />
                    거부
                  </button>
                  {/* 빈 div로 3열 그리드 맞춤 */}
                  <div />
                </>
              )}
            />
          ))}
        </div>
      )}

      {/* 승인/거부 모달 */}
      {selectedPosting && modalMode && (
        <ApprovalModal
          postingId={selectedPosting.id}
          postingTitle={selectedPosting.title}
          mode={modalMode}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          processing={processing}
        />
      )}
    </div>
  );
};

export default ApprovalManagementPage;
