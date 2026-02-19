/**
 * UNIQN Mobile - Firebase InAppMessage Repository
 *
 * @description Firebase Firestore 기반 InAppMessage Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 인앱 메시지 Firestore 조회
 * 2. 읽기 전용 (CUD는 Admin SDK에서 처리)
 */

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { COLLECTIONS } from '@/constants';
import type { InAppMessage } from '@/types/inAppMessage';
import type { IInAppMessageRepository } from '../interfaces/IInAppMessageRepository';

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase InAppMessage Repository
 */
export class FirebaseInAppMessageRepository implements IInAppMessageRepository {
  async fetchActiveMessages(): Promise<InAppMessage[]> {
    try {
      const messagesRef = collection(getFirebaseDb(), COLLECTIONS.IN_APP_MESSAGES);
      const q = query(
        messagesRef,
        where('isActive', '==', true),
        orderBy('priority', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(q);

      const messages: InAppMessage[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type ?? 'modal',
          title: data.title ?? '',
          content: data.content ?? '',
          priority: data.priority ?? 'medium',
          targetAudience: data.targetAudience ?? { type: 'all' },
          conditions: data.conditions,
          primaryAction: data.primaryAction,
          secondaryAction: data.secondaryAction,
          imageUrl: data.imageUrl,
          icon: data.icon,
          backgroundColor: data.backgroundColor,
          textColor: data.textColor,
          dismissible: data.dismissible ?? true,
          autoDismissMs: data.autoDismissMs,
          metadata: data.metadata,
          isActive: true,
          showDontShowAgain: data.showDontShowAgain,
        } satisfies InAppMessage;
      });

      logger.info('인앱 메시지 조회', {
        component: 'InAppMessageRepository',
        count: messages.length,
      });

      return messages;
    } catch (error) {
      logger.error('인앱 메시지 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '인앱 메시지 조회',
        component: 'InAppMessageRepository',
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

const inAppMessageRepository = new FirebaseInAppMessageRepository();

/**
 * 활성 인앱 메시지 조회 (standalone 함수 — useQuery queryFn 호환)
 */
export const fetchActiveMessages = () => inAppMessageRepository.fetchActiveMessages();
