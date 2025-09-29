/**
 * Service Worker 등록 및 관리 유틸리티
 */

import React from 'react';
import { logger } from './logger';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

export interface ServiceWorkerConfig {
  swUrl?: string;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
}

/**
 * Service Worker 등록
 */
export function registerSW(config: ServiceWorkerConfig = {}): void {
  if ('serviceWorker' in navigator) {
    const swUrl = config.swUrl || '/sw.js';

    if (isLocalhost) {
      // 로컬 환경에서는 Service Worker가 존재하는지 확인
      checkValidServiceWorker(swUrl, config);

      // 로컬 환경 추가 로깅
      navigator.serviceWorker.ready.then(() => {
        logger.info('Service Worker가 캐시-우선 모드로 실행 중입니다.');
      });
    } else {
      // 프로덕션 환경에서는 바로 등록
      registerValidSW(swUrl, config);
    }
  } else {
    logger.warn('Service Worker를 지원하지 않는 브라우저입니다.');
  }
}

/**
 * 유효한 Service Worker 등록
 */
function registerValidSW(swUrl: string, config: ServiceWorkerConfig): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      logger.info(`Service Worker 등록 성공: scope=${registration.scope}, updateViaCache=${registration.updateViaCache}`, {
        component: 'serviceWorker',
        operation: 'register'
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // 기존 콘텐츠가 업데이트되었을 때
              logger.info('새로운 Service Worker가 설치되었습니다. 페이지를 새로고침하면 새 버전이 적용됩니다.');

              if (config.onUpdate) {
                config.onUpdate(registration);
              }

              if (config.onNeedRefresh) {
                config.onNeedRefresh();
              }
            } else {
              // 콘텐츠가 처음 캐시되었을 때
              logger.info('콘텐츠가 오프라인 사용을 위해 캐시되었습니다.');

              if (config.onSuccess) {
                config.onSuccess(registration);
              }

              if (config.onOfflineReady) {
                config.onOfflineReady();
              }
            }
          }
        };
      };

      // 즉시 업데이트 확인
      registration.update();
    })
    .catch((error) => {
      logger.error('Service Worker 등록 실패:', error);
    });
}

/**
 * Service Worker 유효성 검사 (로컬 환경용)
 */
function checkValidServiceWorker(swUrl: string, config: ServiceWorkerConfig): void {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');

      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // Service Worker를 찾을 수 없거나 JavaScript가 아닌 경우
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // 유효한 Service Worker인 경우 등록
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      logger.info('인터넷 연결이 없습니다. 앱이 오프라인 모드로 실행됩니다.');
    });
}

/**
 * Service Worker 등록 해제
 */
export function unregisterSW(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        logger.info('Service Worker 등록 해제됨');
      })
      .catch((error) => {
        logger.error('Service Worker 등록 해제 실패:', error);
      });
  }
}

/**
 * Service Worker 업데이트 강제 실행
 */
export function updateSW(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SKIP_WAITING'
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
        resolve();
      });

      // 타임아웃 설정
      setTimeout(() => {
        reject(new Error('Service Worker 업데이트 타임아웃'));
      }, 10000);
    } else {
      reject(new Error('Service Worker가 등록되지 않음'));
    }
  });
}

/**
 * Service Worker 상태 확인
 */
export function getServiceWorkerStatus(): Promise<{
  isRegistered: boolean;
  isControlling: boolean;
  state?: string;
  scope?: string;
}> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve({
        isRegistered: false,
        isControlling: false,
      });
      return;
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        const result: {
          isRegistered: boolean;
          isControlling: boolean;
          state?: string;
          scope?: string;
        } = {
          isRegistered: true,
          isControlling: !!navigator.serviceWorker.controller,
          scope: registration.scope,
        };

        if (registration.active?.state) {
          result.state = registration.active.state;
        }

        resolve(result);
      } else {
        resolve({
          isRegistered: false,
          isControlling: false,
        });
      }
    });
  });
}

/**
 * PWA 설치 프롬프트 관리
 */
export class PWAInstallManager {
  private deferredPrompt: any = null;
  private isInstallable = false;
  private isInstalled = false;

  constructor() {
    this.setupEventListeners();
    this.checkIfInstalled();
  }

  private setupEventListeners(): void {
    // PWA 설치 가능 이벤트
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      logger.info('PWA 설치 가능 상태');
    });

    // PWA 설치 완료 이벤트
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      logger.info('PWA 설치 완료');
    });
  }

  private checkIfInstalled(): void {
    // 독립형 모드인지 확인 (PWA로 실행 중)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
    }

    // iOS Safari PWA 모드 확인
    if ((window.navigator as any).standalone === true) {
      this.isInstalled = true;
    }
  }

  /**
   * PWA 설치 프롬프트 표시
   */
  public async promptInstall(): Promise<boolean> {
    if (!this.isInstallable || !this.deferredPrompt) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      logger.info(`PWA 설치 프롬프트 결과: ${outcome}`);

      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      logger.error('PWA 설치 프롬프트 에러', error instanceof Error ? error : new Error(String(error)), {
        component: 'PWAInstallManager',
        operation: 'promptInstall'
      });
      return false;
    }
  }

  /**
   * PWA 설치 가능 여부 확인
   */
  public getIsInstallable(): boolean {
    return this.isInstallable && !this.isInstalled;
  }

  /**
   * PWA 설치 상태 확인
   */
  public getIsInstalled(): boolean {
    return this.isInstalled;
  }
}

// 전역 PWA 설치 매니저 인스턴스
export const pwaInstallManager = new PWAInstallManager();

/**
 * 캐시 정리
 */
export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );

    logger.info('모든 캐시가 정리되었습니다.');
  }

  // Service Worker에 캐시 정리 메시지 전송
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE'
    });
  }
}

/**
 * 앱 업데이트 알림 컴포넌트를 위한 훅
 */
export function useServiceWorkerUpdate() {
  const [needRefresh, setNeedRefresh] = React.useState(false);
  const [offlineReady, setOfflineReady] = React.useState(false);

  React.useEffect(() => {
    registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
    });
  }, []);

  const updateServiceWorker = React.useCallback(async () => {
    try {
      await updateSW();
      setNeedRefresh(false);
    } catch (error) {
      logger.error('Service Worker 업데이트 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'serviceWorkerUpdate',
        operation: 'updateServiceWorker'
      });
    }
  }, []);

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
  };
}

