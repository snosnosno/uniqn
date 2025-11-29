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

export const useJobPostings = (filters: JobPostingFilters) => {
  return useQuery({
    queryKey: ['jobPostings', filters],
    queryFn: async (): Promise<JobPosting[]> => {
      return withFirebaseErrorHandling(async () => {
        const query = buildFilteredQuery(filters);
        const snapshot = await getDocs(query);
        let jobs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as JobPosting[];

        // Client-side filtering for cases where Firebase query constraints are limited

        // Normalize postingType for all jobs (레거시 데이터 호환성)
        jobs = jobs.map((job) => ({
          ...job,
          postingType: normalizePostingType(job),
        }));

        // postingType 필터 적용
        if (filters.postingType && filters.postingType !== 'all') {
          jobs = jobs.filter((job) => normalizePostingType(job) === filters.postingType);
        }

        if (filters.startDate && filters.role && filters.role !== 'all') {
          jobs = jobs.filter((job) => {
            const requiredRoles = job.requiredRoles || [];
            return requiredRoles.includes(filters.role!);
          });
        }

        if (
          filters.startDate &&
          filters.role &&
          filters.role !== 'all' &&
          filters.location &&
          filters.location !== 'all'
        ) {
          jobs = jobs.filter((job) => job.location === filters.location);
        }

        if (
          filters.startDate &&
          filters.role &&
          filters.role !== 'all' &&
          filters.type &&
          filters.type !== 'all'
        ) {
          jobs = jobs.filter((job) => job.recruitmentType === filters.type);
        }

        return jobs;
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

        let jobs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as JobPosting[];

        // Client-side filtering for cases where Firebase query constraints are limited

        // Normalize postingType for all jobs (레거시 데이터 호환성)
        jobs = jobs.map((job) => ({
          ...job,
          postingType: normalizePostingType(job),
        }));

        // postingType 필터 적용
        if (filters.postingType && filters.postingType !== 'all') {
          jobs = jobs.filter((job) => normalizePostingType(job) === filters.postingType);
        }

        if (filters.startDate && filters.role && filters.role !== 'all') {
          jobs = jobs.filter((job) => {
            const requiredRoles = job.requiredRoles || [];
            return requiredRoles.includes(filters.role!);
          });
        }

        if (
          filters.startDate &&
          filters.role &&
          filters.role !== 'all' &&
          filters.location &&
          filters.location !== 'all'
        ) {
          jobs = jobs.filter((job) => job.location === filters.location);
        }

        if (
          filters.startDate &&
          filters.role &&
          filters.role !== 'all' &&
          filters.type &&
          filters.type !== 'all'
        ) {
          jobs = jobs.filter((job) => job.recruitmentType === filters.type);
        }

        // Return jobs and cursor for next page
        return {
          jobs,
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
