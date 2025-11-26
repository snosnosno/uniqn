import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';

import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { db } from '../firebase';

// Global listener management
class FirebaseConnectionManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  private activeCollections: Set<string> = new Set();
  private isInitialized = false;
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;

    // Set up global error handling
    window.addEventListener('beforeunload', () => {
      this.cleanupAllListeners();
    });

    this.isInitialized = true;
  }

  // Safe onSnapshot wrapper with error handling
  public safeOnSnapshot<T>(
    collectionPath: string,
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    const listenerId = `${collectionPath}_${Date.now()}`;

    // 중복 구독 방지를 위한 경고
    if (this.activeCollections.has(collectionPath)) {
      logger.warn(`⚠️ Multiple listeners detected for collection: ${collectionPath}`, {
        component: 'firebaseConnectionManager',
      });
    }

    try {
      const unsubscribe = onSnapshot(
        collection(db, collectionPath),
        (snapshot) => {
          try {
            const data = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as T[];
            callback(data);
          } catch (error) {
            logger.error(
              'Error processing snapshot data:',
              error instanceof Error ? error : new Error(String(error)),
              { component: 'firebaseConnectionManager' }
            );
            if (errorCallback) errorCallback(error as Error);
          }
        },
        (error) => {
          logger.error(
            `Firebase listener error for ${collectionPath}:`,
            error instanceof Error ? error : new Error(String(error)),
            { component: 'firebaseConnectionManager' }
          );

          // Handle internal assertion errors - 재시도하지 않고 정리만 수행
          if (error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
            logger.debug('🚨 Firebase INTERNAL ASSERTION FAILED detected - cleaning up listeners', {
              component: 'firebaseConnectionManager',
            });
            this.handleInternalAssertionError(collectionPath, callback, errorCallback);
          } else {
            if (errorCallback) errorCallback(error);
          }
        }
      );

      // Store the listener and mark collection as active
      this.listeners.set(listenerId, unsubscribe);
      this.activeCollections.add(collectionPath);

      return () => {
        this.removeListener(listenerId, collectionPath);
      };
    } catch (error) {
      logger.error(
        'Error setting up Firebase listener:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'firebaseConnectionManager' }
      );
      if (errorCallback) errorCallback(error as Error);

      // Return a no-op function
      return () => {};
    }
  }

  private handleInternalAssertionError<T>(
    collectionPath: string,
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ) {
    if (this.retryCount >= this.maxRetries) {
      logger.error(
        'Max retry attempts reached for Firebase connection',
        new Error('Max retry attempts reached for Firebase connection'),
        { component: 'firebaseConnectionManager' }
      );
      if (errorCallback) {
        errorCallback(new Error('Firebase connection failed after multiple retry attempts'));
      }
      return;
    }

    this.retryCount++;
    this.cleanupAllListeners();

    setTimeout(() => {
      if (errorCallback) {
        errorCallback(
          new Error('Firebase internal assertion error occurred. Please refresh the page.')
        );
      }
    }, 1000);
  }

  private removeListener(listenerId: string, collectionPath?: string) {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        logger.warn('Error removing listener:', {
          component: 'firebaseConnectionManager',
          data: error,
        });
      }
      this.listeners.delete(listenerId);

      // Remove collection from active set if this was the last listener for this collection
      if (collectionPath) {
        const hasOtherListeners = Array.from(this.listeners.keys()).some((id) =>
          id.startsWith(collectionPath)
        );
        if (!hasOtherListeners) {
          this.activeCollections.delete(collectionPath);
        }
      }
    }
  }

  public cleanupAllListeners() {
    this.listeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.warn(`Error cleaning up listener ${listenerId}:`, {
          component: 'firebaseConnectionManager',
          data: error,
        });
      }
    });
    this.listeners.clear();
    this.activeCollections.clear();
  }

  public resetRetryCount() {
    this.retryCount = 0;
  }

  public getListenerCount(): number {
    return this.listeners.size;
  }

  public getActiveCollections(): string[] {
    return Array.from(this.activeCollections);
  }

  // Firebase 내부 오류 감지 및 자동 복구
  public enableAutoRecovery() {
    // 전역 오류 핸들러 설정
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('INTERNAL ASSERTION FAILED')) {
        logger.debug('🚨 Global Firebase INTERNAL ASSERTION FAILED detected', {
          component: 'firebaseConnectionManager',
        });
        this.handleGlobalInternalAssertionError();
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (
        event.reason &&
        event.reason.message &&
        event.reason.message.includes('INTERNAL ASSERTION FAILED')
      ) {
        logger.debug('🚨 Unhandled Firebase INTERNAL ASSERTION FAILED detected', {
          component: 'firebaseConnectionManager',
        });
        this.handleGlobalInternalAssertionError();
      }
    });
  }

  private handleGlobalInternalAssertionError() {
    this.cleanupAllListeners();
    this.resetRetryCount();

    toast.error(
      'Firebase 연결에 문제가 발생했습니다. 페이지를 새로고침해주세요.',
      undefined,
      10000
    );
  }
}

// Singleton instance
export const firebaseConnectionManager = new FirebaseConnectionManager();

// Utility functions
export const safeOnSnapshot = <T>(
  collectionPath: string,
  callback: (data: T[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  return firebaseConnectionManager.safeOnSnapshot(collectionPath, callback, errorCallback);
};

export const cleanupFirebaseListeners = (): void => {
  firebaseConnectionManager.cleanupAllListeners();
};

export const resetFirebaseRetryCount = (): void => {
  firebaseConnectionManager.resetRetryCount();
};
