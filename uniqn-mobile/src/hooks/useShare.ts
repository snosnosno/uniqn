/**
 * UNIQN Mobile - 공유 기능 훅
 *
 * @description 공고 및 콘텐츠 공유 기능 제공
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Share, Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { trackEvent } from '@/services/analyticsService';
import { createJobDeepLink } from '@/services/deepLinkService';
import { useToast } from '@/stores/toastStore';

// ============================================================================
// Types
// ============================================================================

export interface ShareJobParams {
  id: string;
  title: string;
  location: string;
  workDate?: string;
}

export interface ShareResult {
  success: boolean;
  action?: 'shared' | 'dismissed';
  error?: Error;
}

export interface UseShareReturn {
  /** 공고 공유 */
  shareJob: (job: ShareJobParams) => Promise<ShareResult>;
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
   * 공고 공유
   */
  const shareJob = useCallback(
    async (job: ShareJobParams): Promise<ShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }

      setIsSharing(true);

      try {
        // 웹 URL 생성 (외부 공유용)
        const url = createJobDeepLink(job.id, true);

        // 공유 메시지 구성
        const dateInfo = job.workDate ? `\n${job.workDate}` : '';
        const message = `[UNIQN] ${job.title}\n${job.location}${dateInfo}\n\n${url}`;

        let action: 'shared' | 'dismissed';

        if (Platform.OS === 'web') {
          action = await webShare({ title: job.title, text: message, url });
        } else {
          const result = await Share.share(
            {
              title: job.title,
              message,
              ...(Platform.OS === 'ios' ? { url } : {}),
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
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, webShare]
  );

  return {
    shareJob,
    share,
    isSharing,
  };
}

export default useShare;
