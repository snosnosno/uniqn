import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import JobBoardErrorBoundary from '../components/JobBoardErrorBoundary';
import JobPostingSkeleton from '../components/JobPostingSkeleton';
import LoadingSpinner from '../components/LoadingSpinner';
import PreQuestionModal from '../components/PreQuestionModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../firebase';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useInfiniteJobPostings, JobPosting } from '../hooks/useJobPostings';
import { TimeSlot, RoleRequirement, JobPostingUtils, DateSpecificRequirement, PreQuestionAnswer, ConfirmedStaff } from '../types/jobPosting';
import { formatDate as formatDateUtil } from '../utils/jobPosting/dateUtils';
import { timestampToLocalDateString } from '../utils/dateUtils';

const JobBoardPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  
  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<'jobs' | 'myApplications'>('jobs');

  const [appliedJobs, setAppliedJobs] = useState<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // 내 지원 현황 데이터
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingMyApplications, setLoadingMyApplications] = useState(false);
  
  
  
  // Get current month as default
  const getCurrentMonth = () => {
    const now = new Date();
    return (now.getMonth() + 1).toString().padStart(2, '0');
  };

  // Filter states
  const [filters, setFilters] = useState({
    location: 'all',
    type: 'all',
    startDate: '',
    role: 'all',
    month: '', // 모든 월 표시하도록 변경
    day: '' // Default to all days
  });
  
  
  
  // Infinite Query based data fetching
  const {
    data: infiniteData,
    isLoading: loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
    } = useInfiniteJobPostings(filters);
  
  // Flatten the infinite query data
  const jobPostings = useMemo(() => {
    const result = infiniteData?.pages.flatMap((page: any) => page.jobs) || [];
    logger.debug('📋 JobBoardPage - 최종 공고 목록:', { component: 'JobBoardPage', data: result });
    logger.debug('📋 JobBoardPage - 공고 개수:', { component: 'JobBoardPage', data: result.length });
    logger.debug('📋 JobBoardPage - 현재 필터:', { component: 'JobBoardPage', data: filters });
    return result;
  }, [infiniteData, filters]);
  
  // Infinite scroll hook
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: hasNextPage || false,
    isFetchingNextPage,
    fetchNextPage
  });
  
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<JobPosting | null>(null);
    const [selectedAssignments, setSelectedAssignments] = useState<{ timeSlot: string, role: string, date?: string }[]>([]);
  
  // 사전질문 모달 관련 상태
  const [isPreQuestionModalOpen, setIsPreQuestionModalOpen] = useState(false);
  const [preQuestionCompleted, setPreQuestionCompleted] = useState<Map<string, boolean>>(new Map());
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<Map<string, PreQuestionAnswer[]>>(new Map());
    
  useEffect(() => {
    if (!currentUser || !jobPostings) return;
    const fetchAppliedJobs = async () => {
      if (!currentUser || !jobPostings) return;
      const postIds = jobPostings.map(p => p.id);
      if (postIds.length === 0) return;

      const q = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('postId', 'in', postIds));
      const querySnapshot = await getDocs(q);
      const appliedMap = new Map<string, string>();
      querySnapshot.forEach(doc => {
        appliedMap.set(doc.data().postId, doc.data().status);
      });
      setAppliedJobs(appliedMap);
    };

    fetchAppliedJobs();
  }, [jobPostings, currentUser]);

  // 내 지원 현황 가져오기
  const fetchMyApplications = async () => {
    if (!currentUser) return;
    
    setLoadingMyApplications(true);
    try {
      // 사용자의 모든 지원 내역 가져오기
      const applicationsQuery = query(
        collection(db, 'applications'), 
        where('applicantId', '==', currentUser.uid)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const applicationsData = await Promise.all(
        applicationsSnapshot.docs.map(async (applicationDoc) => {
          const applicationData = applicationDoc.data();
          
          // 해당 구인 정보 가져오기
          try {
            const jobPostingDoc = await getDoc(doc(db, 'jobPostings', applicationData.postId));
            const jobPostingData = jobPostingDoc.exists() ? jobPostingDoc.data() : null;
            
            return {
              id: applicationDoc.id,
              ...applicationData,
              jobPosting: jobPostingData ? {
                id: jobPostingDoc.id,
                ...jobPostingData
              } : null
            };
          } catch (error) {
            logger.error('Error fetching job posting:', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
            return {
              id: applicationDoc.id,
              ...applicationData,
              jobPosting: null
            };
          }
        })
      );
      
      // 최신 지원 순으로 정렬
      applicationsData.sort((a, b) => {
        const aDate = (a as any).appliedAt?.seconds || 0;
        const bDate = (b as any).appliedAt?.seconds || 0;
        return bDate - aDate;
      });
      
      // 삭제된 공고의 applications 필터링
      const validApplications = applicationsData.filter(app => app.jobPosting !== null);
      
      // 디버깅: 애플리케이션 데이터 구조 확인
      logger.debug('🔍 MyApplications 데이터:', { component: 'JobBoardPage', data: validApplications });
      validApplications.forEach((app: any, index) => {
        logger.debug('📋 Application ${index}:', { component: 'JobBoardPage', data: app });
        if (app.preQuestionAnswers) {
          logger.debug('📝 사전질문 답변:', { component: 'JobBoardPage', data: app.preQuestionAnswers });
          app.preQuestionAnswers.forEach((answer: any, answerIndex: number) => {
            logger.debug('  - Answer ${answerIndex} 전체 객체:', { component: 'JobBoardPage', data: answer });
            console.log(`  - Answer ${answerIndex} 분석:`, {
              question: answer.question,
              questionText: answer.questionText, 
              text: answer.text,
              answer: answer.answer,
              answerType: typeof answer.answer,
              required: answer.required,
              allKeys: Object.keys(answer)
            });
          });
        }
      });
      
      setMyApplications(validApplications);
    } catch (error) {
      logger.error('Error fetching my applications:', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
      showError('지원 현황을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingMyApplications(false);
    }
  };



  // 탭 변경 시 데이터 로딩
  useEffect(() => {
    if (activeTab === 'myApplications' && currentUser) {
      fetchMyApplications();
    }
  }, [activeTab, currentUser]);
  
  // Filter handlers
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const resetFilters = () => {
    setFilters({
      location: 'all',
      type: 'all',
      startDate: '',
      role: 'all',
      month: '', // 모든 월 표시하도록 변경
      day: '' // Reset to all days
    });
  };

  // Date filter handler for month/day dropdowns
  const handleDateFilterChange = (type: 'month' | 'day', value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev, [type]: value };
      
      // When month or day changes, update startDate accordingly
      if (newFilters.month && newFilters.day) {
        newFilters.startDate = `2025-${newFilters.month}-${newFilters.day}`;
      } else {
        newFilters.startDate = '';
      }
      
      // If month is cleared, also clear day
      if (type === 'month' && !value) {
        newFilters.day = '';
        newFilters.startDate = '';
      }
      
      return newFilters;
    });
  };


  // 사전질문 유무 확인 헬퍼 함수
  const hasPreQuestions = (post: JobPosting) => {
    return post.preQuestions && post.preQuestions.length > 0;
  };

  // 사전질문 모달 핸들러
  const handleOpenPreQuestionModal = (post: JobPosting) => {
    setSelectedPost(post);
    setIsPreQuestionModalOpen(true);
  };

  const handlePreQuestionComplete = (answers: PreQuestionAnswer[]) => {
    if (!selectedPost) return;
    
    // 사전질문 완료 상태 업데이트
    setPreQuestionCompleted(prev => new Map(prev).set(selectedPost.id, true));
    setPreQuestionAnswers(prev => new Map(prev).set(selectedPost.id, answers));
    setIsPreQuestionModalOpen(false);
    
    // 사전질문 완료 후 자동으로 지원하기 모달 열기
    setIsApplyModalOpen(true);
    setSelectedAssignments([]);
  };

  const handleOpenApplyModal = (post: JobPosting) => {
    setSelectedPost(post);
    setIsApplyModalOpen(true);
    setSelectedAssignments([]);
  };
  
  // 다중 선택 관리 함수
  const handleMultipleAssignmentChange = (assignment: { timeSlot: string, role: string, date?: string }, isChecked: boolean) => {
    if (isChecked) {
      setSelectedAssignments(prev => [...prev, assignment]);
    } else {
      setSelectedAssignments(prev => prev.filter(item => 
        !(item.timeSlot === assignment.timeSlot && 
          item.role === assignment.role && 
          item.date === assignment.date)
      ));
    }
  };
  
  // 선택된 항목 확인 함수
  const isAssignmentSelected = (assignment: { timeSlot: string, role: string, date?: string }) => {
    return selectedAssignments.some(item => 
      item.timeSlot === assignment.timeSlot && 
      item.role === assignment.role && 
      item.date === assignment.date
    );
  };
  
  const handleApply = async () => {
    if (!currentUser) {
      showError(t('jobBoard.alerts.loginRequired'));
      return;
    }
    if (!selectedPost || selectedAssignments.length === 0) {
        showWarning('최소 1개 이상의 시간대/역할을 선택해주세요.');
        return;
    }

    setIsProcessing(selectedPost.id);
    try {
      const staffDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if(!staffDoc.exists()){
        showError(t('jobBoard.alerts.profileNotFound'));
        return;
      }
      
      // 다중 선택 데이터 준비
      const assignedRoles = selectedAssignments.map(item => item.role);
      const assignedTimes = selectedAssignments.map(item => item.timeSlot);
      const assignedDates = selectedAssignments.map(item => item.date).filter(Boolean);
      
      // 기존 호환성을 위해 첫 번째 선택값 사용
      const firstSelection = selectedAssignments[0];
      
      // 사전질문 답변 가져오기
      const answers = preQuestionAnswers.get(selectedPost.id);
      
      // Firebase용 데이터 객체 구성 (undefined 값 제거)
      const applicationData: any = {
        applicantId: currentUser.uid,
        applicantName: staffDoc.data().name || t('jobBoard.unknownApplicant'),
        postId: selectedPost.id,
        postTitle: selectedPost.title,
        status: 'applied',
        appliedAt: serverTimestamp(),
        
        // 기존 단일 선택 필드 (하위 호환성)
        ...(firstSelection && {
          assignedRole: firstSelection.role,
          assignedTime: firstSelection.timeSlot,
        }),
        
        // 새로운 다중 선택 필드
        assignedRoles,
        assignedTimes,
      };

      // 사전질문 답변이 있으면 추가
      if (answers && answers.length > 0) {
        applicationData.preQuestionAnswers = answers;
      }

      // 조건부로 필드 추가 (undefined 방지)
      if (firstSelection && firstSelection.date) {
        applicationData.assignedDate = firstSelection.date;
      }
      
      if (assignedDates.length > 0) {
        applicationData.assignedDates = assignedDates;
      }

      await addDoc(collection(db, 'applications'), applicationData);

      showSuccess(`지원이 완료되었습니다! (선택한 항목: ${selectedAssignments.length}개)`);
      setAppliedJobs(prev => new Map(prev).set(selectedPost.id, 'applied'));
      setIsApplyModalOpen(false);
      setSelectedPost(null);

    } catch (error) {
      logger.error('Error submitting application: ', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
      showError(t('jobBoard.alerts.applicationFailed'));
    } finally {
        setIsProcessing(null);
    }
  };

  const handleCancelApplication = async (postId: string) => {
      if (!currentUser) {
        showError(t('jobBoard.alerts.loginRequired'));
        return;
      }

      if (window.confirm(t('jobBoard.alerts.confirmCancel'))) {
          setIsProcessing(postId);
          try {
              const q = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('postId', '==', postId));
              const querySnapshot = await getDocs(q);
              
              const deletePromises: Promise<void>[] = [];
              querySnapshot.forEach((document) => {
                  deletePromises.push(deleteDoc(doc(db, 'applications', document.id)));
              });
              await Promise.all(deletePromises);

              showSuccess(t('jobBoard.alerts.cancelSuccess'));
              setAppliedJobs(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(postId);
                  return newMap;
              });
          } catch (error) {
              logger.error('Error cancelling application: ', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
              showError(t('jobBoard.alerts.cancelFailed'));
          } finally {
              setIsProcessing(null);
          }
      }
  };



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
        <div className="flex space-x-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`pb-2 px-4 font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
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
          >
            내 지원 현황
          </button>
        </div>
      
        {/* Error Handling */}
        {error ? <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
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
          </div> : null}
      
        
        {/* 구인 목록 탭 */}
        {activeTab === 'jobs' && (
          <>
            {/* Filter Component */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Location Filter */}
            <div>
              <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.location')}
              </label>
              <select
                id="location-filter"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">{t('jobBoard.filters.allLocations')}</option>
                <option value="서울">서울</option>
                <option value="경기">경기</option>
                <option value="인천">인천</option>
                <option value="강원">강원</option>
                <option value="대전">대전</option>
                <option value="세종">세종</option>
                <option value="충남">충남</option>
                <option value="충북">충북</option>
                <option value="광주">광주</option>
                <option value="전남">전남</option>
                <option value="전북">전북</option>
                <option value="대구">대구</option>
                <option value="경북">경북</option>
                <option value="부산">부산</option>
                <option value="울산">울산</option>
                <option value="경남">경남</option>
                <option value="제주">제주</option>
                <option value="해외">해외</option>
                <option value="기타">기타</option>
              </select>
            </div>
          
            {/* Type Filter */}
            <div>
              <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.type')}
              </label>
              <select
                id="type-filter"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">{t('jobBoard.filters.allTypes')}</option>
                <option value="application">{t('jobPostingAdmin.create.typeApplication')}</option>
                <option value="fixed">{t('jobPostingAdmin.create.typeFixed')}</option>
              </select>
            </div>
          
            {/* Date Filter - Month/Day Dropdowns */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.startDate')}
              </label>
              <div className="flex space-x-2">
                {/* Month Dropdown */}
                <select
                  value={filters.month || ''}
                  onChange={(e) => handleDateFilterChange('month', e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                >
                  <option value="">전체</option>
                  <option value="01">1월</option>
                  <option value="02">2월</option>
                  <option value="03">3월</option>
                  <option value="04">4월</option>
                  <option value="05">5월</option>
                  <option value="06">6월</option>
                  <option value="07">7월</option>
                  <option value="08">8월</option>
                  <option value="09">9월</option>
                  <option value="10">10월</option>
                  <option value="11">11월</option>
                  <option value="12">12월</option>
                </select>
                
                {/* Day Dropdown */}
                <select
                  value={filters.day || ''}
                  onChange={(e) => handleDateFilterChange('day', e.target.value)}
                  disabled={!filters.month}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:bg-gray-100"
                >
                  <option value="">전체</option>
                  {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                    <option key={day} value={day.toString().padStart(2, '0')}>
                      {day}일
                    </option>
                  ))}
                </select>
              </div>
              {filters.month && filters.day ? <p className="text-xs text-gray-500 mt-1">
                  {parseInt(filters.month)}월 {parseInt(filters.day)}일
                </p> : null}
            </div>
          
            {/* Role Filter */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                {t('jobBoard.filters.role')}
              </label>
              <select
                id="role"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="all">{t('jobBoard.filters.allRoles')}</option>
                <option value="dealer">{t('roles.dealer')}</option>
                <option value="floor">{t('roles.floor')}</option>
                <option value="serving">{t('roles.serving')}</option>
                <option value="tournament_director">{t('roles.tournament_director')}</option>
                <option value="chip_master">{t('roles.chip_master')}</option>
                <option value="registration">{t('roles.registration')}</option>
                <option value="security">{t('roles.security')}</option>
                <option value="cashier">{t('roles.cashier')}</option>
              </select>
            </div>
          </div>
        
          {/* Reset and Refresh Buttons */}
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              🔄 새로고침
            </button>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('jobBoard.filters.reset')}
            </button>
          </div>
        </div>

        {/* Job Postings List */}
        <div className="space-y-4">
          {jobPostings?.map((post) => {
            const formattedStartDate = formatDateUtil(post.startDate);
            const formattedEndDate = formatDateUtil(post.endDate);
            const applicationStatus = appliedJobs.get(post.id);

            return (
              <div key={post.id} className="bg-white p-3 sm:p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                  <div className="flex-grow">
                    <div className="flex items-center mb-2">
                      <h2 className="text-xl font-bold mr-4">{post.title}</h2>
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      {t('jobPostingAdmin.manage.location')}: {post.location}
                    </p>
                    <p className="text-sm text-gray-500 mb-1">
                                            {t('jobPostingAdmin.manage.date')}: {formattedStartDate} ~ {formattedEndDate}
                    </p>
                    {/* 시간대 및 역할 표시 - 일자별 다른 인원 요구사항 고려 */}
                    {JobPostingUtils.hasDateSpecificRequirements(post) ? (
                      /* 일자별 다른 인원 요구사항이 있는 경우 */
                      post.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
                        <div key={dateIndex} className="mt-3">
                          <div className="text-sm font-medium text-blue-600 mb-2">
                            📅 {formatDateUtil(dateReq.date)} 일정
                          </div>
                          {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                            <div key={`${dateIndex}-${tsIndex}`} className="mt-2 pl-6 text-sm">
                              <span className="font-semibold text-gray-700">
                                {ts.isTimeToBeAnnounced ? (
                                  <span className="text-orange-600">
                                    ⏰ 미정
                                    {ts.tentativeDescription && (
                                      <span className="text-gray-600 font-normal ml-1">({ts.tentativeDescription})</span>
                                    )}
                                  </span>
                                ) : (
                                  ts.time
                                )}
                              </span>
                              <span className="text-gray-600"> - </span>
                              {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                                // Firebase Timestamp를 문자열로 변환
                                const dateString = timestampToLocalDateString(dateReq.date);
                                
                                const confirmedCount = JobPostingUtils.getConfirmedStaffCount(
                                  post,
                                  dateString,
                                  ts.time,
                                  r.name
                                );
                                const isFull = confirmedCount >= r.count;
                                return (
                                  <span key={roleIndex}>
                                    {roleIndex > 0 && <span className="text-gray-400">, </span>}
                                    <span className={isFull ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                      {t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}명 
                                      {isFull ? ' (마감)' : ` (${confirmedCount}/${r.count})`}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      /* 기존 방식: 전체 기간 공통 timeSlots */
                      post.timeSlots?.map((ts: TimeSlot, index: number) => (
                        <div key={index} className="mt-2 pl-4 text-sm">
                          <span className="font-semibold text-gray-700">
                            {ts.isTimeToBeAnnounced ? (
                              <span className="text-orange-600">
                                ⏰ 미정
                                {ts.tentativeDescription && (
                                  <span className="text-gray-600 font-normal ml-1">({ts.tentativeDescription})</span>
                                )}
                              </span>
                            ) : (
                              ts.time
                            )}
                          </span>
                          <span className="text-gray-600"> - </span>
                          {ts.roles.map((r: RoleRequirement, i: number) => {
                            const confirmedCount = post.confirmedStaff?.filter((staff: ConfirmedStaff) => 
                              staff.timeSlot === ts.time && staff.role === r.name
                            ).length || 0;
                            const isFull = confirmedCount >= r.count;
                            return (
                              <span key={i}>
                                {i > 0 && <span className="text-gray-400">, </span>}
                                <span className={isFull ? 'text-red-600 font-medium' : 'text-gray-700'}>
                                  {t(`jobPostingAdmin.create.${r.name}`, r.name)}: {r.count}명
                                  {isFull ? ' (마감)' : ` (${confirmedCount}/${r.count})`}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ))
                    )}
                    <p className="text-sm text-gray-500 mt-2">
                      {t('jobPostingAdmin.create.description')}: {post.description}
                    </p>
                  </div>
                  <div className='flex flex-col items-end space-y-2'>
                    <button
                      onClick={() => showInfo('Detailed view not implemented yet.')}
                      className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {t('jobBoard.viewDetails')}
                    </button>
                    {applicationStatus ? (
                      applicationStatus === 'confirmed' ? (
                        <button
                          disabled
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-500 cursor-not-allowed"
                        >
                          {t('jobBoard.confirmed', 'Confirmed')}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCancelApplication(post.id)}
                          disabled={isProcessing === post.id}
                          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {isProcessing === post.id ? t('jobBoard.cancelling', 'Cancelling...') : t('jobBoard.cancelApplication', 'Cancel Application')}
                        </button>
                      )
                    ) : (
                      <div className="w-full space-y-2">
                        {hasPreQuestions(post) ? (
                          <>
                            {/* 사전질문이 있는 경우 */}
                            <button
                              onClick={() => handleOpenPreQuestionModal(post)}
                              disabled={isProcessing === post.id}
                              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                            >
                              📝 사전질문 확인
                            </button>
                            <button
                              onClick={() => handleOpenApplyModal(post)}
                              disabled={isProcessing === post.id || !preQuestionCompleted.get(post.id)}
                              className={`w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                                preQuestionCompleted.get(post.id) 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'bg-gray-400 cursor-not-allowed'
                              } disabled:bg-gray-400`}
                            >
                              {isProcessing === post.id 
                                ? t('jobBoard.applying') 
                                : preQuestionCompleted.get(post.id) 
                                  ? '✅ 지원하기' 
                                  : '🔒 지원하기 (사전질문 필요)'}
                            </button>
                          </>
                        ) : (
                          /* 사전질문이 없는 경우 - 기존 방식 */
                          <button
                            onClick={() => handleOpenApplyModal(post)}
                            disabled={isProcessing === post.id}
                            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                          >
                            {isProcessing === post.id ? t('jobBoard.applying') : t('jobBoard.applyNow')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Apply Modal */}
        {isApplyModalOpen && selectedPost ? <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-4 sm:top-20 mx-auto p-3 sm:p-5 border w-full max-w-[95%] sm:max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] sm:max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">{t('jobBoard.applyModal.title', { postTitle: selectedPost.title })}</h3>
              
              {/* 선택된 항목들 미리보기 */}
              {selectedAssignments.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <h4 className="text-sm font-medium text-green-800 mb-2">선택된 항목 ({selectedAssignments.length}개):</h4>
                  <div className="space-y-1">
                    {selectedAssignments.map((assignment, index) => (
                      <div key={index} className="text-xs text-green-700">
                        {assignment.date ? `📅 ${formatDateUtil(assignment.date)} - ` : ''}
                        ⏰ {assignment.timeSlot} - 👤 {t(`jobPostingAdmin.create.${assignment.role}`, assignment.role)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="max-h-64 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-700 mb-3">시간대 및 역할 선택 (여러 개 선택 가능)</label>
                
                {/* 일자별 다른 인원 요구사항이 있는 경우 */}
                {JobPostingUtils.hasDateSpecificRequirements(selectedPost) ? (
                  selectedPost.dateSpecificRequirements?.map((dateReq: DateSpecificRequirement, dateIndex: number) => (
                    <div key={dateIndex} className="mb-6 border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <h4 className="text-sm font-semibold text-blue-800 mb-3">
                        📅 {formatDateUtil(dateReq.date)}
                      </h4>
                      {dateReq.timeSlots.map((ts: TimeSlot, tsIndex: number) => (
                        <div key={tsIndex} className="mb-4 pl-4 border-l-2 border-blue-300">
                          <div className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                            ⏰ {ts.isTimeToBeAnnounced ? (
                              <span className="text-orange-600">
                                미정
                                {ts.tentativeDescription && (
                                  <span className="text-gray-600 font-normal ml-2">({ts.tentativeDescription})</span>
                                )}
                              </span>
                            ) : (
                              ts.time
                            )}
                          </div>
                          <div className="space-y-2">
                            {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                              const assignment = { timeSlot: ts.time, role: r.name, date: dateReq.date };
                              const confirmedCount = selectedPost.confirmedStaff?.filter(staff => 
                                staff.timeSlot === ts.time && 
                                staff.role === r.name && 
                                staff.date === dateReq.date
                              ).length || 0;
                              const isFull = confirmedCount >= r.count;
                              const isSelected = isAssignmentSelected(assignment);
                              
                              return (
                                <label 
                                  key={roleIndex} 
                                  className={`flex items-center p-2 rounded cursor-pointer ${
                                    isFull ? 'bg-gray-100 cursor-not-allowed' : 
                                    isSelected ? 'bg-green-100 border border-green-300' : 'bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isFull}
                                    onChange={(e) => handleMultipleAssignmentChange(assignment, e.target.checked)}
                                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:cursor-not-allowed"
                                  />
                                  <span className={`ml-3 text-sm ${
                                    isFull ? 'text-gray-400' : 'text-gray-700'
                                  }`}>
                                    👤 {t(`jobPostingAdmin.create.${r.name}`, r.name)} 
                                    <span className={`ml-2 text-xs ${
                                      isFull ? 'text-red-500 font-medium' : 'text-gray-500'
                                    }`}>
                                      ({isFull ? '마감' : `${confirmedCount}/${r.count}`})
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  /* 기존 방식: 전체 기간 공통 timeSlots */
                  selectedPost.timeSlots?.map((ts: TimeSlot, tsIndex: number) => (
                    <div key={tsIndex} className="mb-4 border border-gray-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        ⏰ {ts.isTimeToBeAnnounced ? (
                          <span className="text-orange-600">
                            미정
                            {ts.tentativeDescription && (
                              <span className="text-gray-600 font-normal ml-2">({ts.tentativeDescription})</span>
                            )}
                          </span>
                        ) : (
                          ts.time
                        )}
                      </div>
                      <div className="space-y-2">
                        {ts.roles.map((r: RoleRequirement, roleIndex: number) => {
                          const assignment = { timeSlot: ts.time, role: r.name };
                          const confirmedCount = selectedPost.confirmedStaff?.filter(staff => 
                            staff.timeSlot === ts.time && 
                            staff.role === r.name
                          ).length || 0;
                          const isFull = confirmedCount >= r.count;
                          const isSelected = isAssignmentSelected(assignment);
                          
                          return (
                            <label 
                              key={roleIndex} 
                              className={`flex items-center p-2 rounded cursor-pointer ${
                                isFull ? 'bg-gray-100 cursor-not-allowed' : 
                                isSelected ? 'bg-green-100 border border-green-300' : 'bg-white hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isFull}
                                onChange={(e) => handleMultipleAssignmentChange(assignment, e.target.checked)}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded disabled:cursor-not-allowed"
                              />
                              <span className={`ml-3 text-sm ${
                                isFull ? 'text-gray-400' : 'text-gray-700'
                              }`}>
                                👤 {t(`jobPostingAdmin.create.${r.name}`, r.name)} 
                                <span className={`ml-2 text-xs ${
                                  isFull ? 'text-red-500 font-medium' : 'text-gray-500'
                                }`}>
                                  ({isFull ? '마감' : `${confirmedCount}/${r.count}`})
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex justify-end mt-4 space-x-2">
                <button 
                  onClick={() => setIsApplyModalOpen(false)} 
                  className="py-3 px-6 sm:py-2 sm:px-4 bg-gray-500 text-white rounded hover:bg-gray-700 min-h-[48px] text-sm sm:text-base"
                >
                  {t('jobBoard.applyModal.cancel')}
                </button>
                <button 
                  onClick={handleApply} 
                  disabled={selectedAssignments.length === 0 || isProcessing === selectedPost.id} 
                  className="py-3 px-6 sm:py-2 sm:px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 min-h-[48px] text-sm sm:text-base"
                >
                  {isProcessing ? t('jobBoard.applying') : `지원하기 (${selectedAssignments.length}개 선택)`}
                </button>
              </div>
              </div>
              </div> : null}

        {/* PreQuestion Modal */}
        {isPreQuestionModalOpen && selectedPost && selectedPost.preQuestions ? <PreQuestionModal
            isOpen={isPreQuestionModalOpen}
            onClose={() => setIsPreQuestionModalOpen(false)}
            onComplete={handlePreQuestionComplete}
            questions={selectedPost.preQuestions}
            jobPostingId={selectedPost.id}
          /> : null}
        
            {/* Infinite Scroll Loading Indicator */}
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage ? <LoadingSpinner size="md" text="추가 공고를 불러오는 중..." /> : null}
              {!hasNextPage && jobPostings.length > 0 && (
                <p className="text-gray-500 text-center py-4">
                  더 이상 공고가 없습니다.
                </p>
              )}
            </div>
          </>
        )}

        {/* 내 지원 현황 탭 */}
        {activeTab === 'myApplications' && (
          <div>
            {loadingMyApplications ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" text="지원 현황을 불러오는 중..." />
              </div>
            ) : myApplications.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg mb-2">📋</div>
                <p className="text-gray-500 mb-4">아직 지원한 공고가 없습니다.</p>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  구인 공고 보러가기
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">내 지원 현황 ({myApplications.length}건)</h2>
                  <button
                    onClick={fetchMyApplications}
                    disabled={loadingMyApplications}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {loadingMyApplications ? '새로고침 중...' : '🔄 새로고침'}
                  </button>
                </div>
                
                {myApplications.map((application) => (
                  <div key={application.id} className="bg-white rounded-lg shadow-md p-6 border">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {application.jobPosting?.title || '삭제된 공고'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          지원일: {formatDateUtil(application.appliedAt)}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        application.status === 'confirmed' 
                          ? 'bg-green-100 text-green-800' 
                          : application.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {application.status === 'confirmed' ? '✅ 확정' : 
                         application.status === 'rejected' ? '❌ 미선정' : '⏳ 대기중'}
                      </div>
                    </div>

                    {application.jobPosting ? <div className="mb-4 text-sm text-gray-600">
                        <p>📍 {application.jobPosting.location}</p>
                        <p>📅 {formatDateUtil(application.jobPosting.startDate)} ~ {formatDateUtil(application.jobPosting.endDate)}</p>
                      </div> : null}

                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">지원한 시간대</h4>
                      
                      {/* 다중 선택 지원 정보 표시 */}
                      {application.assignedRoles && application.assignedTimes ? (
                        <div className="space-y-2">
                          {application.assignedTimes.map((time: string, index: number) => (
                            <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1">
                                {application.assignedDates && application.assignedDates[index] ? <span className="text-blue-600 font-medium">📅 {formatDateUtil(application.assignedDates[index])} | </span> : null}
                                <span className="text-gray-700">⏰ {time ? (typeof time === 'object' && (time as any)?.seconds ? formatDateUtil(time) : time) : ''}</span>
                                {application.assignedRoles[index] ? <span className="ml-2 text-gray-600">
                                     - 👤 {String(t(`jobPostingAdmin.create.${application.assignedRoles[index]}`, application.assignedRoles[index]))}
                                   </span> : null}
                              </div>
                              {application.status === 'confirmed' && (
                                <span className="ml-2 text-green-600 text-sm font-medium">확정됨</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* 단일 선택 지원 정보 표시 (하위 호환성) */
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            {application.assignedDate ? <span className="text-blue-600 font-medium">📅 {formatDateUtil(application.assignedDate)} | </span> : null}
                            <span className="text-gray-700">⏰ {application.assignedTime ? (typeof application.assignedTime === 'object' && (application.assignedTime as any)?.seconds ? formatDateUtil(application.assignedTime) : application.assignedTime) : ''}</span>
                                                         {application.assignedRole ? <span className="ml-2 text-gray-600">
                                 - 👤 {String(t(`jobPostingAdmin.create.${application.assignedRole}`, application.assignedRole))}
                               </span> : null}
                          </div>
                          {application.status === 'confirmed' && (
                            <span className="ml-2 text-green-600 text-sm font-medium">확정됨</span>
                          )}
                        </div>
                      )}

                      {/* 사전질문 답변 표시 */}
                      {(application as any).preQuestionAnswers && (application as any).preQuestionAnswers.length > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <h5 className="font-medium text-blue-800 mb-2">📝 사전질문 답변</h5>
                          <div className="space-y-2">
                            {(application as any).preQuestionAnswers.map((answer: any, index: number) => (
                              <div key={index} className="text-sm">
                                <p className="font-medium text-gray-700">
                                  Q{index + 1}. {answer?.question || '질문 정보 없음'}
                                  {answer?.required && <span className="text-red-500 ml-1">*</span>}
                                </p>
                                <p className="text-gray-600 ml-4 mt-1">
                                  ▶ {answer?.answer && answer.answer !== 'undefined' && answer.answer !== undefined 
                                      ? answer.answer 
                                      : <span className="text-gray-400">(답변 없음)</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {application.status === 'confirmed' && application.confirmedAt ? <p className="text-sm text-green-600 mt-2">
                          ✅ 확정일: {formatDateUtil(application.confirmedAt)}
                        </p> : null}
                      
                      {application.status === 'applied' && application.jobPosting ? <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => handleCancelApplication(application.postId)}
                            disabled={isProcessing === application.postId}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 text-sm"
                          >
                            {isProcessing === application.postId ? '취소 중...' : '지원 취소'}
                          </button>
                        </div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </JobBoardErrorBoundary>
  );
};

export default JobBoardPage;