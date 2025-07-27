import { doc, getDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { db } from '../firebase';
import { JobPosting } from '../types/jobPosting';

import { useAuth } from './AuthContext';

interface JobPostingContextType {
  jobPosting: JobPosting | null;
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

export const JobPostingProvider: React.FC<JobPostingProviderProps> = ({ children, jobPostingId }) => {
  const { currentUser } = useAuth();
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // 공고 데이터 실시간 업데이트
  useEffect(() => {
    if (!jobPostingId) {
      setLoading(false);
      return;
    }

    const jobPostingRef = doc(db, 'jobPostings', jobPostingId);
    const unsubscribe = onSnapshot(
      jobPostingRef,
      (doc) => {
        if (doc.exists()) {
          setJobPosting({ id: doc.id, ...doc.data() } as JobPosting);
          setError(null);
        } else {
          setError('공고를 찾을 수 없습니다.');
        }
        setLoading(false);
      },
      (error) => {
        console.error('공고 데이터 로딩 오류:', error);
        setError('공고 데이터를 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [jobPostingId]);

  // 지원자 데이터 실시간 업데이트
  useEffect(() => {
    if (!jobPostingId || !currentUser) return;

    const applicantsQuery = query(
      collection(db, 'applications'),
      where('postId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      applicantsQuery,
      (snapshot) => {
        const applicantList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setApplicants(applicantList);
      },
      (error) => {
        console.error('지원자 데이터 로딩 오류:', error);
      }
    );

    return () => unsubscribe();
  }, [jobPostingId, currentUser]);

  // 스태프 데이터 실시간 업데이트
  useEffect(() => {
    if (!jobPostingId || !currentUser) return;

    const staffQuery = query(
      collection(db, 'staff'),
      where('postingId', '==', jobPostingId),
      where('managerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      staffQuery,
      (snapshot) => {
        const staffList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStaff(staffList);
      },
      (error) => {
        console.error('스태프 데이터 로딩 오류:', error);
      }
    );

    return () => unsubscribe();
  }, [jobPostingId, currentUser]);

  // 공고 데이터 새로고침
  const refreshJobPosting = async (): Promise<void> => {
    if (!jobPostingId) return;

    try {
      setLoading(true);
      const jobPostingRef = doc(db, 'jobPostings', jobPostingId);
      const docSnap = await getDoc(jobPostingRef);
      
      if (docSnap.exists()) {
        setJobPosting({ id: docSnap.id, ...docSnap.data() } as JobPosting);
        setError(null);
      } else {
        setError('공고를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('공고 새로고침 오류:', error);
      setError('공고 데이터를 새로고침하는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 지원자 데이터 새로고침
  const refreshApplicants = async (): Promise<void> => {
    // 실시간 업데이트로 인해 별도 새로고침 불필요
    // 필요시 추가 구현
  };

  // 스태프 데이터 새로고침
  const refreshStaff = async (): Promise<void> => {
    // 실시간 업데이트로 인해 별도 새로고침 불필요
    // 필요시 추가 구현
  };

  const value: JobPostingContextType = {
    jobPosting,
    loading,
    error,
    refreshJobPosting,
    applicants,
    staff,
    refreshApplicants,
    refreshStaff
  };

  return (
    <JobPostingContext.Provider value={value}>
      {children}
    </JobPostingContext.Provider>
  );
};

export const useJobPostingContext = () => {
  const context = useContext(JobPostingContext);
  if (!context) {
    throw new Error('useJobPostingContext must be used within a JobPostingProvider');
  }
  return context;
};

export default JobPostingContext;