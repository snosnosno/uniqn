import { useState, useEffect, useMemo, useCallback } from 'react';
import { serverTimestamp, addDoc, collection, doc, deleteDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import useUnifiedData from '../../../hooks/useUnifiedData';
// { useJobPostingData } - 향후 사용 예정
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
import { validateRequiredProfileFields } from '../../../utils/profile/profileValidation';

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
  const [cancelConfirmPostId, setCancelConfirmPostId] = useState<string | null>(null);
  
  // 상세보기 모달 상태
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailPost, setSelectedDetailPost] = useState<JobPosting | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<JobPosting | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  
  // 모달 상태
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isPreQuestionModalOpen, setIsPreQuestionModalOpen] = useState(false);
  const [isIncompleteProfileModalOpen, setIsIncompleteProfileModalOpen] = useState(false);

  // 사전질문 상태
  const [preQuestionCompleted, setPreQuestionCompleted] = useState<Map<string, boolean>>(new Map());
  const [preQuestionAnswers, setPreQuestionAnswers] = useState<Map<string, PreQuestionAnswer[]>>(new Map());

  // 프로필 미완성 상태
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);
  
  // useUnifiedData 먼저 선언 (Zustand Store 기반)
  const { applications, jobPostings: jobPostingsFromStore, loading: unifiedDataLoading } = useUnifiedData();

  // 내 지원 현황 로딩 상태 - 로딩 상태 개선
  const loadingMyApplications = unifiedDataLoading || applications.length === 0;

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
    const userApplications = applications.filter(app => app.applicantId === currentUser.uid);

    const appliedMap = new Map<string, string>();

    userApplications.forEach(app => {
      // eventId 우선, fallback으로 postId 사용
      const jobId = app.eventId || app.postId;
      if (jobId && postIds.includes(jobId)) {
        appliedMap.set(jobId, app.status);
      }
    });

    setAppliedJobs(appliedMap);
  }, [jobPostings, currentUser, applications]);
  
  // UnifiedDataContext에서 지원 현황 가져오기 (향후 사용 예정)
  // const { jobPostings: allJobPostings } = useJobPostingData();
  
  // 내 지원 현황 계산 (memoized) - MyApplicationsTab과 호환되는 타입으로 변환
  const myApplications = useMemo(() => {
    if (!currentUser) {
      // myApplications 계산 스킵
      return [];
    }
    
    // 로딩 중이면 빈 배열 반환
    if (unifiedDataLoading) {
      return [];
    }

    // 데이터가 비어있어도 빈 배열 반환
    if (applications.length === 0) {
      return [];
    }

    // 현재 사용자의 지원서만 필터링
    const userApplications = applications.filter(app => app.applicantId === currentUser.uid);

    // JobPosting Map 생성 (O(1) 조회)
    const jobPostingMap = new Map(jobPostingsFromStore.map(jp => [jp.id, jp]));

    // 각 지원서에 JobPosting 정보 추가
    const applicationsWithJobData = userApplications.map(application => {
      const jobId = application.eventId || application.postId;
      const jobPosting = jobPostingMap.get(jobId);
      
      // jobPosting 조회 실패 시 - 로깅 제거됨
      
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
          ...jobPosting,  // 모든 필드를 그대로 복사
          recruitmentType: (jobPosting as any).recruitmentType || 'application'  // 기본값 설정
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
  }, [currentUser, unifiedDataLoading, applications, jobPostingsFromStore]);
  
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
  
  const handleOpenApplyModal = async (post: JobPosting) => {
    // 이미 지원한 경우는 바로 리턴 (지원완료 상태에서는 수정 불가)
    if (appliedJobs.get(post.id)) {
      return;
    }

    // 사용자 로그인 확인
    if (!currentUser) {
      showError(t('jobBoard.alerts.loginRequired'));
      return;
    }

    // 프로필 필수 필드 검증
    try {
      const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));

      if (!profileDoc.exists()) {
        showError(t('jobBoard.alerts.profileNotFound'));
        return;
      }

      const profileData = profileDoc.data();
      const validation = validateRequiredProfileFields(profileData);

      // 필수 필드가 누락된 경우
      if (!validation.isValid) {
        setMissingProfileFields(validation.missingFieldLabels);
        setIsIncompleteProfileModalOpen(true);
        return;
      }
    } catch (error) {
      logger.error('Error checking profile fields', error instanceof Error ? error : new Error(String(error)), { component: 'useJobBoard' });
      showError('프로필 정보를 확인하는 중 오류가 발생했습니다.');
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
      const assignments = Array.from(groupedAssignments.entries()).map(([_groupKey, items]) => {
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
      
      
      // Firebase 저장 데이터 준비 완료
      
      // Firebase 저장 실행
      
      const docRef = await addDoc(collection(db, 'applications'), applicationData);
      
      // Firebase 저장 성공
      
      // 즉시 캐시 업데이트를 위한 Application 객체 생성
      const newApplication = {
        id: docRef.id,
        ...applicationData,
        createdAt: new Date() as any, // Timestamp 대신 Date 사용
        updatedAt: new Date() as any,
      };

      // Firebase 실시간 구독이 자동으로 업데이트 처리 (Zustand Store)
      // dispatch 불필요 - onSnapshot이 자동으로 감지

      // 지원서 즉시 업데이트 완료

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
  
  const handleCancelApplicationClick = (postId: string) => {
    if (!currentUser) {
      showError(t('jobBoard.alerts.loginRequired'));
      return;
    }
    setCancelConfirmPostId(postId);
  };

  const handleCancelApplicationConfirm = async () => {
    if (!currentUser || !cancelConfirmPostId) return;

    setIsProcessing(cancelConfirmPostId);
    try {
      // eventId와 postId 모두 지원 (마이그레이션 호환성)
      const qEventId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('eventId', '==', cancelConfirmPostId));
      const qPostId = query(collection(db, 'applications'), where('applicantId', '==', currentUser.uid), where('postId', '==', cancelConfirmPostId));

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
        newMap.delete(cancelConfirmPostId);
        return newMap;
      });

      // 내 지원 현황 새로고침
      if (activeTab === 'myApplications') {
        fetchMyApplications();
      }

      setCancelConfirmPostId(null);
    } catch (error) {
      logger.error('Error cancelling application: ', error instanceof Error ? error : new Error(String(error)), { component: 'JobBoardPage' });
      showError(t('jobBoard.alerts.cancelFailed'));
    } finally {
      setIsProcessing(null);
    }
  };
  
  // 지원 모달에서 사전질문 모달로 돌아가기
  const handleBackToPreQuestions = () => {
    setIsApplyModalOpen(false);
    setIsPreQuestionModalOpen(true);
  };
  
  // 상세보기 모달 열기 - JobPosting 객체 또는 postId를 받아서 처리
  const handleOpenDetailModal = (postOrId: JobPosting | string) => {
    let fullJobPosting: JobPosting | null = null;

    if (typeof postOrId === 'string') {
      // postId가 전달된 경우, jobPostings 배열에서 완전한 데이터 찾기
      fullJobPosting = jobPostings.find(job => job.id === postOrId) || null;
      if (!fullJobPosting) {
        logger.warn('JobPosting not found for postId', { component: 'useJobBoard', value: postOrId });
        showError('구인공고 정보를 찾을 수 없습니다.');
        return;
      }
    } else {
      // JobPosting 객체가 전달된 경우
      fullJobPosting = postOrId;
    }

    setSelectedDetailPost(fullJobPosting);
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
    cancelConfirmPostId,
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
    preQuestionAnswers
  };
};