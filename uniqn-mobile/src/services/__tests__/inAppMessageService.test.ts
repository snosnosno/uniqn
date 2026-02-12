/**
 * UNIQN Mobile - In-App Message Service Tests
 *
 * @description 인앱 메시지 서비스 테스트
 * @version 1.0.0
 */

import {
  resetSession,
  canShowMessage,
  filterAndSortMessages,
  processMessages,
  showMessage,
  dismissCurrentMessage,
  dismissMessagePermanently,
  getMessagesByType,
  clearMessageHistory,
} from '../inAppMessageService';
import type { InAppMessage } from '@/types/inAppMessage';

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockResetSessionIds = jest.fn();
const mockEnqueueMessage = jest.fn();
const mockShowNextMessage = jest.fn();
const mockAddSessionShownId = jest.fn();
const mockDismissCurrentMessage = jest.fn();
const mockDismissMessagePermanently = jest.fn();
const mockSetMessages = jest.fn();
const mockClearHistory = jest.fn();
const mockHasSessionShownId = jest.fn();
const mockGetState = jest.fn();

jest.mock('@/stores/inAppMessageStore', () => ({
  useInAppMessageStore: {
    getState: () => mockGetState(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      user: { uid: 'user-123' },
      profile: { role: 'staff' },
    })),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.5.0',
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockMessage(overrides: Partial<InAppMessage> = {}): InAppMessage {
  return {
    id: 'msg-1',
    type: 'banner',
    title: '테스트 메시지',
    content: '메시지 내용',
    priority: 'medium',
    targetAudience: { type: 'all' },
    isActive: true,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('InAppMessageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({
      history: {},
      allMessages: [],
      currentMessage: null,
      messageQueue: [],
      sessionShownIds: [],
      resetSessionIds: mockResetSessionIds,
      enqueueMessage: mockEnqueueMessage,
      showNextMessage: mockShowNextMessage,
      addSessionShownId: mockAddSessionShownId,
      dismissCurrentMessage: mockDismissCurrentMessage,
      dismissMessagePermanently: mockDismissMessagePermanently,
      setMessages: mockSetMessages,
      clearHistory: mockClearHistory,
      hasSessionShownId: mockHasSessionShownId,
    });
  });

  // ==========================================================================
  // Session Management
  // ==========================================================================

  describe('resetSession', () => {
    it('세션 ID를 초기화해야 함', () => {
      resetSession();

      expect(mockResetSessionIds).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Condition Checks
  // ==========================================================================

  describe('canShowMessage', () => {
    it('기본 조건을 만족하면 true를 반환해야 함', () => {
      const message = createMockMessage();

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('비활성화된 메시지는 false를 반환해야 함', () => {
      const message = createMockMessage({ isActive: false });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('영구 닫힌 메시지는 false를 반환해야 함', () => {
      mockGetState.mockReturnValue({
        history: {
          'msg-1': { messageId: 'msg-1', dismissed: true, shownCount: 1, lastShownAt: new Date().toISOString() },
        },
        hasSessionShownId: mockHasSessionShownId,
      });

      const message = createMockMessage({ id: 'msg-1' });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('최소 버전 조건을 확인해야 함', () => {
      const message = createMockMessage({
        conditions: { minAppVersion: '2.0.0' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('최대 버전 조건을 확인해야 함', () => {
      // Current version is 1.5.0, so max 1.0.0 should be rejected
      const message = createMockMessage({
        conditions: { maxAppVersion: '1.0.0' },
      });

      const result = canShowMessage(message);

      // Since current > max, should NOT show
      expect(result).toBe(false);
    });

    it('날짜 범위 내에 있으면 true를 반환해야 함', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const message = createMockMessage({
        conditions: {
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('시작 날짜 이전이면 false를 반환해야 함', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const message = createMockMessage({
        conditions: { startDate: tomorrow.toISOString() },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('종료 날짜 이후이면 false를 반환해야 함', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const message = createMockMessage({
        conditions: { endDate: yesterday.toISOString() },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('플랫폼 조건을 확인해야 함', () => {
      const message = createMockMessage({
        conditions: { platforms: ['android', 'web'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('현재 플랫폼이 포함되면 true를 반환해야 함', () => {
      const message = createMockMessage({
        conditions: { platforms: ['ios', 'android'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('once 빈도는 이력이 없으면 true를 반환해야 함', () => {
      const message = createMockMessage({
        conditions: { frequency: 'once' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('once 빈도는 이력이 있으면 false를 반환해야 함', () => {
      mockGetState.mockReturnValue({
        history: {
          'msg-1': { messageId: 'msg-1', dismissed: false, shownCount: 1, lastShownAt: new Date().toISOString() },
        },
        hasSessionShownId: mockHasSessionShownId,
      });

      const message = createMockMessage({
        id: 'msg-1',
        conditions: { frequency: 'once' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('once_per_session 빈도는 세션에 표시되지 않았으면 true를 반환해야 함', () => {
      mockHasSessionShownId.mockReturnValue(false);

      const message = createMockMessage({
        conditions: { frequency: 'once_per_session' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('once_per_session 빈도는 세션에 표시되었으면 false를 반환해야 함', () => {
      mockHasSessionShownId.mockReturnValue(true);

      const message = createMockMessage({
        conditions: { frequency: 'once_per_session' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('daily 빈도는 오늘 표시되지 않았으면 true를 반환해야 함', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      mockGetState.mockReturnValue({
        history: {
          'msg-1': {
            messageId: 'msg-1',
            dismissed: false,
            shownCount: 1,
            lastShownAt: yesterday.toISOString(),
          },
        },
        hasSessionShownId: mockHasSessionShownId,
      });

      const message = createMockMessage({
        id: 'msg-1',
        conditions: { frequency: 'daily' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('daily 빈도는 오늘 이미 표시되었으면 false를 반환해야 함', () => {
      mockGetState.mockReturnValue({
        history: {
          'msg-1': {
            messageId: 'msg-1',
            dismissed: false,
            shownCount: 1,
            lastShownAt: new Date().toISOString(),
          },
        },
        hasSessionShownId: mockHasSessionShownId,
      });

      const message = createMockMessage({
        id: 'msg-1',
        conditions: { frequency: 'daily' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('타겟 오디언스가 all이면 true를 반환해야 함', () => {
      const message = createMockMessage({
        targetAudience: { type: 'all' },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('타겟 역할에 포함되면 true를 반환해야 함', () => {
      const message = createMockMessage({
        targetAudience: { type: 'roles', roles: ['staff', 'employer'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('타겟 역할에 포함되지 않으면 false를 반환해야 함', () => {
      const message = createMockMessage({
        targetAudience: { type: 'roles', roles: ['admin'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });

    it('타겟 사용자에 포함되면 true를 반환해야 함', () => {
      const message = createMockMessage({
        targetAudience: { type: 'users', userIds: ['user-123', 'user-456'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(true);
    });

    it('타겟 사용자에 포함되지 않으면 false를 반환해야 함', () => {
      const message = createMockMessage({
        targetAudience: { type: 'users', userIds: ['user-999'] },
      });

      const result = canShowMessage(message);

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Message Filtering & Sorting
  // ==========================================================================

  describe('filterAndSortMessages', () => {
    it('표시 가능한 메시지만 필터링해야 함', () => {
      const messages = [
        createMockMessage({ id: 'msg-1', isActive: true }),
        createMockMessage({ id: 'msg-2', isActive: false }),
        createMockMessage({ id: 'msg-3', isActive: true }),
      ];

      const result = filterAndSortMessages(messages);

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['msg-1', 'msg-3']);
    });

    it('우선순위에 따라 정렬해야 함', () => {
      const messages = [
        createMockMessage({ id: 'msg-1', priority: 'low' }),
        createMockMessage({ id: 'msg-2', priority: 'critical' }),
        createMockMessage({ id: 'msg-3', priority: 'high' }),
        createMockMessage({ id: 'msg-4', priority: 'medium' }),
      ];

      const result = filterAndSortMessages(messages);

      expect(result.map((m) => m.priority)).toEqual(['critical', 'high', 'medium', 'low']);
    });

    it('빈 배열을 처리해야 함', () => {
      const result = filterAndSortMessages([]);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Message Processing
  // ==========================================================================

  describe('processMessages', () => {
    it('메시지를 처리하고 큐에 추가해야 함', () => {
      const messages = [
        createMockMessage({ id: 'msg-1', priority: 'high' }),
        createMockMessage({ id: 'msg-2', priority: 'low' }),
      ];

      processMessages(messages);

      expect(mockSetMessages).toHaveBeenCalledWith(messages);
      expect(mockEnqueueMessage).toHaveBeenCalledTimes(2);
      expect(mockShowNextMessage).toHaveBeenCalled();
    });
  });

  describe('showMessage', () => {
    it('조건을 만족하면 메시지를 표시해야 함', () => {
      const message = createMockMessage();

      showMessage(message);

      expect(mockEnqueueMessage).toHaveBeenCalledWith(message);
      expect(mockShowNextMessage).toHaveBeenCalled();
    });

    it('조건을 만족하지 않으면 표시하지 않아야 함', () => {
      const message = createMockMessage({ isActive: false });

      showMessage(message);

      expect(mockEnqueueMessage).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Message Dismissal
  // ==========================================================================

  describe('dismissCurrentMessage', () => {
    it('현재 메시지를 닫아야 함', () => {
      mockGetState.mockReturnValue({
        currentMessage: createMockMessage({ id: 'msg-1' }),
        dismissCurrentMessage: mockDismissCurrentMessage,
        addSessionShownId: mockAddSessionShownId,
        hasSessionShownId: mockHasSessionShownId,
      });

      dismissCurrentMessage();

      expect(mockAddSessionShownId).toHaveBeenCalledWith('msg-1');
      expect(mockDismissCurrentMessage).toHaveBeenCalled();
    });

    it('현재 메시지가 없으면 아무것도 하지 않아야 함', () => {
      mockGetState.mockReturnValue({
        currentMessage: null,
        dismissCurrentMessage: mockDismissCurrentMessage,
        addSessionShownId: mockAddSessionShownId,
        hasSessionShownId: mockHasSessionShownId,
      });

      dismissCurrentMessage();

      expect(mockAddSessionShownId).not.toHaveBeenCalled();
      expect(mockDismissCurrentMessage).toHaveBeenCalled();
    });
  });

  describe('dismissMessagePermanently', () => {
    it('메시지를 영구적으로 닫아야 함', () => {
      const messageId = 'msg-1';

      dismissMessagePermanently(messageId);

      expect(mockDismissMessagePermanently).toHaveBeenCalledWith(messageId);
      expect(mockAddSessionShownId).toHaveBeenCalledWith(messageId);
    });
  });

  // ==========================================================================
  // Message Queries
  // ==========================================================================

  describe('getMessagesByType', () => {
    it('특정 타입의 메시지만 반환해야 함', () => {
      mockGetState.mockReturnValue({
        allMessages: [
          createMockMessage({ id: 'msg-1', type: 'banner' }),
          createMockMessage({ id: 'msg-2', type: 'modal' }),
          createMockMessage({ id: 'msg-3', type: 'banner' }),
        ],
        history: {},
        hasSessionShownId: mockHasSessionShownId,
      });

      const result = getMessagesByType('banner');

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.type === 'banner')).toBe(true);
    });

    it('표시 가능한 메시지만 반환해야 함', () => {
      mockGetState.mockReturnValue({
        allMessages: [
          createMockMessage({ id: 'msg-1', type: 'modal', isActive: true }),
          createMockMessage({ id: 'msg-2', type: 'modal', isActive: false }),
        ],
        history: {},
        hasSessionShownId: mockHasSessionShownId,
      });

      const result = getMessagesByType('modal');

      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // History Management
  // ==========================================================================

  describe('clearMessageHistory', () => {
    it('메시지 이력을 초기화해야 함', () => {
      clearMessageHistory();

      expect(mockClearHistory).toHaveBeenCalled();
      expect(mockResetSessionIds).toHaveBeenCalled();
    });
  });
});
