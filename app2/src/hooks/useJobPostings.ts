import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

import { buildFilteredQuery } from '../firebase';
import {
  JobPostingFilters,
  JobPosting,
  // TimeSlot,
  // RoleRequirement,
  // ConfirmedStaff,
  // JobPostingUtils
} from '../types/jobPosting';
import { withFirebaseErrorHandling } from '../utils/firebaseUtils';
import { normalizePostingType } from '../utils/jobPosting/jobPostingHelpers';

// Import types from centralized type definitions
// Re-export types for backward compatibility
export type { JobPostingFilters, JobPosting, ConfirmedStaff } from '../types/jobPosting';

export { JobPostingUtils } from '../types/jobPosting';

/**
 * 클라이언트 사이드 필터링 적용
 * Firebase 쿼리 제약으로 인해 서버에서 처리하지 못하는 필터를 클라이언트에서 적용
 *
 * @param jobs - 필터링할 JobPosting 배열
 * @param filters - 적용할 필터 조건
 * @returns 필터링된 JobPosting 배열
 */
const applyClientSideFilters = (jobs: JobPosting[], filters: JobPostingFilters): JobPosting[] => {
  // Normalize postingType for all jobs (레거시 데이터 호환성)
  let filteredJobs = jobs.map((job) => ({
    ...job,
    postingType: normalizePostingType(job),
  }));

  // postingType 필터 적용
  if (filters.postingType && filters.postingType !== 'all') {
    filteredJobs = filteredJobs.filter((job) => normalizePostingType(job) === filters.postingType);

    // 대회 공고는 승인된(approved) 것만 표시
    if (filters.postingType === 'tournament') {
      filteredJobs = filteredJobs.filter(
        (job) => job.tournamentConfig?.approvalStatus === 'approved'
      );
    }
  }

  // role 필터 적용
  if (filters.role && filters.role !== 'all') {
    filteredJobs = filteredJobs.filter((job) => {
      const requiredRoles = job.requiredRoles || [];
      return requiredRoles.includes(filters.role!);
    });
  }

  // location 필터 적용
  if (filters.location && filters.location !== 'all') {
    filteredJobs = filteredJobs.filter((job) => job.location === filters.location);
  }

  // type (recruitmentType) 필터 적용
  if (filters.type && filters.type !== 'all') {
    filteredJobs = filteredJobs.filter((job) => job.recruitmentType === filters.type);
  }

  return filteredJobs;
};

export const useJobPostings = (filters: JobPostingFilters) => {
  return useQuery({
    queryKey: ['jobPostings', filters],
    queryFn: async (): Promise<JobPosting[]> => {
      return withFirebaseErrorHandling(async () => {
        const query = buildFilteredQuery(filters);
        const snapshot = await getDocs(query);
        const jobs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as JobPosting[];

        // 클라이언트 사이드 필터링 적용
        return applyClientSideFilters(jobs, filters);
      }, 'fetchJobPostings');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

// Infinite scroll implementation
export const useInfiniteJobPostings = (filters: JobPostingFilters) => {
  return useInfiniteQuery<
    { jobs: JobPosting[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null },
    Error
  >({
    queryKey: ['jobPostings', 'infinite', filters],
    queryFn: async ({ pageParam }) => {
      const result = (await withFirebaseErrorHandling(async () => {
        const paginationOptions: {
          limit: number;
          startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
        } = {
          limit: 20,
        };

        if (pageParam) {
          paginationOptions.startAfterDoc = pageParam as QueryDocumentSnapshot<DocumentData>;
        }

        const query = buildFilteredQuery(filters, paginationOptions);
        const snapshot = await getDocs(query);

        const jobs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as JobPosting[];

        // 클라이언트 사이드 필터링 적용
        const filteredJobs = applyClientSideFilters(jobs, filters);

        // Return jobs and cursor for next page
        return {
          jobs: filteredJobs,
          nextCursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        };
      }, 'fetchInfiniteJobPostings')) as {
        jobs: JobPosting[];
        nextCursor: QueryDocumentSnapshot<DocumentData> | null;
      };
      // withFirebaseErrorHandling이 undefined를 반환할 수 있으므로 기본값 제공
      return result ?? { jobs: [], nextCursor: null };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage: {
      jobs: JobPosting[];
      nextCursor: QueryDocumentSnapshot<DocumentData> | null;
    }) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};
