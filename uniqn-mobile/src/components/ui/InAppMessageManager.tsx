/**
 * UNIQN Mobile - 인앱 메시지 매니저
 *
 * @description 인앱 메시지 표시 및 관리를 담당하는 최상위 컴포넌트
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react';
import { useInAppMessageStore } from '@/stores/inAppMessageStore';
import {
  dismissCurrentMessage,
  dismissMessagePermanently,
  resetSession,
} from '@/services/inAppMessageService';
import { useInAppMessages } from '@/hooks/useInAppMessages';
import { InAppBanner } from './InAppBanner';
import { InAppModal } from './InAppModal';
import type { InAppMessage } from '@/types/inAppMessage';

// ============================================================================
// Component
// ============================================================================

export function InAppMessageManager() {
  const currentMessage = useInAppMessageStore((state) => state.currentMessage);

  // 앱 시작 시 세션 초기화
  useEffect(() => {
    resetSession();
  }, []);

  // Firestore에서 활성 메시지 조회 및 처리
  useInAppMessages();

  // 메시지 닫기 핸들러
  const handleDismiss = useCallback(() => {
    dismissCurrentMessage();
  }, []);

  // 영구 닫기 핸들러
  const handleDismissPermanently = useCallback(() => {
    if (currentMessage) {
      dismissMessagePermanently(currentMessage.id);
    }
  }, [currentMessage]);

  // 표시할 메시지가 없으면 null
  if (!currentMessage) {
    return null;
  }

  // 메시지 타입에 따라 적절한 컴포넌트 렌더링
  return (
    <InAppMessageRenderer
      message={currentMessage}
      onDismiss={handleDismiss}
      onDismissPermanently={handleDismissPermanently}
    />
  );
}

// ============================================================================
// Message Renderer
// ============================================================================

interface InAppMessageRendererProps {
  message: InAppMessage;
  onDismiss: () => void;
  onDismissPermanently: () => void;
}

function InAppMessageRenderer({
  message,
  onDismiss,
  onDismissPermanently,
}: InAppMessageRendererProps) {
  switch (message.type) {
    case 'banner':
      return (
        <InAppBanner
          message={message}
          onDismiss={onDismiss}
          onDismissPermanently={message.showDontShowAgain ? onDismissPermanently : undefined}
        />
      );

    case 'modal':
    case 'fullscreen':
      return (
        <InAppModal
          message={message}
          onDismiss={onDismiss}
          onDismissPermanently={message.showDontShowAgain ? onDismissPermanently : undefined}
        />
      );

    default:
      return null;
  }
}

export default InAppMessageManager;
