/**
 * 구인공고 공지 전송 Hook
 *
 * @description
 * Firebase Functions를 호출하여 공고에 확정된 스태프들에게 공지를 전송하는 Hook
 *
 * @version 1.0.0
 * @since 2025-09-30
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { logger } from '../utils/logger';
import { useToast } from './useToast';
import type { SendAnnouncementRequest, SendAnnouncementResponse } from '../types';

export interface UseJobPostingAnnouncementReturn {
  /** 공지 전송 함수 */
  sendAnnouncement: (
    eventId: string,
    title: string,
    message: string,
    targetStaffIds: string[],
    jobPostingTitle?: string
  ) => Promise<SendAnnouncementResponse>;

  /** 전송 중 상태 */
  isSending: boolean;

  /** 에러 */
  error: Error | null;

  /** 전송 결과 */
  result: SendAnnouncementResponse | null;
}

/**
 * 공지 전송 Hook
 *
 * @example
 * ```tsx
 * const { sendAnnouncement, isSending } = useJobPostingAnnouncement();
 *
 * const handleSend = async () => {
 *   try {
 *     const result = await sendAnnouncement(
 *       eventId,
 *       '긴급 공지',
 *       '내일 행사가 1시간 앞당겨졌습니다.',
 *       staffIds
 *     );
 *
 *     if (result.success) {
 *       // 전송 성공 처리
 *     }
 *   } catch (error) {
 *     // 전송 실패 처리
 *   }
 * };
 * ```
 */
export const useJobPostingAnnouncement = (): UseJobPostingAnnouncementReturn => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<SendAnnouncementResponse | null>(null);
  const { showSuccess, showError } = useToast();

  /**
   * 공지 전송 함수
   */
  const sendAnnouncement = useCallback(
    async (
      eventId: string,
      title: string,
      message: string,
      targetStaffIds: string[],
      jobPostingTitle?: string
    ): Promise<SendAnnouncementResponse> => {
      setIsSending(true);
      setError(null);
      setResult(null);

      try {
        logger.info('공지 전송 시작', {
          data: {
            eventId,
            title,
            targetCount: targetStaffIds.length,
            jobPostingTitle,
          }
        });

        // Firebase Functions 호출
        const sendAnnouncementFn = httpsCallable<
          SendAnnouncementRequest,
          SendAnnouncementResponse
        >(functions, 'sendJobPostingAnnouncement');

        const requestData: SendAnnouncementRequest = {
          eventId,
          title,
          message,
          targetStaffIds,
        };

        if (jobPostingTitle) {
          requestData.jobPostingTitle = jobPostingTitle;
        }

        const response = await sendAnnouncementFn(requestData);

        const responseData = response.data;

        if (responseData.success) {
          const successCount = responseData.result?.successCount || 0;
          const failedCount = responseData.result?.failedCount || 0;

          logger.info('공지 전송 성공', {
            data: {
              announcementId: responseData.announcementId,
              successCount,
              failedCount,
            }
          });

          // 성공 Toast
          showSuccess(
            `공지가 ${successCount}명에게 전송되었습니다.${
              failedCount > 0 ? ` (실패: ${failedCount}명)` : ''
            }`
          );

          setResult(responseData);
          return responseData;
        } else {
          throw new Error(responseData.error || '공지 전송에 실패했습니다.');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '공지 전송에 실패했습니다.';

        logger.error('공지 전송 실패', err as Error, {
          data: {
            eventId,
            targetCount: targetStaffIds.length,
          }
        });

        setError(err as Error);

        // 에러 Toast
        showError(errorMessage);

        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [showSuccess, showError]
  );

  return {
    sendAnnouncement,
    isSending,
    error,
    result,
  };
};