// Firebase 긴급 재설정 유틸리티
import { logger } from './logger';

export class FirebaseEmergencyReset {
  private static instance: FirebaseEmergencyReset;
  private resetInProgress = false;

  public static getInstance(): FirebaseEmergencyReset {
    if (!FirebaseEmergencyReset.instance) {
      FirebaseEmergencyReset.instance = new FirebaseEmergencyReset();
    }
    return FirebaseEmergencyReset.instance;
  }

  // 긴급 재설정 실행
  public async emergencyReset(): Promise<void> {
    if (this.resetInProgress) {
      logger.debug('🔄 Reset already in progress...', { component: 'firebaseEmergencyReset' });
      return;
    }

    this.resetInProgress = true;
    logger.debug('🚨 Starting Firebase emergency reset...', { component: 'firebaseEmergencyReset' });

    try {
      // 1. 모든 Firebase 리스너 정리
      this.clearAllListeners();
      
      // 2. 브라우저 캐시 클리어
      this.clearBrowserCache();
      
      // 3. Firebase 연결 재설정
      await this.resetFirebaseConnection();
      
      // 4. 페이지 완전 새로고침
      this.forcePageReload();
      
    } catch (error) {
      logger.error('❌ Emergency reset failed:', error instanceof Error ? error : new Error(String(error)), { component: 'firebaseEmergencyReset' });
      // 실패 시에도 페이지 새로고침
      this.forcePageReload();
    }
  }

  // 모든 리스너 정리
  private clearAllListeners(): void {
    logger.debug('🧹 Clearing all Firebase listeners...', { component: 'firebaseEmergencyReset' });
    
    // 전역 이벤트 리스너 정리
    const events = ['beforeunload', 'unload', 'pagehide'];
    events.forEach(event => {
      window.removeEventListener(event, () => {});
    });

    // Firebase 관련 전역 변수 정리
    if ((window as any).firebase) {
      try {
        // Firebase 인스턴스 정리
        delete (window as any).firebase;
      } catch (error) {
        logger.warn('Could not clear Firebase instance:', { component: 'firebaseEmergencyReset', data: error });
      }
    }
  }

  // 브라우저 캐시 클리어
  private clearBrowserCache(): void {
    logger.debug('🗑️ Clearing browser cache...', { component: 'firebaseEmergencyReset' });
    
    try {
      // IndexedDB 클리어
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name && db.name.includes('firebase')) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }

      // LocalStorage 클리어
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('firebase') || key.includes('firestore'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // SessionStorage 클리어
      const sessionKeysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('firebase') || key.includes('firestore'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    } catch (error) {
      logger.warn('Could not clear browser cache:', { component: 'firebaseEmergencyReset', data: error });
    }
  }

  // Firebase 연결 재설정
  private async resetFirebaseConnection(): Promise<void> {
    logger.debug('🔄 Resetting Firebase connection...', { component: 'firebaseEmergencyReset' });
    
    try {
      // Firebase 앱 재초기화를 위한 지연
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Firebase 관련 스크립트 재로드
      this.reloadFirebaseScripts();
      
    } catch (error) {
      logger.warn('Firebase connection reset failed:', { component: 'firebaseEmergencyReset', data: error });
    }
  }

  // Firebase 스크립트 재로드
  private reloadFirebaseScripts(): void {
    logger.debug('📜 Reloading Firebase scripts...', { component: 'firebaseEmergencyReset' });
    
    try {
      // Firebase 관련 스크립트 태그 찾기 및 재로드
      const scripts = document.querySelectorAll('script[src*="firebase"]');
      scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src) {
          script.remove();
          const newScript = document.createElement('script');
          newScript.src = src;
          newScript.async = true;
          document.head.appendChild(newScript);
        }
      });
    } catch (error) {
      logger.warn('Could not reload Firebase scripts:', { component: 'firebaseEmergencyReset', data: error });
    }
  }

  // 페이지 강제 새로고침
  private forcePageReload(): void {
    logger.debug('🔄 Force reloading page...', { component: 'firebaseEmergencyReset' });
    
    // 모든 상태 정리 후 새로고침
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  // 재설정 상태 확인
  public isResetting(): boolean {
    return this.resetInProgress;
  }
}

// 글로벌 인스턴스
export const firebaseEmergencyReset = FirebaseEmergencyReset.getInstance();

// 긴급 재설정 함수
export const emergencyFirebaseReset = async (): Promise<void> => {
  return firebaseEmergencyReset.emergencyReset();
}; 