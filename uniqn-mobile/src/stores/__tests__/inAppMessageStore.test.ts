/**
 * UNIQN Mobile - InAppMessage Store Tests
 *
 * @description Tests for in-app message state management (Zustand)
 */

import { act } from '@testing-library/react-native';
import {
  useInAppMessageStore,
  selectHasMessage,
  selectQueueCount,
  selectIsMessageShown,
  selectIsMessageDismissed,
  selectIsSessionShown,
  selectCurrentMessage,
  selectMessageQueue,
  selectAllMessages,
  selectIsLoading,
} from '../inAppMessageStore';
import type { InAppMessage } from '@/types/inAppMessage';

// ============================================================================
// Helpers
// ============================================================================

const createMessage = (overrides: Partial<InAppMessage> = {}): InAppMessage => ({
  id: `msg-${Math.random().toString(36).slice(2, 8)}`,
  type: 'banner',
  title: 'Test Message',
  content: 'Test content',
  priority: 'medium',
  targetAudience: { type: 'all' },
  isActive: true,
  ...overrides,
});

function resetStore() {
  act(() => {
    const state = useInAppMessageStore.getState();
    state.setMessages([]);
    state.clearHistory();
    state.resetSessionIds();
    state.setLoading(false);
    // Reset currentMessage and messageQueue manually via setState
    useInAppMessageStore.setState({
      messageQueue: [],
      currentMessage: null,
    });
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('InAppMessageStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should start with empty state', () => {
      const state = useInAppMessageStore.getState();
      expect(state.messageQueue).toEqual([]);
      expect(state.currentMessage).toBeNull();
      expect(state.history).toEqual({});
      expect(state.allMessages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.sessionShownIds).toEqual(new Set());
    });
  });

  // ============================================================================
  // setMessages
  // ============================================================================

  describe('setMessages', () => {
    it('should set all messages', () => {
      const messages = [createMessage({ id: 'msg-1' }), createMessage({ id: 'msg-2' })];

      act(() => {
        useInAppMessageStore.getState().setMessages(messages);
      });

      expect(useInAppMessageStore.getState().allMessages).toHaveLength(2);
      expect(useInAppMessageStore.getState().allMessages[0].id).toBe('msg-1');
    });

    it('should replace existing messages', () => {
      act(() => {
        useInAppMessageStore.getState().setMessages([createMessage({ id: 'old' })]);
      });
      act(() => {
        useInAppMessageStore.getState().setMessages([createMessage({ id: 'new' })]);
      });

      expect(useInAppMessageStore.getState().allMessages).toHaveLength(1);
      expect(useInAppMessageStore.getState().allMessages[0].id).toBe('new');
    });
  });

  // ============================================================================
  // enqueueMessage
  // ============================================================================

  describe('enqueueMessage', () => {
    it('should add message to queue', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });

      expect(useInAppMessageStore.getState().messageQueue).toHaveLength(1);
      expect(useInAppMessageStore.getState().messageQueue[0].id).toBe('msg-1');
    });

    it('should not add duplicate message to queue', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });

      expect(useInAppMessageStore.getState().messageQueue).toHaveLength(1);
    });

    it('should not enqueue message that is currently displayed', () => {
      const msg = createMessage({ id: 'msg-1' });

      // Set as current message directly
      act(() => {
        useInAppMessageStore.setState({ currentMessage: msg });
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });

      expect(useInAppMessageStore.getState().messageQueue).toHaveLength(0);
    });

    it('should sort queue by priority (critical first)', () => {
      const low = createMessage({ id: 'low', priority: 'low' });
      const critical = createMessage({ id: 'critical', priority: 'critical' });
      const high = createMessage({ id: 'high', priority: 'high' });
      const medium = createMessage({ id: 'medium', priority: 'medium' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(low);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(critical);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(high);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(medium);
      });

      const queue = useInAppMessageStore.getState().messageQueue;
      expect(queue[0].id).toBe('critical');
      expect(queue[1].id).toBe('high');
      expect(queue[2].id).toBe('medium');
      expect(queue[3].id).toBe('low');
    });
  });

  // ============================================================================
  // showNextMessage
  // ============================================================================

  describe('showNextMessage', () => {
    it('should show the first message from queue', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-1');
      expect(useInAppMessageStore.getState().messageQueue).toHaveLength(0);
    });

    it('should not show next message if one is already displayed', () => {
      const msg1 = createMessage({ id: 'msg-1' });
      const msg2 = createMessage({ id: 'msg-2' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg1);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg2);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      // msg-1 is now current, msg-2 still in queue
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      // Should still be msg-1 (not replaced)
      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-1');
      expect(useInAppMessageStore.getState().messageQueue).toHaveLength(1);
    });

    it('should do nothing when queue is empty', () => {
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage).toBeNull();
    });
  });

  // ============================================================================
  // dismissCurrentMessage
  // ============================================================================

  describe('dismissCurrentMessage', () => {
    it('should clear current message', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage).not.toBeNull();

      act(() => {
        useInAppMessageStore.getState().dismissCurrentMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage).toBeNull();
    });

    it('should record message in history when dismissed', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });
      act(() => {
        useInAppMessageStore.getState().dismissCurrentMessage();
      });

      const history = useInAppMessageStore.getState().history;
      expect(history['msg-1']).toBeDefined();
      expect(history['msg-1'].shownCount).toBe(1);
      expect(history['msg-1'].messageId).toBe('msg-1');
    });

    it('should show next message after 300ms delay', () => {
      const msg1 = createMessage({ id: 'msg-1', priority: 'high' });
      const msg2 = createMessage({ id: 'msg-2', priority: 'low' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg1);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg2);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      // Dismiss msg-1
      act(() => {
        useInAppMessageStore.getState().dismissCurrentMessage();
      });

      // Before timeout, currentMessage should be null
      expect(useInAppMessageStore.getState().currentMessage).toBeNull();

      // After 300ms, msg-2 should be shown
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-2');
    });

    it('should handle dismiss when no current message', () => {
      // Should not throw
      act(() => {
        useInAppMessageStore.getState().dismissCurrentMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage).toBeNull();
    });
  });

  // ============================================================================
  // recordMessageShown
  // ============================================================================

  describe('recordMessageShown', () => {
    it('should create new history entry', () => {
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });

      const history = useInAppMessageStore.getState().history['msg-1'];
      expect(history).toBeDefined();
      expect(history.messageId).toBe('msg-1');
      expect(history.shownCount).toBe(1);
      expect(history.dismissed).toBe(false);
      expect(history.lastShownAt).toBeDefined();
    });

    it('should increment shown count on repeated calls', () => {
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });

      expect(useInAppMessageStore.getState().history['msg-1'].shownCount).toBe(3);
    });

    it('should preserve dismissed flag when recording shown', () => {
      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });

      const history = useInAppMessageStore.getState().history['msg-1'];
      expect(history.dismissed).toBe(true);
    });
  });

  // ============================================================================
  // dismissMessagePermanently
  // ============================================================================

  describe('dismissMessagePermanently', () => {
    it('should set dismissed flag in history', () => {
      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });

      const history = useInAppMessageStore.getState().history['msg-1'];
      expect(history.dismissed).toBe(true);
    });

    it('should close current message if it matches', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-1');

      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });

      expect(useInAppMessageStore.getState().currentMessage).toBeNull();
    });

    it('should not affect current message if it does not match', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.setState({ currentMessage: msg });
      });
      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-2');
      });

      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-1');
    });

    it('should remove message from queue', () => {
      const msg1 = createMessage({ id: 'msg-1', priority: 'high' });
      const msg2 = createMessage({ id: 'msg-2', priority: 'low' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg1);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg2);
      });

      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });

      const queue = useInAppMessageStore.getState().messageQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('msg-2');
    });

    it('should show next message after dismissing current', () => {
      const msg1 = createMessage({ id: 'msg-1', priority: 'high' });
      const msg2 = createMessage({ id: 'msg-2', priority: 'low' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg1);
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg2);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(useInAppMessageStore.getState().currentMessage?.id).toBe('msg-2');
    });
  });

  // ============================================================================
  // clearHistory
  // ============================================================================

  describe('clearHistory', () => {
    it('should clear all history entries', () => {
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-2');
      });

      expect(Object.keys(useInAppMessageStore.getState().history)).toHaveLength(2);

      act(() => {
        useInAppMessageStore.getState().clearHistory();
      });

      expect(useInAppMessageStore.getState().history).toEqual({});
    });
  });

  // ============================================================================
  // setLoading
  // ============================================================================

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      act(() => {
        useInAppMessageStore.getState().setLoading(true);
      });
      expect(useInAppMessageStore.getState().isLoading).toBe(true);
    });

    it('should set loading state to false', () => {
      act(() => {
        useInAppMessageStore.getState().setLoading(true);
      });
      act(() => {
        useInAppMessageStore.getState().setLoading(false);
      });
      expect(useInAppMessageStore.getState().isLoading).toBe(false);
    });
  });

  // ============================================================================
  // Session Shown IDs
  // ============================================================================

  describe('Session Shown IDs', () => {
    it('addSessionShownId should add ID to session list', () => {
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });

      expect(useInAppMessageStore.getState().sessionShownIds.has('msg-1')).toBe(true);
    });

    it('addSessionShownId should not add duplicate IDs', () => {
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });

      expect(useInAppMessageStore.getState().sessionShownIds.size).toBe(1);
    });

    it('hasSessionShownId should return true for shown ID', () => {
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });

      expect(useInAppMessageStore.getState().hasSessionShownId('msg-1')).toBe(true);
    });

    it('hasSessionShownId should return false for unshown ID', () => {
      expect(useInAppMessageStore.getState().hasSessionShownId('msg-1')).toBe(false);
    });

    it('resetSessionIds should clear all session IDs', () => {
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });
      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-2');
      });

      act(() => {
        useInAppMessageStore.getState().resetSessionIds();
      });

      expect(useInAppMessageStore.getState().sessionShownIds.size).toBe(0);
    });
  });

  // ============================================================================
  // Selectors
  // ============================================================================

  describe('Selectors', () => {
    it('selectHasMessage should return true when message is displayed', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(selectHasMessage(useInAppMessageStore.getState())).toBe(true);
    });

    it('selectHasMessage should return false when no message', () => {
      expect(selectHasMessage(useInAppMessageStore.getState())).toBe(false);
    });

    it('selectQueueCount should return queue length', () => {
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(createMessage({ id: 'msg-1' }));
      });
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(createMessage({ id: 'msg-2' }));
      });

      expect(selectQueueCount(useInAppMessageStore.getState())).toBe(2);
    });

    it('selectIsMessageShown should return true after shown', () => {
      act(() => {
        useInAppMessageStore.getState().recordMessageShown('msg-1');
      });

      expect(selectIsMessageShown(useInAppMessageStore.getState(), 'msg-1')).toBe(true);
    });

    it('selectIsMessageShown should return false when not shown', () => {
      expect(selectIsMessageShown(useInAppMessageStore.getState(), 'msg-1')).toBe(false);
    });

    it('selectIsMessageDismissed should return true after permanent dismiss', () => {
      act(() => {
        useInAppMessageStore.getState().dismissMessagePermanently('msg-1');
      });

      expect(selectIsMessageDismissed(useInAppMessageStore.getState(), 'msg-1')).toBe(true);
    });

    it('selectIsMessageDismissed should return false when not dismissed', () => {
      expect(selectIsMessageDismissed(useInAppMessageStore.getState(), 'msg-1')).toBe(false);
    });

    it('selectIsSessionShown should return correct values', () => {
      expect(selectIsSessionShown(useInAppMessageStore.getState(), 'msg-1')).toBe(false);

      act(() => {
        useInAppMessageStore.getState().addSessionShownId('msg-1');
      });

      expect(selectIsSessionShown(useInAppMessageStore.getState(), 'msg-1')).toBe(true);
    });

    it('selectCurrentMessage should return current message', () => {
      const msg = createMessage({ id: 'msg-1' });

      act(() => {
        useInAppMessageStore.getState().enqueueMessage(msg);
      });
      act(() => {
        useInAppMessageStore.getState().showNextMessage();
      });

      expect(selectCurrentMessage(useInAppMessageStore.getState())?.id).toBe('msg-1');
    });

    it('selectCurrentMessage should return null when no message', () => {
      expect(selectCurrentMessage(useInAppMessageStore.getState())).toBeNull();
    });

    it('selectMessageQueue should return the queue', () => {
      act(() => {
        useInAppMessageStore.getState().enqueueMessage(createMessage({ id: 'msg-1' }));
      });

      expect(selectMessageQueue(useInAppMessageStore.getState())).toHaveLength(1);
    });

    it('selectAllMessages should return all messages', () => {
      const messages = [createMessage({ id: 'msg-1' }), createMessage({ id: 'msg-2' })];

      act(() => {
        useInAppMessageStore.getState().setMessages(messages);
      });

      expect(selectAllMessages(useInAppMessageStore.getState())).toHaveLength(2);
    });

    it('selectIsLoading should return loading state', () => {
      expect(selectIsLoading(useInAppMessageStore.getState())).toBe(false);

      act(() => {
        useInAppMessageStore.getState().setLoading(true);
      });

      expect(selectIsLoading(useInAppMessageStore.getState())).toBe(true);
    });
  });
});
