/**
 * weeklyBatchNotificationService 테스트 — 수신자(운영자) 해소 / 빌더 payload INSERT 위임 / 미해소 단락.
 */
import { jobPostingRepository, notificationRepository } from '@/repositories';
import { notifyWeeklyBatchConfirm } from '../weeklyBatchNotificationService';
import { NotificationType } from '@/types/notification';

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getVenueContainerById: jest.fn(),
  },
  notificationRepository: {
    createNotification: jest.fn(),
  },
}));

jest.mock('@/services/auth/authCoreService', () => ({
  requireCurrentUser: jest.fn(() => ({ id: 'caller-1' })),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const getVenueContainerById = jobPostingRepository.getVenueContainerById as jest.Mock;
const createNotification = notificationRepository.createNotification as jest.Mock;

const container = {
  id: 'venue-1',
  name: '강남 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: 'owner-1',
  venueId: 'venue-1',
  kind: 'dated',
  softTargets: {},
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notifyWeeklyBatchConfirm', () => {
  it('컨테이너 ownerId(운영자)를 수신자로 빌드한 payload 를 INSERT 위임한다', async () => {
    getVenueContainerById.mockResolvedValue(container);
    createNotification.mockResolvedValue(undefined);

    const result = await notifyWeeklyBatchConfirm('ws-1', 'venue-1', '6월 5주차');

    expect(getVenueContainerById).toHaveBeenCalledWith('venue-1');
    expect(createNotification).toHaveBeenCalledTimes(1);
    const payload = createNotification.mock.calls[0][0];
    expect(payload.recipientId).toBe('owner-1');
    expect(payload.type).toBe(NotificationType.SCHEDULE_CREATED);
    expect(payload.data).toMatchObject({
      workspaceId: 'ws-1',
      venueId: 'venue-1',
      weekLabel: '6월 5주차',
    });
    expect(result).toEqual({ sent: true, recipientId: 'owner-1' });
  });

  it('컨테이너 미존재면 미발송(sent=false)으로 단락한다', async () => {
    getVenueContainerById.mockResolvedValue(null);

    const result = await notifyWeeklyBatchConfirm('ws-1', 'venue-x', '6월 5주차');

    expect(createNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false });
  });

  it('ownerId 가 없으면 미발송(sent=false)으로 단락한다', async () => {
    getVenueContainerById.mockResolvedValue({ ...container, ownerId: null });

    const result = await notifyWeeklyBatchConfirm('ws-1', 'venue-1', '6월 5주차');

    expect(createNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false });
  });

  it('INSERT 실패는 상위로 전파한다', async () => {
    getVenueContainerById.mockResolvedValue(container);
    createNotification.mockRejectedValue(new Error('insert boom'));

    await expect(notifyWeeklyBatchConfirm('ws-1', 'venue-1', '6월 5주차')).rejects.toThrow(
      'insert boom'
    );
  });
});
