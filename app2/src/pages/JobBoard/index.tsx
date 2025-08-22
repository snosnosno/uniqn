import React from 'react';
import JobBoardErrorBoundary from '../../components/JobBoardErrorBoundary';
import JobPostingSkeleton from '../../components/JobPostingSkeleton';
import PreQuestionModal from '../../components/PreQuestionModal';
import JobFiltersComponent from './JobFilters';
import JobListTab from './components/JobListTab';
import MyApplicationsTab from './components/MyApplicationsTab';
import ApplyModal from './components/ApplyModal';
import JobDetailModal from './components/JobDetailModal';
import { useJobBoard } from './hooks/useJobBoard';

/**
 * 구인공고 게시판 메인 페이지 컴포넌트
 */
const JobBoardPage = () => {
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
    
    // 함수
    handleFilterChange,
    handleOpenApplyModal,
    handleMultipleAssignmentChange,
    handleApply,
    handleCancelApplication,
    handlePreQuestionComplete,
    fetchMyApplications,
    handleBackToPreQuestions,
    handleOpenDetailModal,
    handleCloseDetailModal,
    
    // 유틸리티
    currentUser,
    t,
    
    // 사전질문 관련
    preQuestionAnswers
  } = useJobBoard();

  if (loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <h1 className="text-2xl font-bold mb-4">{t('jobBoard.title')}</h1>
        <JobPostingSkeleton count={5} />
      </div>
    );
  }

  return (
    <JobBoardErrorBoundary>
      <div className="container mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <h1 className="text-2xl font-bold mb-4">{t('jobBoard.title')}</h1>
        
        {/* 탭 네비게이션 */}
        <div className="flex space-x-4 mb-6 border-b" role="tablist">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            role="tab"
            aria-selected={activeTab === 'jobs'}
            aria-controls="jobs-panel"
            id="jobs-tab"
          >
            구인 목록
          </button>
          <button
            onClick={() => setActiveTab('myApplications')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'myApplications'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            role="tab"
            aria-selected={activeTab === 'myApplications'}
            aria-controls="myApplications-panel"
            id="myApplications-tab"
          >
            내 지원 현황
          </button>
        </div>
        
        {/* Error Handling */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <div className="flex">
              <div className="py-1">
                <svg className="fill-current h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
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
                  <summary className="text-xs cursor-pointer text-red-600 hover:text-red-800">기술적 세부사항</summary>
                  <pre className="text-xs mt-1 bg-red-50 p-2 rounded overflow-auto">{error.message || 'Unknown error'}</pre>
                </details>
              </div>
            </div>
          </div>
        )}
        
        {/* 구인 목록 탭 */}
        {activeTab === 'jobs' && (
          <div role="tabpanel" id="jobs-panel" aria-labelledby="jobs-tab">
            <JobListTab
            jobPostings={jobPostings}
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
                <JobFiltersComponent
                  filters={filters}
                  onFilterChange={handleFilterChange}
                />
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
            onCancel={handleCancelApplication}
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
            {...(selectedPost.preQuestions && selectedPost.preQuestions.length > 0 && {
              onBack: handleBackToPreQuestions,
              hasPreQuestions: true
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
              existingAnswers: preQuestionAnswers.get(selectedPost.id)
            })}
          />
        )}
        
        {/* Detail Modal */}
        <JobDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
          jobPosting={selectedDetailPost}
        />
      </div>
    </JobBoardErrorBoundary>
  );
};

export default JobBoardPage;