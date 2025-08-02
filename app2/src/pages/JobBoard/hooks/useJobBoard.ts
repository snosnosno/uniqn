import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, serverTimestamp, addDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { db } from '../../../firebase';
import { useInfiniteJobPostings } from '../../../hooks/useJobPostings';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { logger } from '../../../utils/logger';
import { JobPosting, PreQuestionAnswer } from '../../../types/jobPosting';

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
  
  // 내 지원 현황 데이터
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingMyApplications, setLoadingMyApplications] = useState(false);
  
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
    return result;
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
      const applicationsQuery = query(
        collection(db, 'applications'), 
        where('applicantId', '==', currentUser.uid)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);
      
      const applicationsData = await Promise.all(
        applicationsSnapshot.docs.map(async (applicationDoc) => {
          const applicationData = applicationDoc.data();
          
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