/**
 * UNIQN Mobile - 공유 기능 훅
 *
 * @description 공고 및 콘텐츠 공유 기능 제공
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Share, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { trackEvent, createJobDeepLink } from '@/services/observability';
import { useToast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { getJobDetailQueryOptions } from '@/hooks/useJobDetail';
import { extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
import { jobPostingRepository } from '@/repositories';
import { buildJobShareText } from '@/utils/jobShareMessage';
import type { JobPosting } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ShareResult {
  success: boolean;
  action?: 'shared' | 'dismissed';
  error?: Error;
}

export interface UseShareReturn {
  /** 공고 공유 (근무 일정·역할·인원·급여 포함 본문 생성) */
  shareJob: (job: JobPosting) => Promise<ShareResult>;
  /**
   * 공고 ID 로 공유 — 완전한 JobPosting 을 보유하지 않은 화면(리스트 카드 등)에서
   * id 로 상세를 조회한 뒤 shareJob 과 동일한 본문을 생성한다.
   */
  shareJobById: (jobId: string) => Promise<ShareResult>;
  /** 일반 콘텐츠 공유 */
  share: (options: { title: string; message: string; url?: string }) => Promise<ShareResult>;
  /** 공유 진행 중 여부 */
  isSharing: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 공유 기능 훅
 *
 * @example
 * ```tsx
 * const { shareJob, isSharing } = useShare();
 *
 * <Pressable onPress={() => shareJob({ id: job.id, title: job.title, location: job.location })}>
 *   <ShareIcon />
 * </Pressable>
 * ```
 */
export function useShare(): UseShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.uid);

  /**
   * 웹 플랫폼 공유 (Web Share API → 클립보드 fallback)
   */
  const webShare = useCallback(
    async (options: {
      title: string;
      text: string;
      url?: string;
    }): Promise<'shared' | 'dismissed'> => {
      // Web Share API 시도
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: options.title,
            text: options.text,
            url: options.url,
          });
          return 'shared';
        } catch (e) {
          // AbortError = 사용자가 공유 시트 닫음
          if (e instanceof Error && e.name === 'AbortError') {
            return 'dismissed';
          }
          // 그 외 에러는 클립보드 fallback
        }
      }

      // 클립보드 fallback
      const copyText = options.url || options.text;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(copyText);
      }
      toast.success('링크가 복사되었습니다');
      return 'shared';
    },
    [toast]
  );

  /**
   * 일반 콘텐츠 공유
   */
  const share = useCallback(
    async (options: { title: string; message: string; url?: string }): Promise<ShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }

      setIsSharing(true);

      try {
        let action: 'shared' | 'dismissed';

        if (Platform.OS === 'web') {
          action = await webShare({
            title: options.title,
            text: options.message,
            url: options.url,
          });
        } else {
          const result = await Share.share(
            {
              title: options.title,
              message: options.message,
              ...(Platform.OS === 'ios' && options.url ? { url: options.url } : {}),
            },
            {
              dialogTitle: options.title,
            }
          );
          action = result.action === Share.sharedAction ? 'shared' : 'dismissed';
        }

        logger.info('콘텐츠 공유 완료', { action, title: options.title });

        return { success: action === 'shared', action };
      } catch (error) {
        logger.error('콘텐츠 공유 실패', toError(error), {
          title: options.title,
        });
        return { success: false, error: toError(error) };
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, webShare]
  );

  /**
   * 공고 공유 실행 코어 (isSharing 가드 없이 순수 공유만 수행).
   * shareJob / shareJobById 가 공통으로 사용한다.
   */
  const runJobShare = useCallback(
    async (job: JobPosting): Promise<ShareResult> => {
      try {
        // 웹 URL 생성 (외부 공유용)
        const url = createJobDeepLink(job.id, true);

        // 실시간 확정 인원 조회 (best-effort) — 🙋 라인을 "확정/총원" 으로 표시.
        // 실패해도 공유는 진행되어야 하므로 빈 맵(0/N) 으로 degrade.
        let filledCounts: Map<string, number> | undefined;
        try {
          const all = await jobPostingRepository.getPostingFilledCounts([job.id]);
          filledCounts = extractPostingFilledSubmap(all, job.id);
        } catch (countError) {
          logger.warn('공유 확정 인원 조회 실패 — 0/N fallback', {
            jobId: job.id,
            error: toError(countError),
          });
        }

        // 공유 메시지 구성 (일정·역할·인원·급여·복리후생·세금 포함, url 은 본문 마지막 1회)
        const message = buildJobShareText(job, url, filledCounts);

        let action: 'shared' | 'dismissed';

        if (Platform.OS === 'web') {
          // url 은 message 본문에 이미 포함 — 별도 url 미전달로 중복 미리보기 방지
          action = await webShare({ title: job.title, text: message });
        } else {
          // iOS 에서 url 을 별도 전달하면 카톡이 본문+링크를 이중 렌더 → message 만 전달
          const result = await Share.share(
            {
              title: job.title,
              message,
            },
            {
              dialogTitle: '공고 공유하기',
            }
          );
          action = result.action === Share.sharedAction ? 'shared' : 'dismissed';
        }

        // Analytics 이벤트
        if (action === 'shared') {
          trackEvent('job_shared', {
            job_id: job.id,
            job_title: job.title,
          });
        }

        logger.info('공고 공유 완료', { action, jobId: job.id });

        return { success: action === 'shared', action };
      } catch (error) {
        logger.error('공고 공유 실패', toError(error), { jobId: job.id });
        return { success: false, error: toError(error) };
      }
    },
    [webShare]
  );

  /**
   * 공고 공유
   */
  const shareJob = useCallback(
    async (job: JobPosting): Promise<ShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }

      setIsSharing(true);
      try {
        return await runJobShare(job);
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, runJobShare]
  );

  /**
   * 공고 ID 로 공유 — 리스트 카드처럼 완전한 JobPosting 을 갖지 못한 화면용.
   * 상세 조회 쿼리를 재사용(캐시·dedupe)해 전체 JobPosting 을 확보한 뒤
   * shareJob 과 동일한 본문으로 공유한다.
   */
  const shareJobById = useCallback(
    async (jobId: string): Promise<ShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }

      setIsSharing(true);
      try {
        const job = await queryClient.fetchQuery(getJobDetailQueryOptions(jobId, userId));

        if (!job) {
          logger.warn('공유할 공고를 찾지 못함', { jobId });
          toast.error('공고 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
          return { success: false, error: new Error('공고를 찾을 수 없습니다') };
        }

        return await runJobShare(job);
      } catch (error) {
        logger.error('공고 공유 실패 (조회 단계)', toError(error), { jobId });
        toast.error('공고 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        return { success: false, error: toError(error) };
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, queryClient, runJobShare, toast, userId]
  );

  return {
    shareJob,
    shareJobById,
    share,
    isSharing,
  };
}

export default useShare;
