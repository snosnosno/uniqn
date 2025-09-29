/**
 * Firebase 오프라인 지원 및 캐싱 유틸리티
 */

import React from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from './logger';

export interface OfflineConfig {
  enablePersistence: boolean;
  synchronizeTabs: boolean;
  cacheSizeBytes?: number;
}

// 기본 오프라인 설정
const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  enablePersistence: true,
  synchronizeTabs: false,
  cacheSizeBytes: 40 * 1024 * 1024, // 40MB
};

/**
 * Firebase 오프라인 지원 초기화 (Firebase v11 방식)
 *
 * Firebase v11부터는 FirestoreSettings.cache를 통해 오프라인 지속성을 설정합니다.
 * 이 함수는 기존 API와의 호환성을 위해 유지되지만, 실제 오프라인 설정은
 * firebase.ts에서 initializeFirestore() 시점에 설정되어야 합니다.
 */
export const initializeOfflineSupport = async (
  config: Partial<OfflineConfig> = {}
): Promise<void> => {
  const finalConfig = { ...DEFAULT_OFFLINE_CONFIG, ...config };

  try {
    if (finalConfig.enablePersistence) {
      // Firebase v11에서는 initializeFirestore 시점에 cache 설정이 필요합니다.
      // 여기서는 네트워크 상태만 확인합니다.
      logger.info(`Firebase 오프라인 지원 초기화됨 (v11 방식) - synchronizeTabs: ${finalConfig.synchronizeTabs}, cacheSizeBytes: ${finalConfig.cacheSizeBytes}`, {
        component: 'offlineSupport',
        operation: 'initializeOfflineSupport',
      });
    }
  } catch (error: any) {
    logger.error('Firebase 오프라인 지원 초기화 실패', error instanceof Error ? error : new Error(String(error)), {
      errorCode: error.code,
      component: 'offlineSupport',
    });
  }
};

/**
 * 네트워크 상태 관리
 */
export class NetworkManager {
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(isOnline: boolean) => void> = [];
  private retryTimeouts: Set<NodeJS.Timeout> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.setOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
      this.setOnlineStatus(false);
    });

    // Firestore 네트워크 상태와 동기화
    this.syncWithFirestore();
  }

  private setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      logger.info(`네트워크 상태 변경: ${isOnline ? '온라인' : '오프라인'}`);

      this.listeners.forEach(listener => {
        try {
          listener(isOnline);
        } catch (error) {
          logger.error('네트워크 상태 리스너 에러', error instanceof Error ? error : new Error(String(error)), {
            component: 'NetworkManager'
          });
        }
      });

      if (isOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    }
  }

  private async syncWithFirestore(): Promise<void> {
    try {
      if (this.isOnline) {
        await enableNetwork(db);
        logger.debug('Firestore 네트워크 활성화');
      } else {
        await disableNetwork(db);
        logger.debug('Firestore 네트워크 비활성화');
      }
    } catch (error) {
      logger.warn('Firestore 네트워크 동기화 실패', {
        component: 'NetworkManager',
        errorInfo: String(error)
      });
    }
  }

  private handleOnline(): void {
    // 온라인 상태가 되면 Firestore 네트워크 재활성화
    this.enableFirestoreNetwork();

    // 지연된 작업들 재시도
    this.retryPendingOperations();
  }

  private handleOffline(): void {
    // 오프라인 상태가 되면 Firestore 네트워크 비활성화
    this.disableFirestoreNetwork();

    // 재시도 타이머들 정리
    this.clearRetryTimeouts();
  }

  private async enableFirestoreNetwork(): Promise<void> {
    try {
      await enableNetwork(db);
      logger.info('Firestore 네트워크 재연결됨');
    } catch (error) {
      logger.error('Firestore 네트워크 재연결 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'NetworkManager'
      });
    }
  }

  private async disableFirestoreNetwork(): Promise<void> {
    try {
      await disableNetwork(db);
      logger.info('Firestore 네트워크 연결 해제됨');
    } catch (error) {
      logger.error('Firestore 네트워크 연결 해제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'NetworkManager'
      });
    }
  }

  private retryPendingOperations(): void {
    // 실제 구현에서는 실패한 작업들을 저장하고 재시도
    logger.debug('보류된 작업들 재시도 중...');
  }

  private clearRetryTimeouts(): void {
    this.retryTimeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    this.retryTimeouts.clear();
  }

  /**
   * 네트워크 상태 리스너 등록
   */
  public addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);

    // 현재 상태로 즉시 호출
    listener(this.isOnline);

    // 정리 함수 반환
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 현재 네트워크 상태 확인
   */
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * 연결 상태 테스트
   */
  public async testConnectivity(): Promise<boolean> {
    try {
      // Firebase Firestore로 간단한 연결 테스트
      await fetch('https://firestore.googleapis.com/v1/projects/tholdem-ebc18', {
        method: 'GET',
        mode: 'no-cors',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 정리
   */
  public cleanup(): void {
    this.clearRetryTimeouts();
    this.listeners.length = 0;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

// 전역 네트워크 매니저 인스턴스
export const networkManager = new NetworkManager();

/**
 * 오프라인 상태 확인 훅
 */
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(networkManager.getIsOnline());

  React.useEffect(() => {
    const unsubscribe = networkManager.addListener(setIsOnline);
    return unsubscribe;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
};

/**
 * 로컬 스토리지 기반 캐시 관리
 */
export class LocalCache {
  private readonly prefix = 'tholdem_cache_';
  private readonly maxAge = 24 * 60 * 60 * 1000; // 24시간

  public set(key: string, data: any, ttl?: number): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.maxAge,
      };
      localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(item));
    } catch (error) {
      logger.warn('로컬 캐시 저장 실패', {
        component: 'LocalCache',
        value: key,
        errorInfo: String(error)
      });
    }
  }

  public get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`${this.prefix}${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();

      if (now - parsed.timestamp > parsed.ttl) {
        this.delete(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      logger.warn('로컬 캐시 조회 실패', {
        component: 'LocalCache',
        value: key,
        errorInfo: String(error)
      });
      return null;
    }
  }

  public delete(key: string): void {
    try {
      localStorage.removeItem(`${this.prefix}${key}`);
    } catch (error) {
      logger.warn('로컬 캐시 삭제 실패', {
        component: 'LocalCache',
        value: key,
        errorInfo: String(error)
      });
    }
  }

  public clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.prefix)
      );
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      logger.warn('로컬 캐시 전체 삭제 실패', {
        component: 'LocalCache',
        errorInfo: String(error)
      });
    }
  }

  public cleanExpired(): void {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.prefix)
      );

      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            const now = Date.now();

            if (now - parsed.timestamp > parsed.ttl) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      logger.warn('만료된 캐시 정리 실패', {
        component: 'LocalCache',
        errorInfo: String(error)
      });
    }
  }
}

// 전역 로컬 캐시 인스턴스
export const localCache = new LocalCache();

