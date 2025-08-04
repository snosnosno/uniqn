import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useJobPostingStore } from '../stores/jobPostingStore';
import { useAuth } from './AuthContext';

// 기존 컨텍스트 타입 유지
interface JobPostingContextType {
  jobPosting: any | null;
  loading: boolean;
  error: string | null;
  refreshJobPosting: () => Promise<void>;
  applicants: any[];
  staff: any[];
  refreshApplicants: () => Promise<void>;
  refreshStaff: () => Promise<void>;
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
  
  // jobPostingId 변경 시 store 업데이트
  useEffect(() => {
    store.setJobPostingId(jobPostingId);
    
    return () => {
      store.cleanup();
    };
  }, [jobPostingId]); // store는 의존성에서 제외 (stable reference)
  
  // 지원자와 스태프 데이터 구독
  useEffect(() => {
    if (jobPostingId && currentUser) {
      store.refreshApplicants();
      store.refreshStaff();
    }
  }, [jobPostingId, currentUser]); // store는 의존성에서 제외
  
  const value: JobPostingContextType = {
    jobPosting: store.jobPosting,
    loading: store.loading,
    error: store.error,
    refreshJobPosting: store.refreshJobPosting,
    applicants: store.applicants,
    staff: store.staff,
    refreshApplicants: store.refreshApplicants,
    refreshStaff: store.refreshStaff,
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