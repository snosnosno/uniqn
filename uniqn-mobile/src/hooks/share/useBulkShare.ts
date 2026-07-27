/**
 * 공고 묶음 공유 훅
 *
 * @description 선택한 여러 공고를 압축 본문 하나로 묶어 카톡·SNS 로 내보낸다.
 *   단일 공유(useShare)와 같은 게이트(canShareJob)·같은 공유 시트(useShareSheet)·
 *   같은 파생 모델을 쓰되, 본문만 묶음용 압축 빌더를 사용한다.
 *
 *   조회는 배치 API 2회로 고정한다 — getByIdBatch 1회 + getPostingFilledCounts 1회.
 *   공고당 상세를 각각 부르면 10건 공유에 20 왕복이 난다.
 */

import { useCallback, useState } from 'react';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, ValidationError, toError } from '@/errors';
import { trackEvent, createDeepLink } from '@/services/observability';
import { useShareSheet } from '@/hooks/share/useShareSheet';
import { extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
import { jobPostingRepository } from '@/repositories';
import { canShareJob } from '@/domains/job-posting';
import { buildBulkJobShareText, MAX_BULK_SHARE_COUNT } from '@/utils/bulkJobShareMessage';
import { confirmActionAsync } from '@/utils/confirmAction';
import { useToast } from '@/stores/toastStore';

export type BulkShareSource = 'employer' | 'admin';

export interface BulkShareResult {
  success: boolean;
  action?: 'shared' | 'dismissed';
  /** 실제로 본문에 포함된 공고 수 */
  sharedCount?: number;
  /** 공유 불가로 제외된 공고 수 */
  skippedCount?: number;
  error?: Error;
}

export interface UseBulkShareReturn {
  shareJobs: (jobIds: string[], source: BulkShareSource) => Promise<BulkShareResult>;
  isSharing: boolean;
}

export function useBulkShare(): UseBulkShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const toast = useToast();
  const { openShareSheet } = useShareSheet();

  const shareJobs = useCallback(
    async (jobIds: string[], source: BulkShareSource): Promise<BulkShareResult> => {
      if (isSharing) {
        return { success: false, error: new Error('이미 공유 중입니다') };
      }
      if (jobIds.length === 0) {
        toast.error('공유할 공고를 선택해주세요');
        return { success: false, error: new Error('선택된 공고 없음') };
      }
      if (jobIds.length > MAX_BULK_SHARE_COUNT) {
        const error = new ValidationError(ERROR_CODES.VALIDATION_BULK_SHARE_LIMIT, {
          message: `묶음 공유 상한 초과 (${jobIds.length}/${MAX_BULK_SHARE_COUNT})`,
          userMessage: `한 번에 최대 ${MAX_BULK_SHARE_COUNT}건까지 공유할 수 있어요`,
        });
        toast.error(error.userMessage);
        return { success: false, error };
      }

      setIsSharing(true);

      try {
        // 선택 시점 이후 마감·반려로 상태가 바뀌었을 수 있다 — 캐시가 아니라 원본을 다시 본다.
        const postings = await jobPostingRepository.getByIdBatch(jobIds);
        const shareable = postings.filter((posting) => canShareJob(posting));
        const skippedCount = jobIds.length - shareable.length;

        if (shareable.length === 0) {
          const error = new BusinessError(ERROR_CODES.BUSINESS_BULK_SHARE_NONE_SHAREABLE, {
            message: '선택한 공고가 전부 공유 불가 상태',
          });
          logger.info('묶음 공유 차단 — 전건 공유 불가', { requested: jobIds.length, source });
          toast.error(error.userMessage);
          return { success: false, skippedCount, error };
        }

        if (skippedCount > 0) {
          const proceed = await confirmActionAsync({
            title: '일부 공고를 제외할까요?',
            message: `${jobIds.length}건 중 ${skippedCount}건은 마감·승인 대기 상태예요.\n나머지 ${shareable.length}건만 공유합니다.`,
            confirmText: `${shareable.length}건 공유`,
          });
          if (!proceed) {
            return { success: false, action: 'dismissed', skippedCount };
          }
        }

        // 확정 인원은 배치 1회 — 실패해도 공유는 진행(0/N 으로 degrade, 단일 공유와 동일 정책)
        let filledCounts: Map<string, number> | undefined;
        try {
          filledCounts = await jobPostingRepository.getPostingFilledCounts(
            shareable.map((posting) => posting.id)
          );
        } catch (countError) {
          logger.warn('묶음 공유 확정 인원 조회 실패 — 0/N fallback', {
            count: shareable.length,
            error: toError(countError),
          });
        }

        // 링크는 구인구직 탭 하나 — 개별 공고 링크를 N개 넣으면 카톡이 그중 하나만
        // 스크랩해 목록 공유인데 특정 공고 카드가 뜬다.
        const listUrl = createDeepLink({ name: 'jobs' }, { useWebUrl: true });
        const message = buildBulkJobShareText(shareable, listUrl, (jobId) =>
          extractPostingFilledSubmap(filledCounts, jobId)
        );

        // url 은 본문 마지막에 이미 포함 — 따로 넘기면 iOS 에서 이중 렌더된다.
        const action = await openShareSheet({
          title: `공고 ${shareable.length}건`,
          message,
          dialogTitle: '공고 묶음 공유하기',
        });

        if (action === 'shared') {
          trackEvent('job_shared_bulk', {
            count: shareable.length,
            skipped_count: skippedCount,
            source,
          });
        }

        logger.info('묶음 공유 완료', {
          action,
          count: shareable.length,
          skippedCount,
          source,
        });

        return {
          success: action === 'shared',
          action,
          sharedCount: shareable.length,
          skippedCount,
        };
      } catch (error) {
        logger.error('묶음 공유 실패', toError(error), { count: jobIds.length, source });
        toast.error('공고 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        return { success: false, error: toError(error) };
      } finally {
        setIsSharing(false);
      }
    },
    [isSharing, openShareSheet, toast]
  );

  return { shareJobs, isSharing };
}
