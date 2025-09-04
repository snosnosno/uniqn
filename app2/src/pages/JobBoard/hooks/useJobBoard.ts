import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, serverTimestamp, addDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import useUnifiedData, { useJobPostingData } from '../../../hooks/useUnifiedData';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../firebase';
import { useInfiniteJobPostings } from '../../../hooks/useJobPostings';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { logger } from '../../../utils/logger';
import { JobPosting, PreQuestionAnswer } from '../../../types/jobPosting';
import { sortJobPostingsByPriority } from '../../../utils/jobPosting/sortingUtils';

export interface JobFilters {
  location: string;
  type: 'all' | 'application' | 'fixed';
  startDate: string;
  role: string;
  month: string;
  day: string;
}

export interface Assignment {
  timeSlot: string;
  role: string;
  date?: string | any;
  duration?: {
    type: 'single' | 'multi';
    endDate?: string;
  };
}

/**
 * 구인공고 게시판 로직을 관리하는 커스텀 훅
 */
export const useJobBoard = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  
  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState<'jobs' | 'myApplications'>('jobs');
  
  // 필터 상태
  const [filters, setFilters] = useState<JobFilters>({
    location: 'all',
    type: 'all',
    startDate: '',
    role: 'all',
    month: '',
    day: ''
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // 지원 관련 상태
  const [appliedJobs, setAppliedJobs] = useState<Map<string, string>>(new Map());
  
  // 상세보기 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailPost, setSelectedDetailPost] = useState<JobPosting | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<JobPosting | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  
  // 모달 상태
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isPreQuestionModalOpen, setIsPreQuestionModalOpen] = useState(false);
  
  // 사전질문 상태
  const [preQuestionCompleted, setPreQuestionCompleted] = useState<Map<string, boolean>>(new Map());
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<Map<string, PreQuestionAnswer[]>>(new Map());
  
  // UnifiedDataContext 먼저 선언
  const unifiedContext = useUnifiedData();
  
  // 내 지원 현황 로딩 상태 - 로딩 상태 개선
  const loadingMyApplications = unifiedContext.state.loading.initial || 
                               (unifiedContext.state.loading.applications && 
                                Array.from(unifiedContext.state.applications.values()).length === 0);
  
  // Infinite Query based data fetching
  const {
    data: infiniteData,
    isLoading: loading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  } = useInfiniteJobPostings(filters);
  
  // Flatten and sort the infinite query data
  const jobPostings = useMemo(() => {
    const result = infiniteData?.pages.flatMap((page: any) => page.jobs) || [];
    
    // 오늘 날짜 기준 우선순위 정렬 적용
    const sortedResult = sortJobPostingsByPriority(result);
    
    logger.debug('📋 JobBoardPage - 정렬된 공고 목록:', { 
      component: 'JobBoardPage', 
      data: {
        total: sortedResult.length,
        top5: sortedResult.slice(0, 5).map(p => ({ 
          id: p.id, 
          title: p.title,
          dates: p.dateSpecificRequirements?.length || 0
        }))
      }
    });
    
    return sortedResult;
  }, [infiniteData]);
  
  // Infinite scroll hook
  const { loadMoreRef } = useInfiniteScroll({
    hasNextPage: hasNextPage || false,
    isFetchingNextPage,
    fetchNextPage
  });
  
  // 지원한 공고 가져오기
  useEffect(() => {
    if (!currentUser || !jobPostings) return;
    
    const fetchAppliedJobs = async () => {
      if (jobPostings.length === 0) return;
      
      const postIds = jobPostings.map(p => p.id);
      // eventId 우선 사용, postId는 하위 호환성만 지원
      const qEventId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('eventId', 'in', postIds));
      const qPostId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('postId', 'in', postIds));
      
      const [eventIdSnapshot, postIdSnapshot] = await Promise.all([
        getDocs(qEventId).catch(() => ({ docs: [] })),
        getDocs(qPostId).catch(() => ({ docs: [] }))
      ]);
      
      const appliedMap = new Map<string, string>();
      
      // eventId 기반 결과 처리 (우선순위)
      eventIdSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const jobId = data.eventId || data.postId; // eventId 우선, fallback으로 postId
        if (jobId) {
          appliedMap.set(jobId, data.status);
        }
      });
      
      // postId 기반 결과 처리 (중복 제거 - eventId가 없는 경우만)
      postIdSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const jobId = data.postId;
        if (jobId && !appliedMap.has(jobId)) {
          appliedMap.set(jobId, data.status);
        }
      });
      setAppliedJobs(appliedMap);
    };
    
    fetchAppliedJobs();
  }, [jobPostings, currentUser]);
  
  // UnifiedDataContext에서 지원 현황 가져오기
  const { jobPostings: allJobPostings } = useJobPostingData();
  
  // 내 지원 현황 계산 (memoized) - MyApplicationsTab과 호환되는 타입으로 변환
  const myApplications = useMemo(() => {
    if (!currentUser || !unifiedContext.state) {
      logger.debug('🎯 myApplications 계산 스킵', { 
        component: 'useJobBoard',
        data: { currentUser: !!currentUser, state: !!unifiedContext.state }
      });
      return [];
    }
    
    // 디버깅: 전체 applications 데이터 확인
    const allApplications = Array.from(unifiedContext.state.applications.values());
    logger.debug('🎯 전체 Applications 데이터', {
      component: 'useJobBoard',
      data: {
        total: allApplications.length,
        loading: {
          applications: unifiedContext.state.loading.applications,
          initial: unifiedContext.state.loading.initial
        },
        sample: allApplications.slice(0, 3).map(app => ({
          id: app.id,
          applicantId: app.applicantId,
          postId: app.postId,
          status: app.status
        })),
        currentUserId: currentUser.uid
      }
    });

    // 로딩 상태 처리 개선 - 초기 로딩과 applications 특정 로딩 모두 고려
    const isReallyLoading = unifiedContext.state.loading.initial || 
                           (unifiedContext.state.loading.applications && allApplications.length === 0);
                           
    if (isReallyLoading) {
      logger.debug('🔄 Applications 로딩 중', { 
        component: 'useJobBoard',
        data: {
          initial: unifiedContext.state.loading.initial,
          applications: unifiedContext.state.loading.applications,
          count: allApplications.length
        }
      });
      return [];
    }

    // 데이터가 비어있어도 빈 배열 반환 (무한로딩 방지) - 로딩 완료 후
    if (allApplications.length === 0) {
      logger.info('ℹ️ Applications 데이터가 비어있습니다 (로딩 완료, 정상 상태)', { 
        component: 'useJobBoard'
      });
      return []; // 빈 배열 명시적 반환
    }
    
    // 현재 사용자의 지원서만 필터링 (applicantId 필드 확인)
    const userApplications = allApplications.filter(app => {
      const matchesId = app.applicantId === currentUser.uid;
      if (!matchesId && allApplications.length > 0) {
        // 디버깅: 첫 번째 앱에서 필드 구조 확인
        logger.debug('🔍 applicantId 매칭 실패 - 필드 구조 확인', {
          component: 'useJobBoard',
          data: {
            expected: currentUser.uid,
            actual: app.applicantId,
            appFields: Object.keys(app),
            sampleApp: allApplications[0]
          }
        });
      }
      return matchesId;
    });
    
    logger.debug('🎯 사용자별 필터링 결과', {
      component: 'useJobBoard',
      data: {
        userApplications: userApplications.length,
        applications: userApplications.map(app => ({
          id: app.id,
          postId: app.postId,
          status: app.status
        }))
      }
    });
    
    // 각 지원서에 JobPosting 정보 추가하고 MyApplicationsTab 호환 형식으로 변환
    const applicationsWithJobData = userApplications.map(application => {
      // eventId 우선 사용, postId는 fallback (필드명 통일)
      const jobId = (application as any).eventId || application.postId;
      const jobPosting = unifiedContext.state.jobPostings.get(jobId);
      
      // jobPosting 조회 실패 시 로깅
      if (jobId && !jobPosting) {
        logger.debug('⚠️ JobPosting 조회 실패', {
          component: 'useJobBoard',
          data: {
            applicationId: application.id,
            eventId: (application as any).eventId,
            postId: application.postId,
            searchedId: jobId,
            availableJobPostings: Array.from(unifiedContext.state.jobPostings.keys()).slice(0, 5)
          }
        });
      }
      
      return {
        id: application.id,
        postId: application.postId,
        status: application.status,
        appliedAt: application.appliedAt || application.createdAt || new Date(),
        confirmedAt: application.confirmedAt,
        assignedTime: application.assignedTime,
        assignedRole: application.assignedRole,
        assignedDate: application.assignedDate,
        assignedTimes: application.assignedTimes,
        assignedRoles: application.assignedRoles,
        assignedDates: application.assignedDates,
        preQuestionAnswers: (application as any).preQuestionAnswers,
        jobPosting: jobPosting ? {
          id: jobPosting.id,
          title: jobPosting.title,
          location: jobPosting.location,
          district: jobPosting.district,
          detailedAddress: jobPosting.detailedAddress,
          startDate: jobPosting.startDate,
          endDate: jobPosting.endDate,
          dateSpecificRequirements: jobPosting.dateSpecificRequirements,
          salaryType: (jobPosting as any).salaryType,
          salaryAmount: (jobPosting as any).salaryAmount,
          benefits: (jobPosting as any).benefits,
          useRoleSalary: (jobPosting as any).useRoleSalary,
          roleSalaries: (jobPosting as any).roleSalaries
        } : null
      };
    });
    
    // 최신 지원 순으로 정렬
    applicationsWithJobData.sort((a, b) => {
      const aDate = (a.appliedAt as any)?.seconds || 0;
      const bDate = (b.appliedAt as any)?.seconds || 0;
      return bDate - aDate;
    });
    
    return applicationsWithJobData as any[];
  }, [currentUser, unifiedContext.state]);
  
  // 레거시 fetchMyApplications 함수 (호환성 유지)
  const fetchMyApplications = useCallback(() => {
    // UnifiedDataContext가 실시간으로 업데이트하므로 별도 fetch 불필요
    // 하지만 기존 컴포넌트 호환성을 위해 빈 함수로 유지
  }, []);
  
  // UnifiedDataContext를 사용하므로 탭 변경 시 별도 데이터 로딩 불필요
  
  // Filter handlers
  const handleFilterChange = (filters: JobFilters) => {
    setFilters(filters);
  };
  
  // 사전질문 모달 핸들러
  const handlePreQuestionComplete = (answers: PreQuestionAnswer[]) => {
    if (!selectedPost) return;
    
    setPreQuestionCompleted(prev => new Map(prev).set(selectedPost.id, true));
    setPreQuestionAnswers(prev => new Map(prev).set(selectedPost.id, answers));
    setIsPreQuestionModalOpen(false);
    
    // 사전질문 완료 후 자동으로 지원하기 모달 열기
    setIsApplyModalOpen(true);
    setSelectedAssignments([]);
  };
  
  const handleOpenApplyModal = (post: JobPosting) => {
    // 이미 지원한 경우는 바로 리턴 (지원완료 상태에서는 수정 불가)
    if (appliedJobs.get(post.id)) {
      return;
    }
    
    // 사전질문이 있고 아직 답변하지 않은 경우
    if (post.preQuestions && post.preQuestions.length > 0 && !preQuestionCompleted.get(post.id)) {
      setSelectedPost(post);
      setIsPreQuestionModalOpen(true);
    } else {
      setSelectedPost(post);
      setIsApplyModalOpen(true);
      setSelectedAssignments([]);
    }
  };
  
  // 다중 선택 관리 함수
  const handleMultipleAssignmentChange = (assignment: Assignment, isChecked: boolean) => {
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
      const assignedDurations = selectedAssignments.map(item => item.duration || null);
      
      // 기존 호환성을 위해 첫 번째 선택값 사용
      const firstSelection = selectedAssignments[0];
      
      // 사전질문 답변 가져오기
      const answers = preQuestionAnswers.get(selectedPost.id);
      
      // Firebase용 데이터 객체 구성 (undefined 값 제거)
      const applicationData: any = {
        applicantId: currentUser.uid,
        applicantName: staffDoc.data().name || t('jobBoard.unknownApplicant'),
        eventId: selectedPost.id,  // postId 대신 eventId 사용
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
      
      // duration 정보 저장
      if (assignedDurations.length > 0 && assignedDurations.some(d => d !== null)) {
        applicationData.assignedDurations = assignedDurations;
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
        // eventId와 postId 모두 지원 (마이그레이션 호환성)
        const qEventId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('eventId', '==', postId));
        const qPostId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('postId', '==', postId));
        
        const [eventIdSnapshot, postIdSnapshot] = await Promise.all([
          getDocs(qEventId).catch(() => ({ docs: [] })),
          getDocs(qPostId).catch(() => ({ docs: [] }))
        ]);
        
        // 두 쿼리 결과 병합
        const allDocs = [...eventIdSnapshot.docs, ...postIdSnapshot.docs];
        const uniqueDocs = allDocs.filter((doc, index, arr) => 
          arr.findIndex(d => d.id === doc.id) === index
        );
        
        const deletePromises: Promise<void>[] = [];
        uniqueDocs.forEach((document) => {
          deletePromises.push(deleteDoc(doc(db, 'applications', document.id)));
        });
        await Promise.all(deletePromises);
        
        showSuccess(t('jobBoard.alerts.cancelSuccess'));
        setAppliedJobs(prev => {
          const newMap = new Map(prev);
          newMap.delete(postId);
          return newMap;
        });
        
        // 내 지원 현황 새로고침
        if (activeTab === 'myApplications') {
          fetchMyApplications();
        }
      } catch (error) {
        logger.error('Error cancelling application: ', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
        showError(t('jobBoard.alerts.cancelFailed'));
      } finally {
        setIsProcessing(null);
      }
    }
  };
  
  // 지원 모달에서 사전질문 모달로 돌아가기
  const handleBackToPreQuestions = () => {
    setIsApplyModalOpen(false);
    setIsPreQuestionModalOpen(true);
  };
  
  // 상세보기 모달 열기
  const handleOpenDetailModal = (post: JobPosting) => {
    setSelectedDetailPost(post);
    setIsDetailModalOpen(true);
  };
  
  // 상세보기 모달 닫기
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedDetailPost(null);
  };

  return {
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
  };
};