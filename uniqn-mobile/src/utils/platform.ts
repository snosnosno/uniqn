/**
 * UNIQN Mobile - 플랫폼 유틸리티
 *
 * @description React Native 플랫폼 분기 처리
 * @version 1.0.0
 */

import { Platform, Dimensions } from 'react-native';
import { BREAKPOINTS } from '@/constants';

/**
 * 현재 플랫폼 확인
 */
export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = isIOS || isAndroid;

/**
 * 플랫폼별 값 선택
 */
export function platformSelect<T>(options: {
  web?: T;
  ios?: T;
  android?: T;
  native?: T;
  default: T;
}): T {
  if (isWeb && options.web !== undefined) return options.web;
  if (isIOS && options.ios !== undefined) return options.ios;
  if (isAndroid && options.android !== undefined) return options.android;
  if (isMobile && options.native !== undefined) return options.native;
  return options.default;
}

/**
 * 현재 화면 크기 정보
 */
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

/**
 * 현재 반응형 브레이크포인트
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export const getBreakpoint = (): Breakpoint => {
  const { width } = getScreenDimensions();

  if (width < BREAKPOINTS.SM) return 'sm';
  if (width < BREAKPOINTS.MD) return 'md';
  if (width < BREAKPOINTS.LG) return 'lg';
  return 'xl';
};

/**
 * 반응형 체크
 */
export const isSmallScreen = () => getScreenDimensions().width < BREAKPOINTS.SM;
export const isMediumScreen = () => {
  const { width } = getScreenDimensions();
  return width >= BREAKPOINTS.SM && width < BREAKPOINTS.LG;
};
export const isLargeScreen = () => getScreenDimensions().width >= BREAKPOINTS.LG;

/**
 * 데스크톱 여부 (웹에서 lg 이상)
 */
export const isDesktop = () => isWeb && isLargeScreen();

/**
 * 모바일 디바이스 여부 (네이티브 또는 웹에서 작은 화면)
 */
export const isMobileDevice = () => isMobile || isSmallScreen();

/**
 * OS 버전 정보
 */
export const getOSVersion = (): string => {
  if (isWeb) return 'web';
  return Platform.Version?.toString() || 'unknown';
};

/**
 * 플랫폼 정보 객체
 */
export const platformInfo = {
  os: Platform.OS,
  version: getOSVersion(),
  isWeb,
  isIOS,
  isAndroid,
  isMobile,
};
