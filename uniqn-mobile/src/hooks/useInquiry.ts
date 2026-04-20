/**
 * UNIQN Mobile - Inquiry Hooks
 *
 * @description 문의 관련 커스텀 훅 (TanStack Query)
 * @version 1.1.0
 */

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { requireAuth } from '@/errors/guardErrors';
import { ValidationError, ERROR_CODES } from '@/errors/AppError';
import { useToastStore } from '@/stores/toastStore';
import { queryKeys, cachingPolicies } from '@/lib/queryClient';
import {
  fetchMyInquiries,
  fetchAllInquiries,
  getInquiry,
  createInquiry,
  respondToInquiry,
  updateInquiryStatus,
  getUnansweredCount,
  attachFilesToInquiry,
  deleteMyInquiry,
  getInquiryAttachmentSignedUrl,
} from '@/services/inquiryService';
import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
  InquiryCategory,
  LocalInquiryAttachment,
} from '@/types';
import { FAQ_DATA, filterFAQByCategory } from '@/types/inquiry';
import type { InquiryPaginationCursor } from '@/repositories';
import { stableFilters } from '@/utils/queryUtils';
import { buildCurrentUserIdentitySnapshot } from '@/shared/profile/identity';

// ============================================================================
// Query Keys - 중앙 관리 (queryClient.ts)에서 import
// ============================================================================

// ============================================================================
// 내 문의 목록 (사용자)
// ============================================================================

interface UseMyInquiriesOptions {
  enabled?: boolean;
  pageSize?: number;
}

export function useMyInquiries(options: UseMyInquiriesOptions = {}) {
  const { enabled = true, pageSize = 20 } = options;
  const user = useAuthStore((state) => state.user);
  const [additionalInquiries, setAdditionalInquiries] = useState<Inquiry[]>([]);
  const [lastDoc, setLastDoc] = useState<InquiryPaginationCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const query = useQuery({
    queryKey: [...queryKeys.inquiries.mine(), user?.uid],
    queryFn: async () => {
      if (!user?.uid) return { inquiries: [], lastDoc: null, hasMore: false };
      const result = await fetchMyInquiries({ userId: user.uid, pageSize });
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      setAdditionalInquiries([]);
      return result;
    },
    enabled: enabled && !!user?.uid,
    staleTime: cachingPolicies.realtime,
  });

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || !user?.uid || !lastDoc || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    try {
      const result = await fetchMyInquiries({
        userId: user.uid,
        pageSize,
        lastDoc,
      });

      setAdditionalInquiries((prev) => [...prev, ...result.inquiries]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [hasMore, user?.uid, lastDoc, pageSize, isFetchingNextPage]);

  const allInquiries = [...(query.data?.inquiries || []), ...additionalInquiries];

  return {
    inquiries: allInquiries,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasMore,
    fetchNextPage,
    refetch: query.refetch,
  };
}

// ============================================================================
// 전체 문의 목록 (관리자)
// ============================================================================

interface UseAllInquiriesOptions {
  enabled?: boolean;
  pageSize?: number;
  filters?: InquiryFilters;
}

export function useAllInquiries(options: UseAllInquiriesOptions = {}) {
  const { enabled = true, pageSize = 20, filters } = options;
  const [allInquiries, setAllInquiries] = useState<Inquiry[]>([]);
  const [lastDoc, setLastDoc] = useState<InquiryPaginationCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const query = useQuery({
    queryKey: queryKeys.inquiries.adminList(stableFilters(filters)),
    queryFn: async () => {
      const result = await fetchAllInquiries({ filters, pageSize });
      setAllInquiries(result.inquiries);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      return result;
    },
    enabled,
    staleTime: cachingPolicies.frequent, // 5분
  });

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || !lastDoc) return;

    const result = await fetchAllInquiries({
      filters,
      pageSize,
      lastDoc,
    });

    setAllInquiries((prev) => [...prev, ...result.inquiries]);
    setLastDoc(result.lastDoc);
    setHasMore(result.hasMore);
  }, [hasMore, lastDoc, filters, pageSize]);

  return {
    inquiries: allInquiries,
    isLoading: query.isLoading,
    isRefreshing: query.isRefetching,
    isError: query.isError,
    error: query.error,
    hasMore,
    fetchNextPage,
    refetch: query.refetch,
  };
}

// ============================================================================
// 문의 상세 조회
// ============================================================================

export function useInquiryDetail(inquiryId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inquiries.detail(inquiryId || ''),
    queryFn: () => getInquiry(inquiryId!),
    enabled: !!inquiryId,
    staleTime: cachingPolicies.standard, // 5분
  });
}

// ============================================================================
// 문의 생성 (사용자)
// ============================================================================

/**
 * 문의 생성 mutation
 *
 * @param options.silent true면 success/error toast 표시 안 함.
 *   첨부파일 오케스트레이션처럼 호출 측에서 최종 성공 시점을 판단할 때 사용.
 */
