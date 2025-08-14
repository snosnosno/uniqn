import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useJobPostingStore } from '../stores/jobPostingStore';
import { useAuth } from './AuthContext';
import { useJobPostingWorkLogs } from '../hooks/useUnifiedWorkLogs';
import { UnifiedWorkLog } from '../types/unified/workLog';

// 기존 컨텍스트 타입 유지 + workLogs 추가
interface JobPostingContextType {
  jobPosting: any | null;
  loading: boolean;
  error: string | null;
  refreshJobPosting: () => Promise<void>;
  applicants: any[];
  staff: any[];
  refreshApplicants: () => Promise<void>;
  refreshStaff: () => Promise<void>;
  // WorkLogs 관련 추가
  workLogs: UnifiedWorkLog[];
  workLogsLoading: boolean;
  workLogsError: Error | null;
}

const JobPostingContext = createContext<JobPostingContextType | undefined>(undefined);

interface JobPostingProviderProps {
  children: ReactNode;
  jobPostingId: string;
}

// Zustand store를 Context API로 감싸는 어댑터
export const JobPostingProvider: React.FC<JobPostingProviderProps> = ({ children, jobPostingId }) => {
  const { currentUser } = useAuth();
  const store = useJobPostingStore();
  
  // WorkLogs를 한 곳에서만 구독
  const { 
    workLogs, 
    loading: workLogsLoading, 
    error: workLogsError 
  } = useJobPostingWorkLogs(jobPostingId);
  
  // jobPostingId 변경 시 store 업데이트
  useEffect(() => {
    store.setJobPostingId(jobPostingId);
  }, [jobPostingId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // 컴포넌트 언마운트 시에만 cleanup 호출
  useEffect(() => {
    return () => {
      store.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열로 언마운트 시에만 실행
  
  // 지원자와 스태프 데이터 구독
  useEffect(() => {
    if (jobPostingId && currentUser) {
      store.refreshApplicants();
      store.refreshStaff();
    }
  }, [jobPostingId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const value: JobPostingContextType = {
    jobPosting: store.jobPosting,
    loading: store.loading,
    error: store.error,
    refreshJobPosting: store.refreshJobPosting,
    applicants: store.applicants,
    staff: store.staff,
    refreshApplicants: store.refreshApplicants,
    refreshStaff: store.refreshStaff,
    // WorkLogs 데이터 추가
    workLogs: workLogs || [],
    workLogsLoading: workLogsLoading || false,
    workLogsError: workLogsError || null,
  };
  
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