/**
 * 전역 타입 선언
 */

// Google Analytics gtag 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- GA4 gtag 함수는 다양한 인자 조합을 허용하므로 any 사용 불가피
declare function gtag(...args: unknown[]): void;

// Performance Observer 타입 확장
interface PerformancePaintTiming extends PerformanceEntry {
  startTime: number;
}

// First Input Delay 타입
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart?: number;
  startTime: number;
}

// Navigator 타입 확장 (Connection API)
interface Navigator {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
}

// Window 타입 확장
interface Window {
  gtag?: typeof gtag;
  __FIREBASE_DEFAULTS__?: {
    emulatorHosts?: {
      auth?: string;
      firestore?: string;
    };
    [key: string]: unknown;
  };
}
