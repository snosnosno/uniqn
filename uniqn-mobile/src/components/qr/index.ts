/**
 * UNIQN Mobile - QR 코드 컴포넌트 모듈
 *
 * @description QR 코드 관련 컴포넌트 내보내기
 * @version 1.0.0
 *
 * 플랫폼별 QRCodeScanner 자동 선택:
 * - 네이티브 (iOS/Android): expo-camera 사용
 * - 웹: MediaDevices API + jsQR 사용
 */

import { Platform } from 'react-native';

// 플랫폼별 QRCodeScanner 내보내기
// Metro bundler/Webpack이 .web.tsx 확장자를 자동으로 선택함
export { QRCodeScanner } from './QRCodeScanner';
export { QRCodeDisplay } from './QRCodeDisplay';

// 플랫폼 유틸리티
export const isWebPlatform = Platform.OS === 'web';
