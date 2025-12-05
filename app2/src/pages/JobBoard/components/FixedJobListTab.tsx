import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useFixedJobPostings } from '@/hooks/useFixedJobPostings';
import { FixedJobCard } from '@/components/jobPosting/FixedJobCard';
import { FixedJobPosting } from '@/types/jobPosting/jobPosting';
import JobPostingSkeleton from '@/components/JobPostingSkeleton';
import JobDetailModal from './JobDetailModal';
import FixedApplyModal from './FixedApplyModal';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { doc, getDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { handleFirebaseError, FirebaseError } from '@/utils/firebaseErrors';
import { db } from '@/firebase';
import { useUnifiedData } from '@/hooks/useUnifiedData';

/**
 * 고정공고 목록 탭 컴포넌트
 *
 * 무한 스크롤 지원, 다크모드 완전 적용
 */
const FixedJobListTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning } = useToast();
  const { postings, loading, error, hasMore, loadMore } = useFixedJobPostings();
  const { applications } = useUnifiedData();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 모달 상태 관리
  const [selectedPosting, setSelectedPosting] = useState<FixedJobPosting | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<Map<string, string>>(new Map());

  // 지원한 고정공고 상태 계산
  const appliedJobsMap = useMemo(() => {
    if (!currentUser || !postings || postings.length === 0) {
      return new Map<string, string>();
    }

    const postIds = postings.map((p) => p.id);
    const userApplications = applications.filter(
      (app) =>
        app.applicantId === currentUser.uid &&
        (app.recruitmentType === 'fixed' || postIds.includes(app.eventId || app.postId || ''))
    );

    const appliedMap = new Map<string, string>();
    userApplications.forEach((app) => {
      const jobId = app.eventId || app.postId;
      if (jobId && postIds.includes(jobId)) {
        appliedMap.set(jobId, app.status);
      }
    });

    return appliedMap;
  }, [currentUser, postings, applications]);

  // 로컬 상태와 서버 상태 병합
  const mergedAppliedJobs = useMemo(() => {
    const merged = new Map(appliedJobsMap);
    appliedJobs.forEach((status, id) => {
      merged.set(id, status);
    });
    return merged;
  }, [appliedJobsMap, appliedJobs]);

  // 지원하기 핸들러 (메모이제이션)
  const handleApply = useCallback((posting: FixedJobPosting) => {
    logger.info('FixedJobListTab: 지원하기 클릭', {
      postingId: posting.id,
      component: 'FixedJobListTab',
    });
    setSelectedPosting(posting);
    setIsApplyModalOpen(true);
    setSelectedRoles([]);
  }, []);

  // 상세보기 핸들러 (메모이제이션) - 모달 열기
  const handleViewDetail = useCallback(
    (postingId: string) => {
      logger.info('FixedJobListTab: 상세보기 클릭', {
        postingId,
        component: 'FixedJobListTab',
      });
      const posting = postings.find((p) => p.id === postingId);
      if (posting) {
        setSelectedPosting(posting);
        setIsDetailModalOpen(true);
      }
    },
    [postings]
  );

  // 역할 변경 핸들러
  const handleRoleChange = useCallback((role: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedRoles((prev) => [...prev, role]);
    } else {
      setSelectedRoles((prev) => prev.filter((r) => r !== role));
    }
  }, []);

  // 지원 제출 핸들러
  const handleSubmitApplication = useCallback(async () => {
    if (!currentUser) {
      showError(t('jobBoard.alerts.loginRequired'));
      return;
    }
    if (!selectedPosting || selectedRoles.length === 0) {
      showWarning(t('toast.application.selectAtLeastOneRole'));
      return;
    }

    setIsProcessing(true);
    try {
      const staffDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!staffDoc.exists()) {
        showError(t('jobBoard.alerts.profileNotFound'));
        return;
      }

      const staffData = staffDoc.data();
      const now = Timestamp.now();

      // 고정공고용 지원서 데이터 구성
      const applicationData = {
        applicantId: currentUser.uid,
        applicantName:
          staffData.name || staffData.displayName || currentUser.displayName || '이름 없음',
        applicantEmail: currentUser.email || staffData.email || '',
        applicantPhone: staffData.phone || '',
        eventId: selectedPosting.id,
        postId: selectedPosting.id,
        postTitle: selectedPosting.title,
        selectedRoles: selectedRoles,
        assignments: [], // 고정공고는 날짜 기반 assignments가 없음
        status: 'pending',
        appliedAt: now,
        createdAt: now,
        updatedAt: now,
        recruitmentType: 'fixed',
        fixedData: selectedPosting.fixedData || null,
      };

      await addDoc(collection(db, 'applications'), applicationData);

      // 지원 성공 시 로컬 상태 즉시 업데이트
      setAppliedJobs((prev) => new Map(prev).set(selectedPosting.id, 'pending'));

      showSuccess(t('jobBoard.alerts.applicationSubmitted'));
      setIsApplyModalOpen(false);
      setSelectedPosting(null);
      setSelectedRoles([]);
    } catch (err) {
      // 🛡️ 통합 Firebase 에러 처리
      const errorMessage = handleFirebaseError(err as FirebaseError, {
        operation: 'submitFixedApplication',
        postingId: selectedPosting.id,
        userId: currentUser.uid,
      });
      logger.error('지원 제출 오류', err as Error, {
        component: 'FixedJobListTab',
        data: { postingId: selectedPosting.id },
      });
      showError(errorMessage || t('toast.application.submitError'));
    } finally {
      setIsProcessing(false);
    }
  }, [currentUser, selectedPosting, selectedRoles, t, showError, showWarning, showSuccess]);

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
      { threshold: 0.1 }
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
    // 🌐 i18n: 에러 메시지 국제화
    const getErrorMessage = () => {
      if (error.message?.includes('index') || error.message?.includes('Index')) {
        return t(
          'error.firebase.indexRequired',
          'Firebase 인덱스 설정이 필요합니다. 관리자에게 문의하세요.'
        );
      }
      if (error.message?.includes('permission')) {
        return t(
          'error.firebase.permissionDenied',
          '권한이 없습니다. 로그인 상태를 확인해 주세요.'
        );
      }
      if (error.message?.includes('network')) {
        return t('error.firebase.networkError', '네트워크 연결을 확인해 주세요.');
      }
      return t(
        'error.firebase.loadingError',
        '데이터를 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.'
      );
    };

    return (
      <div className="container mx-auto p-4">
        <div
          className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex">
            <div className="py-1">
              <svg
                className="fill-current h-6 w-6 text-red-500 dark:text-red-400 mr-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">{t('error.dataLoading', '데이터 로딩 오류')}</p>
              <p className="text-sm">{getErrorMessage()}</p>
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                  {t('error.technicalDetails', '기술적 세부사항')}
                </summary>
                <pre className="text-xs mt-1 bg-red-50 dark:bg-red-900/10 p-2 rounded overflow-auto">
                  {error.message || t('error.unknown', 'Unknown error')}
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
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('jobBoard.fixed.noPostings', '현재 모집 중인 고정공고가 없습니다')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('jobBoard.fixed.noPostingsHint', '새로운 고정공고가 등록되면 여기에 표시됩니다.')}
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
            appliedStatus={mergedAppliedJobs.get(posting.id)}
          />
        ))}
      </div>

      {/* 무한 스크롤 트리거 요소 */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="h-20 flex items-center justify-center mt-8"
          aria-label={t('jobBoard.infiniteScroll.triggerArea', '더 보기 영역')}
        >
          {loading ? (
            <span className="text-gray-500 dark:text-gray-400" aria-live="polite">
              {t('common.loading', '로딩 중...')}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">
              {t('jobBoard.infiniteScroll.scrollToLoad', '스크롤하여 더 보기')}
            </span>
          )}
        </div>
      )}

      {/* 모든 공고 확인 메시지 */}
      {!hasMore && postings.length > 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 mt-8" aria-live="polite">
          {t('jobBoard.infiniteScroll.allLoaded', '모든 공고를 확인했습니다.')}
        </p>
      )}

      {/* 상세보기 모달 */}
      <JobDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPosting(null);
        }}
        jobPosting={selectedPosting}
      />

      {/* 고정공고 지원하기 모달 */}
      {selectedPosting && (
        <FixedApplyModal
          isOpen={isApplyModalOpen}
          onClose={() => {
            setIsApplyModalOpen(false);
            setSelectedPosting(null);
            setSelectedRoles([]);
          }}
          posting={selectedPosting}
          selectedRoles={selectedRoles}
          onRoleChange={handleRoleChange}
          onApply={handleSubmitApplication}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default FixedJobListTab;
