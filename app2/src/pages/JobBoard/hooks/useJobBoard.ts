import { useState, useEffect, useMemo, useCallback } from 'react';
import { serverTimestamp, addDoc, collection, doc, deleteDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import useUnifiedData, { useJobPostingData } from '../../../hooks/useUnifiedData';
import { useUnifiedDataContext } from '../../../contexts/UnifiedDataContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { db } from '../../../firebase';
import { useInfiniteJobPostings } from '../../../hooks/useJobPostings';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { logger } from '../../../utils/logger';
import { JobPosting, PreQuestionAnswer } from '../../../types/jobPosting';
import { Assignment } from '../../../types/application';
import { sortJobPostingsByPriority } from '../../../utils/jobPosting/sortingUtils';

export interface JobFilters {
  location: string;
  type: 'all' | 'application' | 'fixed';
  startDate: string;
  role: string;
  month: string;
  day: string;
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
  const { dispatch } = useUnifiedDataContext();
  
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
  
  // 지원한 공고 가져오기 - UnifiedDataContext 활용
  useEffect(() => {
    if (!currentUser || !jobPostings) return;
    
    if (jobPostings.length === 0) return;
    
    const postIds = jobPostings.map(p => p.id);
    const userApplications = Array.from(unifiedContext.state.applications.values())
      .filter(app => app.applicantId === currentUser.uid);
    
    const appliedMap = new Map<string, string>();
    
    userApplications.forEach(app => {
      // eventId 우선, fallback으로 postId 사용
      const jobId = app.eventId || app.postId;
      if (jobId && postIds.includes(jobId)) {
        appliedMap.set(jobId, app.status);
      }
    });
    
    setAppliedJobs(appliedMap);
  }, [jobPostings, currentUser, unifiedContext.state.applications]);
  
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
      const jobId = application.eventId || application.postId;
      const jobPosting = unifiedContext.state.jobPostings.get(jobId);
      
      // jobPosting 조회 실패 시 로깅
      if (jobId && !jobPosting) {
        logger.debug('⚠️ JobPosting 조회 실패', {
          component: 'useJobBoard',
          data: {
            applicationId: application.id,
            eventId: application.eventId,
            postId: application.postId,
            searchedId: jobId,
            availableJobPostings: Array.from(unifiedContext.state.jobPostings.keys()).slice(0, 5)
          }
        });
      }
      
      return {
        id: application.id,
        postId: application.eventId || application.postId,  // eventId 우선 사용
        status: application.status,
        appliedAt: application.appliedAt || application.createdAt || new Date(),
        confirmedAt: application.confirmedAt,
        // 🔧 핵심 수정: postTitle 필드 추가 (jobPosting에서 가져오기)
        postTitle: jobPosting?.title || application.postTitle || '제목 없음',
        // 🎯 중요: assignments 배열을 그대로 전달 (MyApplicationsTab에서 직접 사용)
        assignments: application.assignments || [],
        // 레거시 호환성을 위한 개별 필드들 (하위 호환성)
        assignedTime: application.assignments?.[0]?.timeSlot || '',
        assignedRole: application.assignments?.[0]?.role || '',
        assignedDate: application.assignments?.[0]?.dates?.[0] || '',
        assignedTimes: application.assignments?.map(a => a.timeSlot) || [],
        assignedRoles: application.assignments?.map(a => a.role) || [],
        assignedDates: application.assignments?.flatMap(a => a.dates || []) || [],
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
          JSON.stringify(item.dates?.sort()) === JSON.stringify(assignment.dates?.sort()))
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
      
      // 🆕 그룹 선택 통합 처리 - 같은 timeSlot과 dates를 가진 역할들을 통합
      const groupedAssignments = new Map<string, Assignment[]>();
      
      // 1단계: assignments를 groupKey로 그룹화
      selectedAssignments.forEach(item => {
        const dates = item.dates && item.dates.length > 0 ? item.dates : [];
        const groupKey = `${item.timeSlot}__${JSON.stringify(dates.sort())}`;
        
        if (!groupedAssignments.has(groupKey)) {
          groupedAssignments.set(groupKey, []);
        }
        groupedAssignments.get(groupKey)!.push(item);
      });
      
      // 2단계: 그룹화된 assignments를 통합 assignment로 변환
      const assignments = Array.from(groupedAssignments.entries()).map(([groupKey, items]) => {
        // 🔒 안전 검사: items 배열이 비어있으면 스킵
        if (!items.length) return null;
        
        const firstItem = items[0]!; // TypeScript assertion (위에서 체크했으므로 안전)
        const dates = firstItem.dates && firstItem.dates.length > 0 ? firstItem.dates : [];
        
        // 🎯 그룹 선택 판별: 같은 timeSlot + dates에 여러 역할이 있으면 그룹 선택
        const isGroupSelection = items.length > 1;
        
        if (isGroupSelection) {
          // 📋 그룹 선택: 여러 역할을 하나의 assignment로 통합
          const roles = items.map(item => item.role).filter((role): role is string => Boolean(role));
          
          return {
            roles: roles, // 🆕 여러 역할을 roles 배열로 저장
            timeSlot: firstItem.timeSlot,
            dates: dates,
            checkMethod: 'group' as const,
            isGrouped: true,
            groupId: firstItem.groupId || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...(firstItem.duration && {
              duration: {
                ...firstItem.duration,
                startDate: dates[0] || '',
              }
            })
          };
        } else {
          // 👤 개별 선택: 기존 방식 유지
          return {
            role: firstItem.role || '', // 🔒 기본값으로 빈 문자열 사용
            timeSlot: firstItem.timeSlot,
            dates: dates,
            checkMethod: 'individual' as const,
            isGrouped: firstItem.isGrouped || dates.length > 1,
            ...(firstItem.duration && {
              duration: {
                ...firstItem.duration,
                startDate: dates[0] || '',
              }
            }),
            ...(firstItem.groupId && { groupId: firstItem.groupId })
          };
        }
      }).filter(Boolean) as Assignment[]; // null 값 필터링

      
      // 사전질문 답변 가져오기
      const answers = preQuestionAnswers.get(selectedPost.id);
      
      // Firebase용 데이터 객체 구성 (간소화)
      const applicationData: any = {
        applicantId: currentUser.uid,
        applicantName: staffDoc.data().name || t('jobBoard.unknownApplicant'),
        eventId: selectedPost.id,  // 필드명 통일: eventId 사용 (표준)
        postId: selectedPost.id,   // 하위 호환성을 위해 유지
        postTitle: selectedPost.title,
        status: 'applied',
        appliedAt: serverTimestamp(),
        
        // 🆕 통합된 assignments 구조 (Single Source of Truth)
        assignments
      };
      
      // 사전질문 답변이 있으면 추가
      if (answers && answers.length > 0) {
        applicationData.preQuestionAnswers = answers;
      }
      
      
      // 🔍 Firebase 저장 전 데이터 확인 로깅 (상세)
      logger.info('🚀 Firebase에 저장할 applicationData:', {
        component: 'useJobBoard.handleApply',
        data: {
          postTitle: applicationData.postTitle,
          assignments: applicationData.assignments,
          assignmentsLength: applicationData.assignments?.length || 0,
          assignmentsDetail: JSON.stringify(applicationData.assignments, null, 2),
          hasPreQuestionAnswers: !!(applicationData.preQuestionAnswers?.length),
          fullApplicationData: applicationData
        }
      });
      
      // Firebase 저장 실행
      logger.info('📤 Firebase 저장 시작...', {
        component: 'useJobBoard.handleApply',
        data: { collection: 'applications' }
      });
      
      const docRef = await addDoc(collection(db, 'applications'), applicationData);
      
      // 저장 성공 로깅
      logger.info('✅ Firebase 저장 성공:', {
        component: 'useJobBoard.handleApply',
        data: {
          docId: docRef.id,
          savedAssignments: applicationData.assignments,
          savedPostTitle: applicationData.postTitle
        }
      });
      
      // 즉시 캐시 업데이트를 위한 Application 객체 생성
      const newApplication = {
        id: docRef.id,
        ...applicationData,
        createdAt: new Date() as any, // Timestamp 대신 Date 사용
        updatedAt: new Date() as any,
      };
      
      // UnifiedDataContext에 즉시 업데이트 트리거
      dispatch({
        type: 'UPDATE_APPLICATION',
        application: newApplication
      });
      
      logger.info('🚀 지원서 즉시 업데이트 완료', {
        component: 'useJobBoard',
        data: {
          applicationId: docRef.id,
          postId: selectedPost.id,
          applicantId: currentUser.uid,
          status: 'applied'
        }
      });
      
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