import React, { useState } from 'react';
import JobBoardErrorBoundary from '../../components/errors/JobBoardErrorBoundary';
import JobPostingSkeleton from '../../components/JobPostingSkeleton';
import PreQuestionModal from '../../components/modals/PreQuestionModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import IncompleteProfileModal from '../../components/modals/IncompleteProfileModal';
import JobFiltersComponent from './JobFilters';
import JobListTab from './components/JobListTab';
import MyApplicationsTab from './components/MyApplicationsTab';
import FixedJobListTab from './components/FixedJobListTab';
import ApplyModal from './components/ApplyModal';
import JobDetailModal from './components/JobDetailModal';
import { useJobBoard } from './hooks/useJobBoard';
import { JobBoardTabs } from './components/JobBoardTabs';
import { DateSlider } from '../../components/jobPosting/DateSlider';
import { PostingType } from '../../types/jobPosting/jobPosting';
import { filterPostingsByDate } from '../../utils/jobPosting/dateFilter';

/**
 * 구인공고 게시판 메인 페이지 컴포넌트
 */
const JobBoardPage = () => {
  // 탭 및 필터 상태
  const [activePostingType, setActivePostingType] = useState<
    PostingType | 'myApplications' | 'all'
  >('urgent');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const {
    // 상태
    activeTab,
    setActiveTab,
    filters,
    isFilterOpen,
    setIsFilterOpen,
    jobPostings,
    loading,
    error,
    appliedJobs,
    isProcessing,
    selectedPost,
    selectedAssignments,
    isApplyModalOpen,
    setIsApplyModalOpen,
    isPreQuestionModalOpen,
    setIsPreQuestionModalOpen,
    myApplications,
    loadingMyApplications,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
    isDetailModalOpen,
    selectedDetailPost,
    isIncompleteProfileModalOpen,
    setIsIncompleteProfileModalOpen,
    missingProfileFields,

    // 함수
    handleFilterChange,
    handleOpenApplyModal,
    handleMultipleAssignmentChange,
    handleApply,
    handleCancelApplicationClick,
    handleCancelApplicationConfirm,
    cancelConfirmPostId,
    setCancelConfirmPostId,
    handlePreQuestionComplete,
    fetchMyApplications,
    handleBackToPreQuestions,
    handleOpenDetailModal,
    handleCloseDetailModal,

    // 유틸리티
    currentUser,
    t,

    // 사전질문 관련
    preQuestionAnswers,
  } = useJobBoard();

  if (loading) {
    return (
      <div className="container">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          {t('jobBoard.title')}
        </h1>
        <JobPostingSkeleton count={5} />
      </div>
    );
  }

  return (
    <JobBoardErrorBoundary>
      <div className="container">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          {t('jobBoard.title')}
        </h1>

        {/* 탭 네비게이션 (새로운 시스템) */}
        <JobBoardTabs
          activeTab={activePostingType}
          onTabChange={(tab) => {
            setActivePostingType(tab);
            setSelectedDate(null); // 탭 변경 시 날짜 필터 초기화

            // 기존 activeTab 상태도 업데이트 (하위 호환성)
            if (tab === 'myApplications') {
              setActiveTab('myApplications');
            } else {
              setActiveTab('jobs');
            }
          }}
        />

        {/* 날짜 슬라이더 (지원 탭에만 표시) */}
        {activePostingType === 'regular' && (
          <DateSlider selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        )}

        {/* Error Handling */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
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
        )}

        {/* 고정공고 탭 */}
        {activeTab === 'jobs' && activePostingType === 'fixed' && (
          <div role="tabpanel" id="fixed-panel" aria-labelledby="fixed-tab">
            <FixedJobListTab />
          </div>
        )}

        {/* 구인 목록 탭 (regular, tournament, urgent, all) */}
        {activeTab === 'jobs' && activePostingType !== 'fixed' && (
          <div role="tabpanel" id="jobs-panel" aria-labelledby="jobs-tab">
            <JobListTab
              jobPostings={(() => {
                let filtered = jobPostings;

                // postingType 필터링
                if (activePostingType !== 'all' && activePostingType !== 'myApplications') {
                  filtered = filtered.filter((post) => {
                    // normalizePostingType은 이미 useJobPostings Hook에서 처리됨
                    return post.postingType === activePostingType;
                  });
                }

                // 날짜 필터링 (지원 탭에만)
                if (activePostingType === 'regular' && selectedDate) {
                  filtered = filterPostingsByDate(filtered, selectedDate);
                }

                return filtered;
              })()}
              appliedJobs={appliedJobs}
              onApply={handleOpenApplyModal}
              onViewDetail={handleOpenDetailModal}
              isProcessing={isProcessing}
              canApply={!!currentUser}
              loadMoreRef={loadMoreRef}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              isFilterOpen={isFilterOpen}
              onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
              filters={filters}
              filterComponent={
                isFilterOpen && (
                  <JobFiltersComponent filters={filters} onFilterChange={handleFilterChange} />
                )
              }
            />
          </div>
        )}

        {/* 내 지원 현황 탭 */}
        {activeTab === 'myApplications' && (
          <div role="tabpanel" id="myApplications-panel" aria-labelledby="myApplications-tab">
            <MyApplicationsTab
              applications={myApplications}
              loading={loadingMyApplications}
              onRefresh={fetchMyApplications}
              onCancel={handleCancelApplicationClick}
              isProcessing={isProcessing}
              onTabChange={() => setActiveTab('jobs')}
              onViewDetail={handleOpenDetailModal}
            />
          </div>
        )}

        {/* Apply Modal */}
        {isApplyModalOpen && selectedPost && (
          <ApplyModal
            isOpen={isApplyModalOpen}
            onClose={() => setIsApplyModalOpen(false)}
            jobPosting={selectedPost}
            selectedAssignments={selectedAssignments}
            onAssignmentChange={handleMultipleAssignmentChange}
            onApply={handleApply}
            isProcessing={isProcessing === selectedPost.id}
            {...(selectedPost.preQuestions &&
              selectedPost.preQuestions.length > 0 && {
                onBack: handleBackToPreQuestions,
                hasPreQuestions: true,
              })}
          />
        )}

        {/* PreQuestion Modal */}
        {isPreQuestionModalOpen && selectedPost && selectedPost.preQuestions && (
          <PreQuestionModal
            isOpen={isPreQuestionModalOpen}
            onClose={() => setIsPreQuestionModalOpen(false)}
            onComplete={handlePreQuestionComplete}
            questions={selectedPost.preQuestions}
            eventId={selectedPost.id}
            {...(preQuestionAnswers.get(selectedPost.id) && {
              existingAnswers: preQuestionAnswers.get(selectedPost.id),
            })}
          />
        )}

        {/* Detail Modal */}
        <JobDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          jobPosting={selectedDetailPost}
        />

        {/* Incomplete Profile Modal */}
        <IncompleteProfileModal
          isOpen={isIncompleteProfileModalOpen}
          onClose={() => setIsIncompleteProfileModalOpen(false)}
          missingFieldLabels={missingProfileFields}
        />

        {/* Cancel Application Confirmation Modal */}
        <ConfirmModal
          isOpen={!!cancelConfirmPostId}
          onClose={() => setCancelConfirmPostId(null)}
          onConfirm={handleCancelApplicationConfirm}
          title={t('jobBoard.alerts.confirmCancel')}
          message={t('jobBoard.alerts.cancelMessage', { defaultValue: '지원을 취소하시겠습니까?' })}
          confirmText={t('common.confirm', { defaultValue: '확인' })}
          cancelText={t('common.cancel', { defaultValue: '취소' })}
          isDangerous={true}
          isLoading={!!isProcessing}
        />
      </div>
    </JobBoardErrorBoundary>
  );
};

export default JobBoardPage;
