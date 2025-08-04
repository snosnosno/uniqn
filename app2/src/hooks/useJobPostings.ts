import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { logger } from '../utils/logger';
import { getDocs, DocumentSnapshot } from 'firebase/firestore';

import { buildFilteredQuery } from '../firebase';
import {
  JobPostingFilters,
  JobPosting
  // TimeSlot,
  // RoleRequirement,
  // ConfirmedStaff,
  // JobPostingUtils
} from '../types/jobPosting';
import { withFirebaseErrorHandling } from '../utils/firebaseUtils';

// Import types from centralized type definitions
// Re-export types for backward compatibility
export type {
  JobPostingFilters,
  JobPosting,
  ConfirmedStaff
} from '../types/jobPosting';

export {
  JobPostingUtils
} from '../types/jobPosting';

export const useJobPostings = (filters: JobPostingFilters) => {
  return useQuery({
    queryKey: ['jobPostings', filters],
    queryFn: async (): Promise<JobPosting[]> => {
      return withFirebaseErrorHandling(async () => {
        const query = buildFilteredQuery(filters);
        const snapshot = await getDocs(query);
        let jobs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as JobPosting[];
        
        // Client-side filtering for cases where Firebase query constraints are limited
        if (filters.startDate && filters.role && filters.role !== 'all') {
          logger.debug('🔍 Applying client-side role filter:', { component: 'useJobPostings', data: filters.role });
          jobs = jobs.filter(job => {
            const requiredRoles = job.requiredRoles || [];
            return requiredRoles.includes(filters.role!);
          });
        }
        
        // Client-side location filtering when role filter took priority
        if (filters.startDate && filters.role && filters.role !== 'all' && filters.location && filters.location !== 'all') {
          logger.debug('🔍 Applying client-side location filter:', { component: 'useJobPostings', data: filters.location });
          jobs = jobs.filter(job => job.location === filters.location);
        }
        
        // Client-side type filtering when role filter took priority  
        if (filters.startDate && filters.role && filters.role !== 'all' && filters.type && filters.type !== 'all') {
          logger.debug('🔍 Applying client-side type filter:', { component: 'useJobPostings', data: filters.type });
          jobs = jobs.filter(job => job.recruitmentType === filters.type);
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
  return useInfiniteQuery<{ jobs: JobPosting[]; nextCursor: any | null }, Error>({
    queryKey: ['jobPostings', 'infinite', filters],
    queryFn: async ({ pageParam }) => {
      return withFirebaseErrorHandling(async () => {
        logger.debug('🔍 useInfiniteJobPostings queryFn called with:', { component: 'useJobPostings', data: { filters, pageParam } });
        
        const paginationOptions: {
          limit: number;
          startAfterDoc?: DocumentSnapshot;
        } = {
          limit: 20
        };
        
        if (pageParam) {
          paginationOptions.startAfterDoc = pageParam as DocumentSnapshot;
        }
        
        const query = buildFilteredQuery(filters, paginationOptions);
        
        logger.debug('📋 Executing Firebase query...', { component: 'useJobPostings' });
        const snapshot = await getDocs(query);
        
        let jobs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as JobPosting[];
        
        // Client-side filtering for cases where Firebase query constraints are limited
        // This happens when we have date + role filters (Firebase doesn't allow inequality + array-contains)
        if (filters.startDate && filters.role && filters.role !== 'all') {
          logger.debug('🔍 Applying client-side role filter:', { component: 'useJobPostings', data: filters.role });
          jobs = jobs.filter(job => {
            const requiredRoles = job.requiredRoles || [];
            return requiredRoles.includes(filters.role!);
          });
        }
        
        // Client-side location filtering when role filter took priority
        if (filters.startDate && filters.role && filters.role !== 'all' && filters.location && filters.location !== 'all') {
          logger.debug('🔍 Applying client-side location filter:', { component: 'useJobPostings', data: filters.location });
          jobs = jobs.filter(job => job.location === filters.location);
        }
        
        // Client-side type filtering when role filter took priority  
        if (filters.startDate && filters.role && filters.role !== 'all' && filters.type && filters.type !== 'all') {
          logger.debug('🔍 Applying client-side type filter:', { component: 'useJobPostings', data: filters.type });
          jobs = jobs.filter(job => job.recruitmentType === filters.type);
        }
        
        logger.debug('✅ Query successful:', { component: 'useJobPostings', data: { 
          originalCount: snapshot.docs.length, 
          filteredCount: jobs.length, 
          hasNextPage: snapshot.docs.length >= 20 
        } });
        
        // Return jobs and cursor for next page
        return {
          jobs,
          nextCursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        };
      }, 'fetchInfiniteJobPostings');
    },
    initialPageParam: null,
    getNextPageParam: (lastPage: { jobs: JobPosting[]; nextCursor: any | null }) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};