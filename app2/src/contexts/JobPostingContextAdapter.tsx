import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useJobPostingStore } from '../stores/jobPostingStore';
import { useAuth } from './AuthContext';
import { useUnifiedWorkLogs } from '../hooks/useUnifiedWorkLogs';
import { UnifiedWorkLog } from '../types/unified/workLog';

// 기존 컨텍스트 타입 유지 + workLogs 추가
interface JobPostingContextType {
  jobPosting: unknown | null;
  loading: boolean;
  error: string | null;
  refreshJobPosting: () => Promise<void>;
  applicants: unknown[];
  staff: unknown[];
  refreshApplicants: () => Promise<void>;
  refreshStaff: () => void;
  // WorkLogs 관련 추가
  workLogs: UnifiedWorkLog[];
  workLogsLoading: boolean;
  workLogsError: Error | null;
  refreshWorkLogs: () => void;
}

const JobPostingContext = createContext<JobPostingContextType | undefined>(undefined);

interface JobPostingProviderProps {
  children: ReactNode;
  eventId: string;
}

// Zustand store를 Context API로 감싸는 어댑터
export const JobPostingProvider: React.FC<JobPostingProviderProps> = ({ children, eventId }) => {
  const { currentUser } = useAuth();
  const { setEventId, cleanup, refreshApplicants, refreshStaff, jobPosting, loading, error, applicants, staff } = useJobPostingStore();

  // WorkLogs를 한 곳에서만 구독 - useUnifiedWorkLogs 사용
  const {
    workLogs,
    loading: workLogsLoading,
    error: workLogsError,
    refetch: refreshWorkLogs
  } = useUnifiedWorkLogs({
    filter: { eventId: eventId },
    realtime: true,  // 실시간 동기화 활성화
    autoNormalize: true
  });

  // eventId 변경 시 store 업데이트
  useEffect(() => {
    setEventId(eventId);
  }, [eventId, setEventId]);

  // 컴포넌트 언마운트 시에만 cleanup 호출
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 지원자와 스태프 데이터 구독
  useEffect(() => {
    if (eventId && currentUser) {
      refreshApplicants();
      refreshStaff();
    }
  }, [eventId, currentUser, refreshApplicants, refreshStaff]);

  const value: JobPostingContextType = React.useMemo(() => ({
    jobPosting,
    loading,
    error,
    refreshJobPosting: useJobPostingStore.getState().refreshJobPosting,
    applicants,
    staff,
    refreshApplicants,
    refreshStaff: () => {
      // 스태프 데이터와 WorkLogs 데이터를 함께 새로고침
      refreshStaff();
      refreshWorkLogs();
    },
    // WorkLogs 데이터 추가
    workLogs: workLogs || [],
    workLogsLoading: workLogsLoading || false,
    workLogsError: workLogsError || null,
    refreshWorkLogs,
  }), [jobPosting, loading, error, applicants, staff, refreshApplicants, refreshStaff, workLogs, workLogsLoading, workLogsError, refreshWorkLogs]);

  return (
    <JobPostingContext.Provider value={value}>
      {children}
    </JobPostingContext.Provider>
  );
};

// 기존 컨텍스트 hook 유지 (하위 호환성)
export const useJobPostingContext = () => {
  const context = useContext(JobPostingContext);
  if (context === undefined) {
    throw new Error('useJobPostingContext must be used within a JobPostingProvider');
  }
  return context;
};