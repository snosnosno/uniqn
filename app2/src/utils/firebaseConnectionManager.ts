import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';

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
      console.warn(`⚠️ Multiple listeners detected for collection: ${collectionPath}`);
    }
    
    try {
      const unsubscribe = onSnapshot(
        collection(db, collectionPath),
        (snapshot) => {
          try {
            const data = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as T[];
            callback(data);
          } catch (error) {
            console.error('Error processing snapshot data:', error);
            if (errorCallback) errorCallback(error as Error);
          }
        },
        (error) => {
          console.error(`Firebase listener error for ${collectionPath}:`, error);
          
          // Handle internal assertion errors - 재시도하지 않고 정리만 수행
          if (error.message && error.message.includes('INTERNAL ASSERTION FAILED')) {
            console.log('🚨 Firebase INTERNAL ASSERTION FAILED detected - cleaning up listeners');
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
      console.error('Error setting up Firebase listener:', error);
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
      console.error('Max retry attempts reached for Firebase connection');
      if (errorCallback) {
        errorCallback(new Error('Firebase connection failed after multiple retry attempts'));
      }
      return;
    }

    this.retryCount++;
    console.log(`🔄 Firebase internal assertion error detected (attempt ${this.retryCount}/${this.maxRetries})`);

    // Clean up existing listeners to prevent state corruption
    this.cleanupAllListeners();

    // Firebase 내부 상태 정리를 위한 대기 시간
    setTimeout(() => {
      console.log('⚠️ Firebase internal assertion error - not retrying to prevent recursion');
      if (errorCallback) {
        errorCallback(new Error('Firebase internal assertion error occurred. Please refresh the page.'));
      }
    }, 1000);
  }

  private removeListener(listenerId: string, collectionPath?: string) {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error removing listener:', error);
      }
      this.listeners.delete(listenerId);
      
      // Remove collection from active set if this was the last listener for this collection
      if (collectionPath) {
        const hasOtherListeners = Array.from(this.listeners.keys()).some(id => 
          id.startsWith(collectionPath)
        );
        if (!hasOtherListeners) {
          this.activeCollections.delete(collectionPath);
        }
      }
    }
  }

  public cleanupAllListeners() {
    console.log('🧹 Cleaning up all Firebase listeners...');
    this.listeners.forEach((unsubscribe, listenerId) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(`Error cleaning up listener ${listenerId}:`, error);
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
        console.log('🚨 Global Firebase INTERNAL ASSERTION FAILED detected');
        this.handleGlobalInternalAssertionError();
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('INTERNAL ASSERTION FAILED')) {
        console.log('🚨 Unhandled Firebase INTERNAL ASSERTION FAILED detected');
        this.handleGlobalInternalAssertionError();
      }
    });
  }

  private handleGlobalInternalAssertionError() {
    console.log('🔧 Attempting automatic recovery from Firebase internal error...');
    
    // 모든 리스너 정리
    this.cleanupAllListeners();
    
    // 재시도 카운트 리셋
    this.resetRetryCount();
    
    // 사용자에게 새로고침 권장 메시지 표시
    if (window.confirm('Firebase 연결에 문제가 발생했습니다. 페이지를 새로고침하시겠습니까?')) {
      window.location.reload();
    }
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