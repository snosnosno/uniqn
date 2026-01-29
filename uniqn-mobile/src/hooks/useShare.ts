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

  /**
   * 일반 콘텐츠 공유
   */
  const share = useCallback(
    async (options: {
      title: string;
      message: string;
      url?: string;
    }): Promise<ShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }

      setIsSharing(true);

      try {
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

        // Android는 항상 'sharedAction', iOS는 실제 액션 반환
        const action =
          result.action === Share.sharedAction ? 'shared' : 'dismissed';

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
    [isSharing]
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

        const action =
          result.action === Share.sharedAction ? 'shared' : 'dismissed';

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
    [isSharing]
  );

  return {
    shareJob,
    share,
    isSharing,
  };
}

export default useShare;
