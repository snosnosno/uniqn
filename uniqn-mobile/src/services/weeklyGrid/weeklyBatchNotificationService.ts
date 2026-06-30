/**
 * weeklyBatchNotificationService — "이번 주 배치 확인" 알림(P5-2) 오케스트레이션.
 *
 * 아키텍처: Hook → Service → Repository. 기존 푸시 인프라를 재사용한다(신규 엣지펑션/마이그 없음).
 * 1) 수신자 해소: 운영처 컨테이너(getVenueContainerById, VenueContainer 경량 read 경로)의 ownerId(운영자).
 * 2) 순수 빌더: buildWeeklyBatchConfirmNotification 으로 INSERT 가능한 payload 생성(결정적).
 * 3) 발송: notificationRepository.createNotification → notifications 직접 INSERT,
 *    AFTER 트리거(notification_push_trigger)가 FCM 푸시를 발송한다.
 *
 * 타입/라우트 재사용 한계는 buildWeeklyBatchConfirmNotification 주석 참고.
 */
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { jobPostingRepository, notificationRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import { buildWeeklyBatchConfirmNotification } from '@/domains/weeklyGrid';

const COMPONENT = 'weeklyBatchNotificationService';

export interface NotifyWeeklyBatchConfirmResult {
  /** 알림 발송 여부(운영자 미해소 시 false). */
  sent: boolean;
  /** 발송된 수신자(운영자) id. 미발송이면 undefined. */
  recipientId?: string;
}

/**
 * 이번 주 배치 확인을 운영자에게 요청하는 알림을 발송한다.
 *
 * @param workspaceId 운영처가 속한 워크스페이스 id
 * @param venueId 운영처 컨테이너 id(= venue 식별자)
 * @param weekLabel 주차 라벨(예: '6월 5주차') — 내부 생성, 비-PII
 * @returns 발송 결과(운영자 미해소 시 sent=false)
 */
export async function notifyWeeklyBatchConfirm(
  workspaceId: string,
  venueId: string,
  weekLabel: string
): Promise<NotifyWeeklyBatchConfirmResult> {
  await requireCurrentUser();

  try {
    // 수신자(운영자) 해소 — 컨테이너 경량 read 경로(JobPosting 으로 읽지 않음).
    const container = await jobPostingRepository.getVenueContainerById(venueId);
    if (!container || !container.ownerId) {
      logger.warn('이번 주 배치 확인 알림: 컨테이너/운영자 미해소로 미발송', {
        component: COMPONENT,
        workspaceId,
        venueId,
      });
      return { sent: false };
    }

    const payload = buildWeeklyBatchConfirmNotification({
      recipientId: container.ownerId,
      workspaceId,
      venueId,
      weekLabel,
      venueName: container.name,
    });

    await notificationRepository.createNotification(payload);

    logger.info('이번 주 배치 확인 알림 발송', {
      component: COMPONENT,
      workspaceId,
      venueId,
      recipientId: container.ownerId,
    });

    return { sent: true, recipientId: container.ownerId };
  } catch (error) {
    logger.error('이번 주 배치 확인 알림 발송 실패', toError(error), {
      component: COMPONENT,
      workspaceId,
      venueId,
    });
    throw error;
  }
}
