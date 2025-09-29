/**
 * Capacitor Status Bar 관리 서비스
 *
 * iOS/Android에서 상태바 스타일을 T-HOLDEM 브랜드에 맞게 설정
 * 웹 환경에서는 자동으로 무시됨
 */

import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

/**
 * 상태바 스타일 설정 옵션
 */
export interface StatusBarConfig {
  style: 'dark' | 'light' | 'default';
  backgroundColor: string;
  overlaysWebView: boolean;
}

/**
 * T-HOLDEM 기본 상태바 설정
 */
const DEFAULT_CONFIG: StatusBarConfig = {
  style: 'dark', // 흰색 배경에 어두운 텍스트
  backgroundColor: '#ffffff', // 헤더와 동일한 흰색
  overlaysWebView: false, // Safe Area 적용
};

/**
 * 상태바 초기화 및 스타일 설정
 */
export const initializeStatusBar = async (config: Partial<StatusBarConfig> = {}): Promise<void> => {
  // 웹 환경에서는 실행하지 않음
  if (!Capacitor.isNativePlatform()) {
    logger.info('StatusBar: 웹 환경에서는 상태바 설정을 건너뜁니다');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    logger.info('StatusBar: 상태바 초기화 시작');

    // 상태바 스타일 설정
    await StatusBar.setStyle({
      style: finalConfig.style === 'dark' ? Style.Dark : Style.Light
    });

    // 배경색 설정 (Android만 해당)
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({
        color: finalConfig.backgroundColor
      });
    }

    // 오버레이 설정
    await StatusBar.setOverlaysWebView({
      overlay: finalConfig.overlaysWebView
    });

    logger.info('StatusBar: 상태바 설정 완료');

  } catch (error) {
    logger.error('StatusBar: 상태바 설정 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
    // 상태바 설정 실패해도 앱 실행에는 영향 없음
  }
};

/**
 * 상태바 숨기기 (전체화면 모드)
 */
export const hideStatusBar = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.hide();
    logger.info('StatusBar: 상태바 숨김');
  } catch (error) {
    logger.error('StatusBar: 상태바 숨김 중 오류', error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * 상태바 보이기
 */
export const showStatusBar = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.show();
    logger.info('StatusBar: 상태바 표시');
  } catch (error) {
    logger.error('StatusBar: 상태바 표시 중 오류', error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * 상태바 정보 가져오기
 */
export const getStatusBarInfo = async () => {
  if (!Capacitor.isNativePlatform()) {
    return {
      visible: true,
      style: 'default',
      color: '#000000',
      overlays: false,
      height: 0,
    };
  }

  try {
    const info = await StatusBar.getInfo();
    logger.info('StatusBar: 현재 상태바 정보');
    return info;
  } catch (error) {
    logger.error('StatusBar: 상태바 정보 조회 중 오류', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

/**
 * 다크 모드 상태바 설정
 */
export const setDarkStatusBar = async (): Promise<void> => {
  await initializeStatusBar({
    style: 'light', // 다크 배경에 밝은 텍스트
    backgroundColor: '#1f2937', // gray-800
  });
};

/**
 * 라이트 모드 상태바 설정 (기본값)
 */
export const setLightStatusBar = async (): Promise<void> => {
  await initializeStatusBar(); // 기본 설정 사용
};