export function useCreateInquiry(options: { silent?: boolean } = {}) {
  const { silent = false } = options;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (input: CreateInquiryInput) => {
      requireAuth(user?.uid, 'useInquiry.createInquiry');
      if (!user?.email) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          field: 'email',
          userMessage: '이메일 정보가 필요합니다',
        });
      }
      const identity = buildCurrentUserIdentitySnapshot({
        profile,
        authUser: user,
        fallbackName: '사용자',
      });

      const userName = profile?.name || user.displayName || '사용자';

      return createInquiry(user.uid, user.email, identity.preferredName || userName, input);
    },
    onSuccess: () => {
      // user.uid를 포함한 쿼리 키로 invalidate
      queryClient.invalidateQueries({ queryKey: [...queryKeys.inquiries.mine(), user?.uid] });
      if (!silent) addToast({ type: 'success', message: '문의가 접수되었습니다' });
    },
    onError: () => {
      if (!silent) addToast({ type: 'error', message: '문의 접수에 실패했습니다' });
    },
  });
}

// ============================================================================
// 첨부파일 추가 (사용자)
// ============================================================================

interface AttachInquiryFilesParams {
  inquiryId: string;
  files: LocalInquiryAttachment[];
}

/**
 * 첨부파일 업로드 mutation. 실패 시 Repository/Service가 Storage 롤백 처리.
 * 문의 자체의 롤백(DELETE)은 호출 측에서 useDeleteMyInquiry로 처리.
 */
export function useAttachInquiryFiles() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({ inquiryId, files }: AttachInquiryFilesParams) => {
      requireAuth(user?.uid, 'useInquiry.attachInquiryFiles');
      return attachFilesToInquiry(user.uid, inquiryId, files);
    },
    onSuccess: (_, { inquiryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.detail(inquiryId) });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.inquiries.mine(), user?.uid] });
    },
  });
}

// ============================================================================
// 문의 삭제 (사용자 본인, status=open)
// ============================================================================

/**
 * 문의 삭제 mutation. 전체 롤백 또는 사용자 명시적 철회에 사용.
 * Storage 첨부 정리까지 best-effort로 수행.
 */
export function useDeleteMyInquiry() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (inquiryId: string) => {
      requireAuth(user?.uid, 'useInquiry.deleteMyInquiry');
      return deleteMyInquiry(user.uid, inquiryId);
    },
    onSuccess: (_, inquiryId) => {
      queryClient.removeQueries({ queryKey: queryKeys.inquiries.detail(inquiryId) });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.inquiries.mine(), user?.uid] });
    },
  });
}

// ============================================================================
// 첨부 이미지 signed URL (조회)
// ============================================================================

/**
 * Storage path로 signed URL 조회. 1시간 TTL, 50분 staleTime으로 자동 갱신.
 */
export function useInquiryAttachmentUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['inquiry-attachment-url', path],
    queryFn: () => getInquiryAttachmentSignedUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 50, // 50분 (TTL 1시간 - 10분 여유)
  });
}

// ============================================================================
// 문의 응답 (관리자)
// ============================================================================

interface RespondInquiryParams {
  inquiryId: string;
  input: RespondInquiryInput;
}

export function useRespondInquiry() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async ({ inquiryId, input }: RespondInquiryParams) => {
      requireAuth(user?.uid, 'useInquiry.respondToInquiry');
      const identity = buildCurrentUserIdentitySnapshot({
        profile,
        authUser: user,
        fallbackName: '관리자',
      });

      const responderName = profile?.name || user.displayName || '관리자';

      return respondToInquiry(inquiryId, user.uid, identity.preferredName || responderName, input);
    },
    onSuccess: (_, { inquiryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.detail(inquiryId) });
      addToast({ type: 'success', message: '답변이 등록되었습니다' });
    },
    onError: () => {
      addToast({ type: 'error', message: '답변 등록에 실패했습니다' });
    },
  });
}

// ============================================================================
// 문의 상태 변경 (관리자)
// ============================================================================

interface UpdateStatusParams {
  inquiryId: string;
  status: InquiryStatus;
}

export function useUpdateInquiryStatus() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  return useMutation({
    mutationFn: async ({ inquiryId, status }: UpdateStatusParams) => {
      return updateInquiryStatus(inquiryId, status);
    },
    onSuccess: (_, { inquiryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.detail(inquiryId) });
      addToast({ type: 'success', message: '상태가 변경되었습니다' });
    },
    onError: () => {
      addToast({ type: 'error', message: '상태 변경에 실패했습니다' });
    },
  });
}

// ============================================================================
// 미답변 문의 수 (관리자)
// ============================================================================

export function useUnansweredCount() {
  return useQuery({
    queryKey: queryKeys.inquiries.unansweredCount(),
    queryFn: getUnansweredCount,
    staleTime: cachingPolicies.standard, // 5분
  });
}

// ============================================================================
// FAQ
// ============================================================================

interface UseFAQOptions {
  category?: InquiryCategory | 'all';
}

export function useFAQ(options: UseFAQOptions = {}) {
  const { category = 'all' } = options;

  return useQuery({
    queryKey: queryKeys.inquiries.faq(category),
    queryFn: () => {
      // 하드코딩된 FAQ 데이터 사용
      return filterFAQByCategory(FAQ_DATA, category);
    },
    staleTime: cachingPolicies.stable, // 60분
    gcTime: 60 * 60 * 1000, // 1시간
  });
}
